// Routes yt-dlp stdout/stderr output to the monitor, error tracker, and
// timeout controller, tracks per-run detection state (bot detection, HTTP 403,
// partial destinations, stderr buffer), and owns throttled downloadProgress
// WebSocket emission. One instance per yt-dlp run.
const path = require('path');
const logger = require('../../logger');
const MessageEmitter = require('../messageEmitter');
const filesystem = require('../filesystem');
const { JobVideoDownload } = require('../../models');
const { VIDEO_PERSISTED_MARKER } = require('../constants/outputMarkers');

const PROGRESS_THROTTLE_MS = 250;

class YtdlpOutputRouter {
  constructor({ jobId, config, monitor, errorTracker, timeoutController, cookiesEnabled = false }) {
    this.jobId = jobId;
    this.config = config;
    this.monitor = monitor;
    this.errorTracker = errorTracker;
    this.timeoutController = timeoutController;
    // Branches the mid-run 403/bot hints: with cookies enabled, "set cookies"
    // is exactly the wrong advice (stale cookies are the usual cause).
    this.cookiesEnabled = cookiesEnabled;
    // Per-run detection state, read by the executor/finalizer after exit
    this.partialDestinations = new Set();
    this.stderrBuffer = '';
    this.botDetected = false;
    this.httpForbiddenDetected = false;
    this.cookiesSuggestionEmitted = false;
    // WebSocket message throttling for progress updates
    this.lastProgressEmitTime = 0;
    this.pendingProgressMessage = null;
    this.progressFlushTimer = null;
    this.lastEmittedProgressState = null;
  }

  handleStdoutChunk(chunk) {
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
              this.errorTracker.trackVideoStart(idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4]);
              logger.debug({ currentVideoId: this.errorTracker.currentVideoId, url }, 'Tracking video extraction');
            }
          }
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

        const lowerLine = line.toLowerCase();
        if (!this.httpForbiddenDetected && (lowerLine.includes('http error 403') || lowerLine.includes('403: forbidden'))) {
          this.httpForbiddenDetected = true;
          this.emitCookiesSuggestion();
        }
      });
  }

  handleStderrChunk(data) {
    const dataStr = data.toString();
    this.stderrBuffer += dataStr;
    logger.info({ source: 'yt-dlp-stderr' }, dataStr);

    const lowerData = dataStr.toLowerCase();
    if (!this.httpForbiddenDetected && (lowerData.includes('http error 403') || lowerData.includes('403: forbidden'))) {
      this.httpForbiddenDetected = true;
      this.emitCookiesSuggestion();
    }

    // Detect and track ERROR messages from stderr. Node streams can
    // coalesce multiple lines into one chunk, so iterate per line rather
    // than running a single regex over the whole chunk (which would only
    // catch the first ERROR: occurrence).
    if (dataStr.includes('ERROR:')) {
      dataStr
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('ERROR:'))
        .forEach(line => {
          this.errorTracker.handleErrorLine(line, 'stderr');
        });
    }

    // Check for bot detection message (handle different quote types and patterns)
    if (dataStr.includes('Sign in to confirm') && dataStr.includes('not a bot')) {
      this.botDetected = true;
      const botMessage = this.cookiesEnabled
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
    const message = this.cookiesEnabled
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
        errorCode: this.cookiesEnabled ? 'COOKIES_MAY_BE_STALE' : 'COOKIES_RECOMMENDED'
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
    if (this.progressFlushTimer) {
      clearTimeout(this.progressFlushTimer);
      this.progressFlushTimer = null;
    }
    this.flushPendingProgressMessage();
  }
}

module.exports = YtdlpOutputRouter;
