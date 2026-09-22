// Routes yt-dlp stdout/stderr output to the monitor, error tracker, and
// timeout controller, tracks per-run detection state (bot detection, HTTP 403,
// partial destinations, stderr buffer), and owns throttled downloadProgress
// WebSocket emission. One instance per yt-dlp run.
const path = require('path');
const videoActivity = require('./videoActivity');
const logger = require('../../logger');
const MessageEmitter = require('../messageEmitter');
const filesystem = require('../filesystem');
const { JobVideoDownload } = require('../../models');
const { VIDEO_PERSISTED_MARKER } = require('../constants/outputMarkers');
const { containsHttp403, isSabrRestriction } = require('./ytdlpStderrSignals');

const PROGRESS_THROTTLE_MS = 250;
// Must stay well under the client's 60s STALE_ACTIVITY_MS (useCurrentActivitySeed)
// so the /api/jobs/current-activity snapshot is never considered stale mid-run.
const PROGRESS_HEARTBEAT_MS = 25 * 1000;

class YtdlpOutputRouter {
  constructor({
    jobId,
    config,
    monitor,
    errorTracker,
    timeoutController,
    cookiesEnabled = false,
    anonymousRetry = false,
    heartbeatIntervalMs = PROGRESS_HEARTBEAT_MS,
  }) {
    this.jobId = jobId;
    this.config = config;
    this.monitor = monitor;
    this.errorTracker = errorTracker;
    this.timeoutController = timeoutController;
    // Branches the mid-run 403/bot hints: with cookies enabled, "set cookies"
    // is exactly the wrong advice (stale cookies are the usual cause).
    this.cookiesEnabled = cookiesEnabled;
    // Distinguishes an intentional no-cookies fallback from a normal run
    // where the user has not configured cookies.
    this.anonymousRetry = anonymousRetry;
    // Per-run detection state, read by the executor/finalizer after exit
    this.partialDestinations = new Set();
    this.stderrBuffer = '';
    // Partial stderr line waiting on its newline, so a split line never
    // matches against half of itself.
    this.stderrLineRemainder = '';
    // After dispose() (only possible when the executor stopped waiting for
    // stdio to close) output is logged but not classified or broadcast.
    this.disposed = false;
    this.botDetected = false;
    this.httpForbiddenDetected = false;
    this.cookiesSuggestionEmitted = false;
    this.sabrRestrictionDetected = false;
    // WebSocket message throttling for progress updates
    this.lastProgressEmitTime = 0;
    this.pendingProgressMessage = null;
    this.progressFlushTimer = null;
    this.lastEmittedProgressState = null;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.heartbeatTimer = null;
  }

  // yt-dlp goes silent for minutes during large merges and audio extraction.
  // Rebroadcast the snapshot so clients and the monitor's lastActivityAt stay fresh.
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastProgressEmitTime < this.heartbeatIntervalMs) {
        return;
      }
      MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', {
        progress: this.monitor.snapshot(),
      });
      this.lastProgressEmitTime = Date.now();
    }, this.heartbeatIntervalMs);
    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref();
    }
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  handleStdoutChunk(chunk) {
    if (this.disposed) {
      logger.debug({ source: 'yt-dlp', afterDispose: true }, chunk.toString());
      return;
    }
    chunk
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        logger.info({ source: 'yt-dlp' }, line);

        this.timeoutController.noteLine(line);

        // Control marker from the per-video post-processor: its DB rows are
        // committed, so tell listing pages to refetch. Not yt-dlp output;
        // skip progress parsing for this line.
        if (line.startsWith(VIDEO_PERSISTED_MARKER)) {
          const youtubeId = line.slice(VIDEO_PERSISTED_MARKER.length).trim();
          MessageEmitter.emitMessage('broadcast', null, 'download', 'videosUpdated', { youtubeId });
          videoActivity.finish(this.jobId, youtubeId);
          return;
        }

        // Track current video being processed
        if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
          const urlMatch = line.match(/\[youtube\] Extracting URL: (.+)/);
          if (urlMatch) {
            const url = urlMatch[1].trim();
            // Extract video ID from URL
            const idMatch = url.match(/[?&]v=([^&]+)|youtu\.be\/([^?&]+)|\/watch\/([^?&]+)|\/([a-zA-Z0-9_-]{10,12})$/);
            if (idMatch) {
              const youtubeId = idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4];
              this.errorTracker.trackVideoStart(youtubeId);
              this.monitor.youtubeId = youtubeId;
              videoActivity.start(this.jobId, this.monitor.youtubeId);
              logger.debug({ currentVideoId: this.errorTracker.currentVideoId, url }, 'Tracking video extraction');
            }
          }
        }

        if (line.includes('already been recorded in the archive') || line.includes('does not pass filter')) {
          const id = line.includes('does not pass filter')
            ? this.monitor.youtubeId
            : line.match(/^\[download\]\s+([a-zA-Z0-9_-]{11}): has already been recorded in the archive/)?.[1];
          if (id) videoActivity.finish(this.jobId, id);
        }

        // Track destination files for cleanup
        if (line.startsWith('[download] Destination:')) {
          const destPath = line.replace('[download] Destination:', '').trim();
          if (destPath) {
            this.partialDestinations.add(destPath);

            // Create tracking entry for any video download
            const youtubeId = filesystem.extractYoutubeIdFromPath(destPath);
            if (youtubeId) {
              // Update current video ID if we can extract it from the path
              if (filesystem.isMainVideoFile(destPath)) {
                this.errorTracker.trackVideoFromDestination(youtubeId);
                this.monitor.youtubeId = youtubeId;
                videoActivity.start(this.jobId, youtubeId);
                logger.debug({ currentVideoId: this.errorTracker.currentVideoId, destPath }, 'Updated current video ID from destination');
              }

              const videoDir = path.dirname(destPath);
              JobVideoDownload.findOrCreate({
                where: {
                  job_id: this.jobId,
                  youtube_id: youtubeId
                },
                defaults: {
                  job_id: this.jobId,
                  youtube_id: youtubeId,
                  file_path: videoDir,
                  status: 'in_progress'
                }
              }).catch(err => {
                logger.error({ err }, 'Error creating JobVideoDownload tracking entry');
              });
            }
          }
        }

        // Suppress the line when errorTracker.handleErrorLine consumed it
        // (expected skip or termination).
        let suppressErrorLine = false;
        if (line.includes('ERROR:')) {
          suppressErrorLine = this.errorTracker.handleErrorLine(line, 'stdout');
        }

        if (suppressErrorLine) {
          return;
        }

        if (line.includes('WARNING:')) {
          this.errorTracker.handleWarningLine(line, 'stdout');
        }

        // Always try to process for state updates
        let structuredProgress = this.monitor.processProgress('{}', line, this.config);

        // Parse JSON progress if available
        const jsonStart = line.indexOf('{');
        if (jsonStart !== -1) {
          const jsonPortion = line.slice(jsonStart);
          const jsonProgress = this.monitor.processProgress(jsonPortion, line, this.config);
          if (jsonProgress) {
            structuredProgress = jsonProgress;
            // Reset timer on actual progress updates
            this.timeoutController.noteActivity();
          }
        }

        // Use throttled message emission (250ms for progress, immediate for important messages)
        this.emitProgressMessage(line, structuredProgress || this.monitor.lastParsed || null);

        if (!this.httpForbiddenDetected && containsHttp403(line)) {
          this.httpForbiddenDetected = true;
          this.emitCookiesSuggestion();
        }
      });
  }

  handleStderrChunk(data) {
    const dataStr = data.toString();
    if (this.disposed) {
      logger.debug({ source: 'yt-dlp-stderr', afterDispose: true }, dataStr);
      return;
    }
    this.stderrBuffer += dataStr;
    logger.info({ source: 'yt-dlp-stderr' }, dataStr);

    // Chunks can join or split lines, so classify complete lines only, in
    // order (a subtitle WARNING has to undo the ERROR before it), and hold
    // the trailing partial line.
    const lines = (this.stderrLineRemainder + dataStr).split('\n');
    this.stderrLineRemainder = lines.pop();
    lines.forEach((line) => this.classifyStderrLine(line));
  }

  // Classify whatever is still buffered without a newline.
  flushStderr() {
    const remainder = this.stderrLineRemainder;
    this.stderrLineRemainder = '';
    if (remainder.trim()) {
      this.classifyStderrLine(remainder);
    }
  }

  classifyStderrLine(rawLine) {
    const line = rawLine.trim();
    if (!line) return;

    if (!this.httpForbiddenDetected && containsHttp403(line)) {
      this.httpForbiddenDetected = true;
      this.emitCookiesSuggestion();
    }

    if (!this.sabrRestrictionDetected && isSabrRestriction(line)) {
      this.sabrRestrictionDetected = true;
      this.emitSabrRestrictionWarning();
    }

    if (line.includes('ERROR:')) {
      this.errorTracker.handleErrorLine(line, 'stderr');
    } else if (line.includes('WARNING:')) {
      this.errorTracker.handleWarningLine(line, 'stderr');
    }

    // Check for bot detection message (handle different quote types and patterns)
    if (line.includes('Sign in to confirm') && line.includes('not a bot')) {
      this.botDetected = true;
      const botMessage = this.anonymousRetry
        ? 'Bot detection encountered during the no-cookies fallback. The fallback also failed, so this video may be genuinely unavailable.'
        : this.cookiesEnabled
          ? 'Bot detection encountered even though cookies are configured - they are likely expired or rotated. Re-export fresh cookies from your browser and upload them again.'
          : 'Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.';
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: botMessage,
          progress: this.monitor.snapshot('bot_detected'),
          error: true
        }
      );
    }
  }

  emitCookiesSuggestion() {
    if (this.cookiesSuggestionEmitted) {
      return;
    }
    this.cookiesSuggestionEmitted = true;
    const message = this.anonymousRetry
      ? 'HTTP 403 detected during the no-cookies fallback. If this retry fails, the video may be genuinely unavailable.'
      : this.cookiesEnabled
        ? 'HTTP 403 detected while using your uploaded cookies. If the download fails, try re-exporting fresh cookies from your browser, or disable cookies in Settings -> Cookies.'
        : 'HTTP 403 detected: YouTube may be blocking requests. If download fails, try setting cookies in Configuration.';
    // Don't set monitor.hasError here - let the final exit code determine success/failure
    // 403s on HLS fragments are often recoverable and don't indicate actual failure
    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'download',
      'downloadProgress',
      {
        text: message,
        progress: this.monitor.snapshot('warning'),
        warning: true,
        errorCode: this.anonymousRetry
          ? 'NO_COOKIES_FALLBACK_403'
          : this.cookiesEnabled
            ? 'COOKIES_MAY_BE_STALE'
            : 'COOKIES_RECOMMENDED'
      }
    );
  }

  // Not an error: the download continues on the fallback player clients, but
  // free accounts may end up with the 1080p HLS stream instead of full DASH.
  emitSabrRestrictionWarning() {
    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'download',
      'downloadProgress',
      {
        text: 'YouTube is restricting stream formats for your cookies (SABR-only experiment). ' +
          'Youtarr is using fallback player clients; accounts without YouTube Premium may be limited to 1080p. ' +
          'If you do not need cookies for bot checks, disabling them in Settings -> Cookies restores full quality.',
        progress: this.monitor.snapshot('warning'),
        warning: true,
        errorCode: 'SABR_RESTRICTED_FORMATS'
      }
    );
  }

  // True when the line should bypass throttling (state changes, errors,
  // warnings, completion events).
  isImportantMessage(line, structuredProgress) {
    // State-changing events should always be sent immediately
    const importantPatterns = [
      '[download] Destination:',      // New file download starting
      '[Merger]',                      // Merging video/audio
      '[MoveFiles]',                   // Moving file to final location
      '[Metadata]',                    // Adding metadata
      '[ExtractAudio]',                // Extracting audio
      '[download] 100%',               // Download complete
      'Downloading item',              // New item in playlist
      'already been recorded in the archive', // Skipped (already downloaded)
      'does not pass filter',          // Skipped (filtered out)
      'ERROR:',                        // Error occurred
      'WARNING:',                      // Warning occurred
      'HTTP Error 403',                // Authentication issue
      '403: Forbidden',                // Authentication issue (alternate format)
      'Sign in to confirm',            // Bot detection
      '[youtube] Extracting URL:',     // Starting to fetch video metadata
      'Downloading webpage',           // Fetching video metadata
      'Downloading tv client config',  // Fetching video metadata
      'Downloading player',            // Fetching video player
      'Downloading m3u8 information',  // Fetching stream info
      '[info]',                        // Info messages (subtitles, thumbnails, metadata)
      '[SubtitlesConvertor]',          // Converting subtitles
      '[ThumbnailsConvertor]',         // Converting thumbnails
    ];

    for (const pattern of importantPatterns) {
      if (line.includes(pattern)) {
        return true;
      }
    }

    // Check if monitor detected a state change
    if (structuredProgress && structuredProgress.state) {
      const stateChanged = structuredProgress.state !== this.lastEmittedProgressState;
      if (stateChanged) {
        return true;
      }
    }

    return false;
  }

  // Important messages emit immediately; everything else is throttled to
  // PROGRESS_THROTTLE_MS.
  emitProgressMessage(text, progress) {
    const isImportant = this.isImportantMessage(text, progress);

    if (isImportant) {
      // Important messages: send immediately and clear any pending timer
      if (this.progressFlushTimer) {
        clearTimeout(this.progressFlushTimer);
        this.progressFlushTimer = null;
        this.pendingProgressMessage = null;
      }

      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: text,
          progress: progress,
        }
      );

      this.lastProgressEmitTime = Date.now();
      if (progress && progress.state) {
        this.lastEmittedProgressState = progress.state;
      }
      return;
    }

    // Progress update: throttle to PROGRESS_THROTTLE_MS interval
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastProgressEmitTime;

    if (timeSinceLastEmit >= PROGRESS_THROTTLE_MS) {
      // Enough time has passed, send immediately
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: text,
          progress: progress,
        }
      );

      this.lastProgressEmitTime = now;
      if (progress && progress.state) {
        this.lastEmittedProgressState = progress.state;
      }
    } else {
      // Too soon, store as pending
      this.pendingProgressMessage = {
        text: text,
        progress: progress,
      };

      // Set timer if not already set
      if (!this.progressFlushTimer) {
        const remainingTime = PROGRESS_THROTTLE_MS - timeSinceLastEmit;
        this.progressFlushTimer = setTimeout(() => {
          this.flushPendingProgressMessage();
          this.progressFlushTimer = null;
        }, remainingTime);
      }
    }
  }

  flushPendingProgressMessage() {
    if (!this.pendingProgressMessage) {
      return;
    }

    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'download',
      'downloadProgress',
      this.pendingProgressMessage
    );

    this.lastProgressEmitTime = Date.now();
    const { progress } = this.pendingProgressMessage;
    if (progress && progress.state) {
      this.lastEmittedProgressState = progress.state;
    }
    this.pendingProgressMessage = null;
  }

  // Flush any pending throttled message before the final status broadcast.
  dispose() {
    // Flush first so the remainder still gets classified.
    this.flushStderr();
    this.disposed = true;
    this.stopHeartbeat();
    if (this.progressFlushTimer) {
      clearTimeout(this.progressFlushTimer);
      this.progressFlushTimer = null;
    }
    this.flushPendingProgressMessage();
  }
}

module.exports = YtdlpOutputRouter;
