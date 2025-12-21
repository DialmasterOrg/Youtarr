const { spawn } = require('child_process');
const path = require('path');
const configModule = require('../configModule');
const plexModule = require('../plexModule');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const DownloadProgressMonitor = require('./DownloadProgressMonitor');
const VideoMetadataProcessor = require('./videoMetadataProcessor');
const tempPathManager = require('./tempPathManager');
const { JobVideoDownload } = require('../../models');
const Channel = require('../../models/channel');
const logger = require('../../logger');
const filesystem = require('../filesystem');

class DownloadExecutor {
  constructor() {
    this.tempChannelsFile = null;
    // Timeout configuration
    this.activityTimeoutMs = 30 * 60 * 1000; // 30 minutes of no activity (default)
    this.postProcessingTimeoutMs = 60 * 60 * 1000; // 60 minutes for post-processing operations
    this.maxAbsoluteTimeoutMs = 6 * 60 * 60 * 1000; // 6 hours maximum runtime
    this.currentActivityTimeout = this.activityTimeoutMs; // Track current timeout duration
    // Current process tracking for manual termination
    this.currentProcess = null;
    this.currentJobId = null;
    this.manualTerminationReason = null;
    this.forceKillTimeout = null;
    // WebSocket message throttling for progress updates
    this.lastProgressEmitTime = 0;
    this.pendingProgressMessage = null;
    this.progressFlushTimer = null;
    this.lastEmittedProgressState = null;
    this.PROGRESS_THROTTLE_MS = 250; // Throttle progress updates to 250ms intervals
  }

  getCountOfDownloadedVideos() {
    const archive = require('../archiveModule');
    return archive.readCompleteListLines().length;
  }

  getNewVideoUrls(initialCount) {
    const archive = require('../archiveModule');
    return archive.getNewVideoUrlsSince(initialCount);
  }

  // Helper function to extract YouTube ID from file path
  // Expects format: "...Channel - Title [VideoID].ext" or "...Channel - Title - VideoID/..."
  extractYoutubeIdFromPath(filePath) {
    try {
      const filename = path.basename(filePath);
      // Try to extract from [VideoID].ext pattern
      const bracketMatch = filename.match(/\[([a-zA-Z0-9_-]{10,12})\]/);
      if (bracketMatch) {
        return bracketMatch[1];
      }

      // Try to extract from directory name ending with " - VideoID"
      const dirname = path.basename(path.dirname(filePath));
      const dashMatch = dirname.match(/ - ([a-zA-Z0-9_-]{10,12})$/);
      if (dashMatch) {
        return dashMatch[1];
      }

      return null;
    } catch (error) {
      logger.error({ err: error, filePath }, 'Error extracting youtube ID from path');
      return null;
    }
  }

  // Helper function to remove a channel directory if it's empty
  // This is called after removing a video directory to clean up empty channel folders
  async cleanupEmptyChannelDirectory(channelDir) {
    const fsPromises = require('fs').promises;

    try {
      // Verify this is actually a channel directory (not root or subfolder)
      if (!filesystem.isChannelDirectory(channelDir, configModule.directoryPath)) {
        logger.debug({ channelDir }, 'Not a channel directory, skipping cleanup');
        return;
      }

      // Check if directory exists
      const exists = await fsPromises.access(channelDir).then(() => true).catch(() => false);
      if (!exists) {
        logger.debug({ channelDir }, 'Channel directory does not exist');
        return;
      }

      // Check if directory is empty
      const isEmpty = await filesystem.isDirectoryEmpty(channelDir);
      if (!isEmpty) {
        logger.debug({ channelDir }, 'Channel directory not empty, keeping it');
        return;
      }

      // Remove empty channel directory
      await fsPromises.rmdir(channelDir);
      logger.info({ channelDir }, 'Removed empty channel directory');
    } catch (error) {
      logger.error({ err: error, channelDir }, 'Error cleaning up empty channel directory');
      // Don't throw - this is a best-effort cleanup
    }
  }

  // Cleanup function for in-progress videos based on database tracking
  async cleanupInProgressVideos(jobId) {
    const fsPromises = require('fs').promises;

    try {
      // Query database for in-progress videos for this job
      const inProgressVideos = await JobVideoDownload.findAll({
        where: {
          job_id: jobId,
          status: 'in_progress'
        }
      });

      if (inProgressVideos.length === 0) {
        logger.info('No in-progress videos to clean up');
        return;
      }

      logger.info({ count: inProgressVideos.length }, 'Cleaning up in-progress videos');

      for (const videoDownload of inProgressVideos) {
        const videoDir = videoDownload.file_path;

        try {
          // Check both final location and temp location for incomplete downloads
          const pathsToCheck = [videoDir];
          // Only convert to temp path if not already a temp path (avoids double-nesting)
          if (!tempPathManager.isTempPath(videoDir)) {
            const tempDir = tempPathManager.convertFinalToTemp(videoDir);
            pathsToCheck.push(tempDir);
          }

          let cleanedAny = false;
          let foundExistingPath = false;

          for (const dirPath of pathsToCheck) {
            // Verify directory exists and is a video-specific directory
            const dirExists = await fsPromises.access(dirPath).then(() => true).catch(() => false);
            if (!dirExists) {
              logger.info({ dirPath }, 'Directory does not exist');
              continue;
            }

            foundExistingPath = true;

            if (!filesystem.isVideoDirectory(dirPath)) {
              logger.info({ dirPath }, 'Skipping non-video directory');
              continue;
            }

            logger.info({ youtubeId: videoDownload.youtube_id, dirPath }, 'Cleaning up in-progress video');

            // Remove all files in the directory
            const dirFiles = await fsPromises.readdir(dirPath);
            for (const fileName of dirFiles) {
              const fullPath = path.join(dirPath, fileName);
              try {
                const stats = await fsPromises.stat(fullPath);
                if (stats.isFile()) {
                  await fsPromises.unlink(fullPath);
                  logger.info({ fileName }, 'Removed file');
                } else if (stats.isDirectory()) {
                  await fsPromises.rm(fullPath, { recursive: true, force: true });
                  logger.info({ fileName }, 'Removed subdirectory');
                }
              } catch (fileError) {
                logger.error({ err: fileError, fileName }, 'Error removing file');
              }
            }

            // Remove the now-empty video directory
            await fsPromises.rmdir(dirPath);
            logger.info({ dirPath }, 'Successfully removed video directory');
            cleanedAny = true;

            // Check if parent channel directory is now empty and should be removed
            const channelDir = path.dirname(dirPath);
            await this.cleanupEmptyChannelDirectory(channelDir);
          }

          if (!foundExistingPath) {
            logger.info({ youtubeId: videoDownload.youtube_id }, 'All candidate directories already removed');
            await videoDownload.destroy();
            continue;
          }

          // Remove the tracking entry from database if we cleaned any paths
          if (cleanedAny) {
            await videoDownload.destroy();
          }
        } catch (error) {
          logger.error({ err: error, youtubeId: videoDownload.youtube_id }, 'Error cleaning up video');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error querying in-progress videos for cleanup');
    }
  }

  // Legacy cleanup function for .part and fragment files (still used for non-fatal errors)
  async cleanupPartialFiles(files) {
    const fsPromises = require('fs').promises;

    for (const file of files) {
      try {
        const dir = path.dirname(file);

        // Check for partial files
        const partFile = file + '.part';

        // Remove .part file
        if (await fsPromises.access(partFile).then(() => true).catch(() => false)) {
          await fsPromises.unlink(partFile);
          logger.info({ partFile }, 'Cleaned up partial file');
        }

        // Remove fragment files
        try {
          const dirFiles = await fsPromises.readdir(dir);
          const basename = path.basename(file).replace(/\.[^.]+$/, '');

          for (const f of dirFiles) {
            if (f.startsWith(basename + '.f')) {
              await fsPromises.unlink(path.join(dir, f));
              logger.info({ fragment: f }, 'Cleaned up fragment');
            }
          }
        } catch (readDirError) {
          logger.error({ err: readDirError, dir }, 'Error reading directory');
        }
      } catch (error) {
        logger.error({ err: error, file }, 'Error cleaning up partial files');
      }
    }
  }

  /**
   * Determine if a message should bypass throttling and be sent immediately
   * Important messages include state changes, errors, warnings, and completion events
   * @param {string} line - The raw line from yt-dlp
   * @param {object|null} structuredProgress - Parsed progress from monitor
   * @returns {boolean} - True if message is important and should be sent immediately
   */
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

  /**
   * Emit progress message with throttling for non-important updates
   * Important messages are sent immediately, progress updates are throttled to PROGRESS_THROTTLE_MS
   * @param {string} text - The message text to emit
   * @param {object|null} progress - The structured progress object
   */
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

    if (timeSinceLastEmit >= this.PROGRESS_THROTTLE_MS) {
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
        const remainingTime = this.PROGRESS_THROTTLE_MS - timeSinceLastEmit;
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

  async doDownload(args, jobId, jobType, urlCount = 0, originalUrls = null, allowRedownload = false, skipJobTransition = false, subfolderOverride = null) {
    const initialCount = this.getCountOfDownloadedVideos();
    const config = configModule.getConfig();
    const monitor = new DownloadProgressMonitor(jobId, jobType);

    // Reset activity timeout to default at start of each job
    this.currentActivityTimeout = this.activityTimeoutMs;

    // For manual URL downloads, set the total count upfront
    if (jobType === 'Manually Added Urls' && urlCount > 0) {
      monitor.videoCount.total = urlCount;
    }

    // Clean temp directory before starting download if temp downloads are enabled
    try {
      await tempPathManager.cleanTempDirectory();
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning temp directory before job start');
      // Continue anyway - don't fail the job just because cleanup failed
    }

    return new Promise((resolve, reject) => {
      logger.info({ jobType, args, subfolderOverride }, 'Running yt-dlp');
      const proc = spawn('yt-dlp', args, {
        env: {
          ...process.env,
          YOUTARR_JOB_ID: jobId,
          TMPDIR: '/tmp',
          // Pass subfolder override to post-processor (empty string means no override)
          ...(subfolderOverride !== null && subfolderOverride !== undefined
            ? { YOUTARR_SUBFOLDER_OVERRIDE: subfolderOverride }
            : {})
        }
      });

      // Store process reference for manual termination
      this.currentProcess = proc;
      this.currentJobId = jobId;

      // Activity-based timeout tracking
      let lastActivityTime = Date.now();
      const jobStartTime = Date.now();
      let timeoutChecker = null;
      let gracefulShutdownInProgress = false;
      let shutdownReason = null;

      const resetActivityTimer = () => {
        lastActivityTime = Date.now();
      };

      const checkTimeout = () => {
        const now = Date.now();
        const timeSinceActivity = now - lastActivityTime;
        const totalRuntime = now - jobStartTime;

        if (timeSinceActivity > this.currentActivityTimeout) {
          return {
            timeout: true,
            reason: `No download activity for ${Math.round(timeSinceActivity / 60000)} minutes`
          };
        }

        if (totalRuntime > this.maxAbsoluteTimeoutMs) {
          return {
            timeout: true,
            reason: `Maximum runtime limit of ${Math.round(this.maxAbsoluteTimeoutMs / 3600000)} hours reached`
          };
        }

        return { timeout: false };
      };

      const initiateGracefulShutdown = (reason) => {
        if (gracefulShutdownInProgress) return;
        gracefulShutdownInProgress = true;
        shutdownReason = reason;

        logger.info({ reason }, 'Initiating graceful shutdown');

        // Send SIGTERM to allow process to finish current video
        try {
          proc.kill('SIGTERM');
        } catch (err) {
          logger.error({ err }, 'Error sending SIGTERM');
        }

        // Wait up to 60 seconds for graceful exit, then force kill
        setTimeout(() => {
          if (proc.exitCode === null && proc.signalCode === null) {
            logger.info('Grace period expired, forcing kill with SIGKILL');
            try {
              proc.kill('SIGKILL');
            } catch (err) {
              logger.error({ err }, 'Error sending SIGKILL');
            }
          }
        }, 60 * 1000);
      };

      // Check timeout periodically (every minute)
      timeoutChecker = setInterval(() => {
        const check = checkTimeout();
        if (check.timeout) {
          clearInterval(timeoutChecker);
          timeoutChecker = null;
          initiateGracefulShutdown(check.reason);
        }
      }, 60 * 1000); // Check every minute

      // Initial activity
      resetActivityTimer();

      const partialDestinations = new Set();
      let httpForbiddenDetected = false;
      let cookiesSuggestionEmitted = false;

      // Track failed videos with their error messages
      const failedVideos = new Map(); // youtubeId -> { url, error, youtubeId }
      let currentVideoId = null; // Track the current video being processed
      let lastErrorMessage = null; // Store the last error message seen

      const emitCookiesSuggestionMessage = () => {
        if (cookiesSuggestionEmitted) {
          return;
        }
        cookiesSuggestionEmitted = true;
        const message = 'HTTP 403 detected: YouTube may be blocking requests. If download fails, try setting cookies in Configuration.';
        // Don't set monitor.hasError here - let the final exit code determine success/failure
        // 403s on HLS fragments are often recoverable and don't indicate actual failure
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          {
            text: message,
            progress: monitor.snapshot('warning'),
            warning: true,
            errorCode: 'COOKIES_RECOMMENDED'
          }
        );
      };

      // Emit initial state so the UI reflects the job start immediately
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: 'Initiating download...',
          progress: monitor.snapshot('initiating'),
          clearPreviousSummary: true
        }
      );

      proc.stdout.on('data', (chunk) => {
        chunk
          .toString()
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
            logger.info({ source: 'yt-dlp' }, line);

            // Track activity indicators and reset timeout
            // For post-processing start patterns, extend timeout to 60 minutes
            const isPostProcessingStart = line.includes('[Merger]') ||
                                          line.includes('[Metadata]') ||
                                          line.includes('[MoveFiles]') ||
                                          line.includes('[ModifyChapters]') ||
                                          line.includes('[ExtractAudio]');

            const isDownloadActivity = line.includes('[download]') ||
                                       line.includes('Downloading item');

            if (isPostProcessingStart) {
              this.currentActivityTimeout = this.postProcessingTimeoutMs;
              resetActivityTimer();
              logger.info({ timeout: '60 minutes' }, 'Post-processing detected, extended inactivity timeout');
            } else if (isDownloadActivity) {
              // Reset to normal 30-minute timeout when download activity resumes
              if (this.currentActivityTimeout !== this.activityTimeoutMs) {
                this.currentActivityTimeout = this.activityTimeoutMs;
                logger.debug({ timeout: '30 minutes' }, 'Download activity resumed, reset to normal timeout');
              }
              resetActivityTimer();
            } else if (line.includes('[SubtitlesConvertor]') ||
                       line.includes('[ThumbnailsConvertor]') ||
                       line.includes('Deleting original file')) {
              // Other activity - just reset timer, keep current timeout
              resetActivityTimer();
            }

            // Track current video being processed
            if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
              const urlMatch = line.match(/\[youtube\] Extracting URL: (.+)/);
              if (urlMatch) {
                const url = urlMatch[1].trim();
                // Extract video ID from URL
                const idMatch = url.match(/[?&]v=([^&]+)|youtu\.be\/([^?&]+)|\/watch\/([^?&]+)|\/([a-zA-Z0-9_-]{10,12})$/);
                if (idMatch) {
                  currentVideoId = idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4];
                  logger.debug({ currentVideoId, url }, 'Tracking video extraction');
                  // Clear any previous error for this video
                  lastErrorMessage = null;
                }
              }
            }

            // Track destination files for cleanup
            if (line.startsWith('[download] Destination:')) {
              const destPath = line.replace('[download] Destination:', '').trim();
              if (destPath) {
                partialDestinations.add(destPath);

                // Create tracking entry for any video download
                const youtubeId = this.extractYoutubeIdFromPath(destPath);
                if (youtubeId) {
                  // Update current video ID if we can extract it from the path
                  if (filesystem.isMainVideoFile(destPath)) {
                    currentVideoId = youtubeId;
                    logger.debug({ currentVideoId, destPath }, 'Updated current video ID from destination');
                  }

                  const videoDir = path.dirname(destPath);
                  JobVideoDownload.findOrCreate({
                    where: {
                      job_id: jobId,
                      youtube_id: youtubeId
                    },
                    defaults: {
                      job_id: jobId,
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

            // Detect and track ERROR messages
            if (line.includes('ERROR:')) {
              const errorMatch = line.match(/ERROR:\s*(.+)/);
              if (errorMatch) {
                lastErrorMessage = errorMatch[1].trim();
                logger.warn({ error: lastErrorMessage, currentVideoId }, 'Error detected during download');

                // Associate error with current video if we know which video is being processed
                if (currentVideoId && !failedVideos.has(currentVideoId)) {
                  failedVideos.set(currentVideoId, {
                    youtubeId: currentVideoId,
                    error: lastErrorMessage,
                    url: null // Will be populated later from urlsToProcess
                  });
                  logger.info({ youtubeId: currentVideoId, error: lastErrorMessage }, 'Recorded video failure');
                }
              }
            }

            // Always try to process for state updates
            let structuredProgress = monitor.processProgress('{}', line, config);

            // Parse JSON progress if available
            const jsonStart = line.indexOf('{');
            if (jsonStart !== -1) {
              const jsonPortion = line.slice(jsonStart);
              const jsonProgress = monitor.processProgress(jsonPortion, line, config);
              if (jsonProgress) {
                structuredProgress = jsonProgress;
                // Reset timer on actual progress updates
                resetActivityTimer();
              }
            }

            // Use throttled message emission (250ms for progress, immediate for important messages)
            this.emitProgressMessage(line, structuredProgress || monitor.lastParsed || null);

            const lowerLine = line.toLowerCase();
            if (!httpForbiddenDetected && (lowerLine.includes('http error 403') || lowerLine.includes('403: forbidden'))) {
              httpForbiddenDetected = true;
              emitCookiesSuggestionMessage();
            }
          });
      });

      let stderrBuffer = '';
      let botDetected = false;
      proc.stderr.on('data', (data) => {
        const dataStr = data.toString();
        stderrBuffer += dataStr;
        logger.info({ source: 'yt-dlp-stderr' }, dataStr);

        const lowerData = dataStr.toLowerCase();
        if (!httpForbiddenDetected && (lowerData.includes('http error 403') || lowerData.includes('403: forbidden'))) {
          httpForbiddenDetected = true;
          emitCookiesSuggestionMessage();
        }

        // Detect and track ERROR messages from stderr
        if (dataStr.includes('ERROR:')) {
          const errorMatch = dataStr.match(/ERROR:\s*(.+)/);
          if (errorMatch) {
            lastErrorMessage = errorMatch[1].trim();
            logger.warn({ error: lastErrorMessage, currentVideoId }, 'Error detected in stderr');

            // Associate error with current video if we know which video is being processed
            if (currentVideoId && !failedVideos.has(currentVideoId)) {
              failedVideos.set(currentVideoId, {
                youtubeId: currentVideoId,
                error: lastErrorMessage,
                url: null // Will be populated later from urlsToProcess
              });
              logger.info({ youtubeId: currentVideoId, error: lastErrorMessage }, 'Recorded video failure from stderr');
            }
          }
        }

        // Check for bot detection message (handle different quote types and patterns)
        if (dataStr.includes('Sign in to confirm') && dataStr.includes('not a bot')) {
          botDetected = true;
          MessageEmitter.emitMessage(
            'broadcast',
            null,
            'download',
            'downloadProgress',
            {
              text: 'Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.',
              progress: monitor.snapshot('bot_detected'),
              error: true
            }
          );
        }
      });

      proc.on('exit', async (code, signal) => {
        // Clean up timeout checker
        if (timeoutChecker) {
          clearInterval(timeoutChecker);
          timeoutChecker = null;
        }

        // Clear force kill timeout if it exists
        if (this.forceKillTimeout) {
          clearTimeout(this.forceKillTimeout);
          this.forceKillTimeout = null;
        }

        // Clear pending progress timer if it exists
        if (this.progressFlushTimer) {
          clearTimeout(this.progressFlushTimer);
          this.progressFlushTimer = null;
        }
        this.flushPendingProgressMessage();

        // Check for manual termination before clearing references
        const wasManuallyTerminated = this.manualTerminationReason !== null;
        const manualReason = this.manualTerminationReason;

        // Reset activity timeout to default for next job
        this.currentActivityTimeout = this.activityTimeoutMs;

        // Clear current process references
        this.currentProcess = null;
        this.currentJobId = null;
        this.manualTerminationReason = null;

        // Also check the complete stderr buffer for bot detection
        if (!botDetected && stderrBuffer &&
            stderrBuffer.includes('Sign in to confirm') &&
            stderrBuffer.includes('not a bot')) {
          botDetected = true;
          logger.info('Bot detection found in stderr buffer');
        }

        if (!httpForbiddenDetected && stderrBuffer) {
          const lowerStderr = stderrBuffer.toLowerCase();
          if (lowerStderr.includes('http error 403') || lowerStderr.includes('403: forbidden')) {
            httpForbiddenDetected = true;
            logger.info('HTTP 403 detected in stderr buffer');
            emitCookiesSuggestionMessage();
          }
        }

        let urlsToProcess;
        if (jobType === 'Manually Added Urls' && originalUrls) {
          urlsToProcess = originalUrls.map(url => {
            // Convert full YouTube URLs to youtu.be format for consistency
            if (url.includes('youtube.com/watch?v=')) {
              const videoId = url.split('v=')[1].split('&')[0];
              logger.debug({ url, convertedUrl: `https://youtu.be/${videoId}` }, 'Converting YouTube URL format');
              return `https://youtu.be/${videoId}`;
            }
            return url;
          });
        } else {
          urlsToProcess = this.getNewVideoUrls(initialCount);
        }

        // Populate URLs in failedVideos Map
        for (const url of urlsToProcess) {
          const videoId = url.split('youtu.be/')[1]?.trim().split('?')[0].split('&')[0];
          if (videoId && failedVideos.has(videoId)) {
            const failureInfo = failedVideos.get(videoId);
            failureInfo.url = url;
            failedVideos.set(videoId, failureInfo);
          }
        }

        const videoCount = urlsToProcess.length;
        let videoData = await VideoMetadataProcessor.processVideoMetadata(urlsToProcess);

        // Separate successful videos (with actual video files) from failed videos
        const successfulVideos = [];
        const failedVideosList = [];

        for (const video of videoData) {
          // Check if this video was explicitly marked as failed during download
          const wasMarkedFailed = failedVideos.has(video.youtubeId);

          // Check if video file actually exists and has size
          const hasVideoFile = video.fileSize && video.fileSize !== 'null' && video.fileSize !== '0';

          if (wasMarkedFailed || !hasVideoFile) {
            // This video failed
            const failureInfo = failedVideos.get(video.youtubeId) || {
              youtubeId: video.youtubeId,
              error: hasVideoFile ? 'Unknown error' : 'Video file not found or incomplete',
              url: urlsToProcess.find(u => u.includes(video.youtubeId))
            };

            failedVideosList.push({
              youtubeId: video.youtubeId,
              title: video.youTubeVideoName,
              channel: video.youTubeChannelName,
              error: failureInfo.error,
              url: failureInfo.url
            });

            logger.warn({
              youtubeId: video.youtubeId,
              error: failureInfo.error,
              hasVideoFile
            }, 'Video download failed');
          } else {
            // This video succeeded
            successfulVideos.push(video);
          }
        }

        // For any videos in failedVideos that weren't in videoData, add them to failedVideosList
        for (const [youtubeId, failureInfo] of failedVideos) {
          if (!videoData.find(v => v.youtubeId === youtubeId)) {
            failedVideosList.push({
              youtubeId: youtubeId,
              title: 'Unknown',
              channel: 'Unknown',
              error: failureInfo.error,
              url: failureInfo.url
            });
            logger.warn({ youtubeId, error: failureInfo.error }, 'Video failed without metadata');
          }
        }

        // Use successful videos for further processing (archive, database, etc.)
        videoData = successfulVideos;

        // If allowRedownload is true, we need to manually update the archive since yt-dlp won't
        if (allowRedownload && videoData.length > 0) {
          const archiveModule = require('../archiveModule');
          logger.debug({ videoCount: videoData.length }, 'Updating archive for videos (allowRedownload was true)');

          for (const video of videoData) {
            if (video.youtubeId && video.filePath) {
              // Only add to archive if the video file actually exists (was successfully downloaded)
              const fs = require('fs');
              if (fs.existsSync(video.filePath)) {
                await archiveModule.addVideoToArchive(video.youtubeId);
              } else {
                logger.debug({ youtubeId: video.youtubeId }, 'Skipping archive update - file not found');
              }
            }
          }
        }

        logger.info({ jobType, jobId }, 'Job complete (with or without errors)');

        let status = '';
        let output = '';
        let jobErrorCode;

        // Check for bot detection first
        if (botDetected) {
          status = 'Error';
          output = 'Bot detection encountered. Please set cookies in your Configuration.';

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: {
              videos: videoData || [],
              failedVideos: failedVideosList || []
            },
            notes: 'YouTube requires authentication. Enable cookies in Configuration to resolve this issue.',
            error: 'COOKIES_REQUIRED'
          });
          jobErrorCode = 'COOKIES_REQUIRED';
        } else if (gracefulShutdownInProgress || shutdownReason || wasManuallyTerminated) {
          // Handle timeout/graceful shutdown or manual termination
          await this.cleanupInProgressVideos(jobId);

          const completedCount = videoData.length;
          status = 'Terminated';
          output = `${completedCount} video${completedCount !== 1 ? 's' : ''} completed before termination`;

          const terminationReason = wasManuallyTerminated
            ? manualReason
            : (shutdownReason || 'Download terminated due to timeout');

          // Persist videos to DB BEFORE calling updateJob
          // This ensures videos are in DB before updateJob reloads from DB
          if (videoData && videoData.length > 0) {
            const currentJob = jobModule.getJob(jobId);
            if (currentJob) {
              currentJob.data = currentJob.data || {};
              currentJob.data.videos = videoData;
              currentJob.data.failedVideos = failedVideosList || [];
              await jobModule.saveJobOnly(jobId, currentJob);
            }
          }

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: {
              videos: videoData || [],
              failedVideos: failedVideosList || []
            },
            notes: terminationReason,
          });

          logger.info({ terminationReason, completedCount, failedCount: failedVideosList.length }, 'Job terminated, saved completed videos');
        } else if (code !== 0) {
          // Download actually failed (non-zero exit code)
          await this.cleanupPartialFiles(Array.from(partialDestinations));

          const failureDetails = monitor.lastParsed || null;

          status = signal === 'SIGKILL' ? 'Killed' : 'Error';

          // Provide more helpful error messages based on what we detected
          if (httpForbiddenDetected) {
            // Failed with 403 errors - likely authentication issue
            output = `${videoCount} videos. Error: YouTube returned HTTP 403 (Forbidden)`;
            const notes = 'YouTube denied access (HTTP 403). Configure cookies in Settings to resolve this issue.';
            await jobModule.updateJob(jobId, {
              status: status,
              endDate: Date.now(),
              output: output,
              data: {
                videos: videoData || [],
                failedVideos: failedVideosList || []
              },
              notes: notes,
              error: 'COOKIES_RECOMMENDED'
            });
            jobErrorCode = 'COOKIES_RECOMMENDED';
          } else {
            // Failed with other error
            output = `${videoCount} videos. Error: Command exited with code ${code}`;

            // Add stall detection note if applicable
            const notes = failureDetails && failureDetails.stalled
              ? `Stall detected at ${failureDetails.progress.percent.toFixed(1)}% (${Math.round(
                failureDetails.progress.speedBytesPerSecond / 1024
              )} KiB/s)`
              : `Download failed (${signal || `exit ${code}`})`;

            await jobModule.updateJob(jobId, {
              status: status,
              endDate: Date.now(),
              output: output,
              data: {
                videos: videoData || [],
                failedVideos: failedVideosList || []
              },
              notes: notes,
            });
          }
        } else if (stderrBuffer && !monitor.hasError) {
          status = 'Complete with Warnings';
          output = `${videoCount} videos.`;
          // When skipJobTransition is true, we're processing multiple groups
          // Don't mark as complete yet - just save the videos
          if (skipJobTransition) {
            // For multi-group downloads, accumulate videos, failedVideos and skipped counts
            const currentJob = jobModule.getJob(jobId);
            const existingVideos = currentJob?.data?.videos || [];
            const existingFailedVideos = currentJob?.data?.failedVideos || [];
            const existingSkippedCount = currentJob?.data?.cumulativeSkipped || 0;

            await jobModule.updateJob(jobId, {
              output: output,
              data: {
                videos: [...existingVideos, ...videoData],
                failedVideos: [...existingFailedVideos, ...(failedVideosList || [])],
                cumulativeSkipped: existingSkippedCount + (monitor.videoCount.skipped || 0)
              },
            });

            // Persist accumulated videos to DB immediately for resilience
            const updatedJob = jobModule.getJob(jobId);
            if (updatedJob && updatedJob.data && updatedJob.data.videos) {
              await jobModule.saveJobOnly(jobId, updatedJob);
            }
          } else {
            // For manual/single downloads, persist to DB BEFORE calling updateJob
            // This ensures videos are in DB before updateJob reloads from DB
            if (videoData && videoData.length > 0) {
              const currentJob = jobModule.getJob(jobId);
              if (currentJob) {
                currentJob.data = currentJob.data || {};
                currentJob.data.videos = videoData;
                currentJob.data.failedVideos = failedVideosList || [];
                await jobModule.saveJobOnly(jobId, currentJob);
              }
            }

            await jobModule.updateJob(jobId, {
              status: status,
              output: output,
              data: {
                videos: videoData,
                failedVideos: failedVideosList || []
              },
            });
          }
        } else {
          status = 'Complete';
          output = `${videoCount} videos.`;
          // When skipJobTransition is true, we're processing multiple groups
          // Don't mark as complete yet - just save the videos
          if (skipJobTransition) {
            // For multi-group downloads, accumulate videos, failedVideos and skipped counts
            const currentJob = jobModule.getJob(jobId);
            const existingVideos = currentJob?.data?.videos || [];
            const existingFailedVideos = currentJob?.data?.failedVideos || [];
            const existingSkippedCount = currentJob?.data?.cumulativeSkipped || 0;

            await jobModule.updateJob(jobId, {
              output: output,
              data: {
                videos: [...existingVideos, ...videoData],
                failedVideos: [...existingFailedVideos, ...(failedVideosList || [])],
                cumulativeSkipped: existingSkippedCount + (monitor.videoCount.skipped || 0)
              },
            });

            // Persist accumulated videos to DB immediately for resilience
            const updatedJob = jobModule.getJob(jobId);
            if (updatedJob && updatedJob.data && updatedJob.data.videos) {
              await jobModule.saveJobOnly(jobId, updatedJob);
            }
          } else {
            // For manual/single downloads, persist to DB BEFORE calling updateJob
            // This ensures videos are in DB before updateJob reloads from DB
            if (videoData && videoData.length > 0) {
              const currentJob = jobModule.getJob(jobId);
              if (currentJob) {
                currentJob.data = currentJob.data || {};
                currentJob.data.videos = videoData;
                currentJob.data.failedVideos = failedVideosList || [];
                await jobModule.saveJobOnly(jobId, currentJob);
              }
            }

            await jobModule.updateJob(jobId, {
              status: status,
              output: output,
              data: {
                videos: videoData,
                failedVideos: failedVideosList || []
              },
            });
          }
        }

        // Consider it successful if:
        // - Exit code is 0 (normal success), OR
        // - Exit code is 1 with stderr warnings but videos were processed (yt-dlp returns 1 for warnings)
        // - We found new video files that were downloaded
        // Only treat as real error if exit code > 1, was killed, or nothing was processed
        const hasProcessedVideos = (monitor.videoCount.completed > 0 || monitor.videoCount.skipped > 0);
        const hasDownloadedNewVideos = videoCount > 0;
        const isWarningOnly = (code === 1 && !monitor.hasError && (hasProcessedVideos || hasDownloadedNewVideos));

        // If videos failed but some succeeded, treat as warning rather than complete error
        const hasFailures = failedVideosList.length > 0;
        const hasSuccesses = videoData.length > 0;

        let finalState;
        if (code === 0 || isWarningOnly) {
          // Exit code was successful, but check for partial failures
          finalState = hasFailures ? 'warning' : 'complete';
        } else {
          finalState = 'error';
        }

        logger.debug({
          code,
          hasProcessedVideos,
          hasDownloadedNewVideos,
          isWarningOnly,
          hasError: monitor.hasError,
          hasFailures,
          hasSuccesses,
          successCount: videoData.length,
          failureCount: failedVideosList.length,
          finalState
        }, 'Final state determination');

        // Create a more informative final message
        let finalText;
        let finalErrorCode = jobErrorCode;
        if (gracefulShutdownInProgress || shutdownReason || wasManuallyTerminated) {
          finalState = 'terminated';
          const completedCount = videoData.length;
          const reason = wasManuallyTerminated ? manualReason : shutdownReason;
          finalText = `Download terminated: ${reason}. ${completedCount} video${completedCount !== 1 ? 's' : ''} completed successfully.`;
        } else if (botDetected) {
          finalState = 'failed';
          finalErrorCode = 'COOKIES_REQUIRED';
          finalText = 'Download failed: Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.';
        } else if (monitor.hasError && finalState === 'complete') {
          finalState = 'error';
          finalText = 'Download failed';
        } else if (finalState === 'complete' || finalState === 'warning') {
          const actualCount = videoData.length;
          const skippedCount = monitor.videoCount.skipped || 0;
          const failedCount = failedVideosList.length;

          // Build message parts
          const parts = [];
          if (actualCount > 0) {
            parts.push(`${actualCount} video${actualCount !== 1 ? 's' : ''} downloaded`);
          }
          if (failedCount > 0) {
            parts.push(`${failedCount} failed`);
          }
          if (skippedCount > 0) {
            parts.push(`${skippedCount} already existed`);
          }

          if (parts.length > 0) {
            const statusText = finalState === 'warning' ? 'completed with errors' : 'completed';
            finalText = `Download ${statusText}: ${parts.join(', ')}`;
          } else {
            finalText = 'Download completed: No new videos to download';
          }
        } else {
          finalText = 'Download failed';
        }

        // Make sure final counts are accurate
        if (monitor.videoCount.completed === 0 && videoData.length > 0 && (finalState === 'complete' || finalState === 'warning')) {
          monitor.videoCount.completed = videoData.length;
        }

        const isFinalError = finalState !== 'complete' && finalState !== 'warning';
        const finalProgress = monitor.snapshot(finalState);
        const finalPayload = {
          text: finalText,
          progress: finalProgress
        };

        // Only include finalSummary if this is the final completion (not an intermediate group)
        // For multi-group downloads, skipJobTransition=true means more groups are coming
        if (!skipJobTransition) {
          finalPayload.finalSummary = {
            // Use actual videoData.length for successful downloads
            totalDownloaded: videoData.length,
            totalSkipped: monitor.videoCount.skipped || 0,
            totalFailed: failedVideosList.length,
            failedVideos: failedVideosList,
            jobType: jobType,
            completedAt: new Date().toISOString()
          };
        }

        if (finalState === 'terminated') {
          // Terminated jobs are warnings, not full errors
          finalPayload.warning = true;
          finalPayload.terminationReason = wasManuallyTerminated ? manualReason : shutdownReason;
        } else if (finalState === 'warning') {
          // Partial failures - some videos succeeded, some failed
          finalPayload.warning = true;
          if (finalErrorCode) {
            finalPayload.errorCode = finalErrorCode;
          }
        } else if (isFinalError) {
          // Complete failure
          finalPayload.error = true;
          if (finalErrorCode) {
            finalPayload.errorCode = finalErrorCode;
          }
        }

        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          finalPayload
        );

        // Send notification if download was successful and notifications are enabled
        // Skip notifications for intermediate groups (only send for final completion)
        if (finalState === 'complete' && !isFinalError && !skipJobTransition) {
          const notificationModule = require('../notificationModule');
          notificationModule.sendDownloadNotification({
            finalSummary: finalPayload.finalSummary,
            videoData: videoData,
            channelName: monitor.currentChannelName
          }).catch(err => {
            logger.error({ err }, 'Failed to send notification');
            // Continue execution - don't crash if notification fails
          });
        }

        // Clean up temporary channels file if it exists
        if (this.tempChannelsFile) {
          const fs = require('fs').promises;
          fs.unlink(this.tempChannelsFile)
            .then(() => {
              logger.info('Cleaned up temporary channels file');
              this.tempChannelsFile = null;
            })
            .catch((err) => {
              logger.error({ err }, 'Failed to clean up temp channels file');
            });
        }

        // Clean up all JobVideoDownload tracking entries for this job
        JobVideoDownload.destroy({
          where: { job_id: jobId }
        }).then(count => {
          if (count > 0) {
            logger.info({ count }, 'Cleaned up JobVideoDownload tracking entries');
          }
        }).catch(err => {
          logger.error({ err }, 'Error cleaning up JobVideoDownload entries');
        });

        // Backfill channel posters for channels with newly downloaded videos
        if (videoData && videoData.length > 0) {
          try {
            // Extract unique channel IDs from downloaded videos
            const uniqueChannelIds = [...new Set(
              videoData
                .map(v => v.channel_id)
                .filter(Boolean)
            )];

            if (uniqueChannelIds.length > 0) {
              const channelsToBackfill = await Channel.findAll({
                where: { channel_id: uniqueChannelIds }
              });

              if (channelsToBackfill.length > 0) {
                await require('../channelModule').backfillChannelPosters(channelsToBackfill);
                logger.info({ channelCount: channelsToBackfill.length }, 'Backfilled channel posters for downloaded videos');
              }
            }
          } catch (err) {
            logger.error({ err }, 'Error backfilling channel posters');
            // Don't fail the job if poster backfill fails
          }
        }

        // Only refresh Plex and start next job if not processing multiple groups
        if (!skipJobTransition) {
          plexModule.refreshLibrary().catch(err => {
            logger.error({ err }, 'Failed to refresh Plex library');
          });
          jobModule.startNextJob().catch(err => {
            logger.error({ err }, 'Failed to start next job');
          });
        }
        resolve();
      });

      proc.on('error', async (err) => {
        if (timeoutChecker) {
          clearInterval(timeoutChecker);
          timeoutChecker = null;
        }

        // Clear force kill timeout if it exists
        if (this.forceKillTimeout) {
          clearTimeout(this.forceKillTimeout);
          this.forceKillTimeout = null;
        }

        // Clear pending progress timer if it exists
        if (this.progressFlushTimer) {
          clearTimeout(this.progressFlushTimer);
          this.progressFlushTimer = null;
        }
        this.flushPendingProgressMessage();

        // Reset activity timeout to default for next job
        this.currentActivityTimeout = this.activityTimeoutMs;

        // Clear current process references
        this.currentProcess = null;
        this.currentJobId = null;

        await this.cleanupPartialFiles(Array.from(partialDestinations));
        reject(err);
      });
    }).catch(async (error) => {
      logger.error({ err: error }, 'Download process error');

      // Clean up temporary channels file on error
      if (this.tempChannelsFile) {
        const fs = require('fs').promises;
        fs.unlink(this.tempChannelsFile)
          .catch((err) => {
            logger.error({ err }, 'Failed to clean up temp channels file');
          });
        this.tempChannelsFile = null;
      }

      // This catch block is now only for unexpected errors, not timeouts
      // Timeouts are handled gracefully in the exit handler
      await jobModule.updateJob(jobId, {
        status: 'Error',
        output: 'Download process error: ' + error.message,
      });
    });
  }

  /**
   * Terminate the currently running download job
   * @param {string} reason - Reason for termination
   * @returns {string|null} - Job ID that was terminated, or null if no job running
   */
  terminateCurrentJob(reason = 'User requested termination') {
    if (!this.currentProcess || !this.currentJobId) {
      logger.info('No job currently running to terminate');
      return null;
    }

    const jobId = this.currentJobId;
    logger.info({ jobId, reason }, 'Terminating job');

    // Set the manual termination reason so the exit handler knows this was manual
    this.manualTerminationReason = reason;

    // Send SIGTERM to allow process to finish current video gracefully
    try {
      this.currentProcess.kill('SIGTERM');
      logger.info({ jobId }, 'Sent SIGTERM to job');

      // Clear any existing force kill timeout
      if (this.forceKillTimeout) {
        clearTimeout(this.forceKillTimeout);
        this.forceKillTimeout = null;
      }

      // Wait up to 60 seconds for graceful exit, then force kill
      this.forceKillTimeout = setTimeout(() => {
        if (this.currentProcess && this.currentJobId === jobId) {
          logger.info({ jobId }, 'Grace period expired, forcing kill with SIGKILL');
          try {
            this.currentProcess.kill('SIGKILL');
          } catch (err) {
            logger.error({ err }, 'Error sending SIGKILL');
          }
        }
        this.forceKillTimeout = null;
      }, 60 * 1000);

      return jobId;
    } catch (err) {
      logger.error({ err }, 'Error terminating job');
      // Clear the manual termination reason on error
      this.manualTerminationReason = null;
      return null;
    }
  }
}

module.exports = DownloadExecutor;
