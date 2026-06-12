const { spawn } = require('child_process');
const path = require('path');
const configModule = require('../configModule');
const plexModule = require('../plexModule');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const DownloadProgressMonitor = require('./DownloadProgressMonitor');
const VideoMetadataProcessor = require('./videoMetadataProcessor');
const tempPathManager = require('./tempPathManager');
const { isSpecificUrlDownloadJob } = require('./jobTypes');
const downloadRunTracker = require('./downloadRunTracker');
const { JobVideoDownload } = require('../../models');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const logger = require('../../logger');
const filesystem = require('../filesystem');
const { buildYtdlpEnv } = require('./ytdlpEnvBuilder');
const DownloadTimeoutController = require('./DownloadTimeoutController');
const { YtdlpErrorTracker } = require('./YtdlpErrorTracker');
const {
  computeOutcomeFlags,
  describeNonZeroExit,
  resolveTerminalStatus,
  resolveFinalPresentation,
  buildJobDataPayload
} = require('./downloadStatusResolver');

// yt-dlp writes certain warnings to stderr that do not indicate a problem with
// the download: the media still downloads and yt-dlp exits 0. These must not
// flip a successful job to "Complete with Warnings".
const BENIGN_STDERR_WARNING_PATTERNS = [
  // Emitted while fetching subtitles when no curl_cffi impersonation target is
  // installed. The subtitle still downloads; the message is purely advisory.
  /WARNING:.*extractor specified to use impersonation/i,
  // Emitted because our output template (-o) is an absolute temp path, so
  // yt-dlp ignores the --paths temp: redirect. The download still succeeds.
  /WARNING:.*--paths is ignored since an absolute path is given/i,
];

class DownloadExecutor {
  constructor() {
    this.tempChannelsFile = null;
    // Timeout configuration
    this.activityTimeoutMs = 30 * 60 * 1000; // 30 minutes of no activity (default)
    this.postProcessingTimeoutMs = 60 * 60 * 1000; // 60 minutes for post-processing operations
    this.maxAbsoluteTimeoutMs = 6 * 60 * 60 * 1000; // 6 hours maximum runtime
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
    return filesystem.extractYoutubeIdFromPath(filePath);
  }

  // Helper function to remove a channel directory if it's empty
  // Delegates to the shared directoryManager implementation
  async cleanupEmptyChannelDirectory(channelDir) {
    await filesystem.cleanupEmptyChannelDirectory(channelDir, configModule.directoryPath);
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
              // Flat mode (no video subfolder) - only delete files matching the youtube ID
              const youtubeId = videoDownload.youtube_id;
              logger.info({ youtubeId, dirPath }, 'Flat structure detected, cleaning up individual files');

              const dirFiles = await fsPromises.readdir(dirPath);
              for (const fileName of dirFiles) {
                // Match files by YouTube ID: bracketed form [ID] is the yt-dlp default;
                // dash form " - ID" is a fallback for non-standard naming patterns
                if (fileName.includes(`[${youtubeId}]`) || fileName.includes(` - ${youtubeId}`)) {
                  const fullPath = path.join(dirPath, fileName);
                  try {
                    const stats = await fsPromises.stat(fullPath);
                    if (stats.isFile()) {
                      await fsPromises.unlink(fullPath);
                      logger.info({ fileName }, 'Removed file (flat mode)');
                    }
                  } catch (fileError) {
                    logger.error({ err: fileError, fileName }, 'Error removing file (flat mode)');
                  }
                }
              }
              cleanedAny = true;
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
          if (readDirError.code === 'ENOENT') {
            logger.debug({ err: readDirError, dir }, 'Partial file directory already removed');
          } else {
            logger.error({ err: readDirError, dir }, 'Error reading directory');
          }
        }
      } catch (error) {
        logger.error({ err: error, file }, 'Error cleaning up partial files');
      }
    }
  }

  // True when everything yt-dlp wrote to stderr is known-benign warnings (or
  // whitespace). Used to avoid flagging a clean, exit-0 download as "Complete
  // with Warnings" over informational noise like the subtitle impersonation
  // notice. Returns false for empty stderr so callers keep their own guard.
  stderrHasOnlyBenignWarnings(stderrBuffer = '') {
    const lines = String(stderrBuffer)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return false;
    }

    return lines.every((line) =>
      BENIGN_STDERR_WARNING_PATTERNS.some((pattern) => pattern.test(line))
    );
  }

  // Fire-and-forget persistence so we don't block the stdout/stderr stream
  // handlers. Internal try/catch ensures the returned Promise always resolves,
  // so callers don't trigger unhandledRejection warnings when they don't await.
  async persistMembersOnlyAvailability(youtubeId) {
    if (!youtubeId) return;
    try {
      await ChannelVideo.update(
        { availability: 'subscriber_only' },
        { where: { youtube_id: youtubeId } },
      );
    } catch (err) {
      logger.warn({ err, youtubeId }, 'Failed to persist subscriber_only availability after download error');
    }
  }

  // Stamps terminated_at once and always clears auto_download_enabled_tabs.
  // Returns null if the channel is missing or the update fails.
  async persistTerminatedChannel(channelId) {
    if (!channelId) return null;
    try {
      const channel = await Channel.findOne({ where: { channel_id: channelId } });
      if (!channel) {
        logger.warn({ channelId }, 'Terminated channel not in DB; skipping persistence');
        return null;
      }
      await channel.update({
        terminated_at: channel.terminated_at || new Date(),
        auto_download_enabled_tabs: ''
      });
      return channel;
    } catch (err) {
      logger.warn({ err, channelId }, 'Failed to persist terminated channel state');
      return null;
    }
  }

  async persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList) {
    if (!videoData || videoData.length === 0) {
      return;
    }

    const currentJob = jobModule.getJob(jobId);
    if (!currentJob) {
      logger.warn({ jobId }, 'Unable to persist completed videos before terminal update; job not found');
      return;
    }

    currentJob.data = currentJob.data || {};
    currentJob.data.videos = videoData;
    currentJob.data.failedVideos = failedVideosList || [];
    await jobModule.saveJobOnly(jobId, currentJob);
  }

  async saveIntermediateGroupResults(jobId, output, videoData, failedVideosList, skippedCount, extraFields = {}, terminatedChannelsForGroup = [], terminationFailuresForGroup = []) {
    const currentJob = jobModule.getJob(jobId);
    if (!currentJob) {
      logger.warn({ jobId }, 'Unable to merge intermediate group results; job not found');
      return;
    }

    const existingVideos = currentJob.data?.videos || [];
    const existingFailedVideos = currentJob.data?.failedVideos || [];
    const existingSkippedCount = currentJob.data?.cumulativeSkipped || 0;
    const existingTerminated = currentJob.data?.terminatedChannels || [];
    const existingFailures = currentJob.data?.terminationFailures || [];

    // First write wins so original uploader/url/date stick across groups.
    const seenChannelIds = new Set(existingTerminated.map(c => c.channelId));
    const mergedTerminated = [...existingTerminated];
    for (const entry of (terminatedChannelsForGroup || [])) {
      if (!entry || !entry.channelId || seenChannelIds.has(entry.channelId)) continue;
      seenChannelIds.add(entry.channelId);
      mergedTerminated.push(entry);
    }

    // Dedupe failures by channel id across groups.
    const mergedFailures = Array.from(new Set([...existingFailures, ...(terminationFailuresForGroup || [])]));

    await jobModule.updateJob(jobId, {
      output: output,
      ...extraFields,
      data: {
        videos: [...existingVideos, ...(videoData || [])],
        failedVideos: [...existingFailedVideos, ...(failedVideosList || [])],
        cumulativeSkipped: existingSkippedCount + (skippedCount || 0),
        terminatedChannels: mergedTerminated,
        terminationFailures: mergedFailures
      },
    });

    const updatedJob = jobModule.getJob(jobId);
    if (updatedJob && updatedJob.data && updatedJob.data.videos) {
      await jobModule.saveJobOnly(jobId, updatedJob);
    }
  }

  /**
   * Verify the output directory is writable before starting a download.
   * Catches stale NFS mounts and permission issues early, before yt-dlp
   * downloads to temp and contaminates the archive with un-movable entries.
   *
   * @param {string} outputDir - The output directory path to check
   * @param {number} timeoutMs - Maximum time to wait (default: 10s, for hung NFS)
   * @returns {Promise<void>}
   * @throws {Error} If the directory is not writable or the check times out
   */
  async checkOutputDirectoryHealth(outputDir, timeoutMs = 10000) {
    if (!outputDir) {
      throw new Error('Output directory path is not configured (directoryPath is undefined)');
    }

    const fsPromises = require('fs').promises;
    const crypto = require('crypto');
    const testFile = path.join(outputDir, `.youtarr_healthcheck_${crypto.randomUUID()}`);

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(
        `Output directory health check timed out after ${timeoutMs / 1000}s — the filesystem may be unresponsive (stale NFS mount?)`
      )), timeoutMs);
    });

    let fileWritten = false;
    try {
      await Promise.race([
        (async () => {
          await fsPromises.writeFile(testFile, 'healthcheck');
          fileWritten = true;
          await fsPromises.unlink(testFile);
        })(),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timer);
      // Best-effort cleanup if the file was written but unlink didn't complete
      // (e.g. timeout fired between writeFile and unlink)
      if (fileWritten) {
        fsPromises.unlink(testFile).catch(() => {});
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

  // Specific-URL jobs normalize to youtu.be form; otherwise diff the archive against the pre-run count.
  resolveUrlsToProcess(jobType, originalUrls, initialCount) {
    let urlsToProcess;
    if (isSpecificUrlDownloadJob(jobType) && originalUrls) {
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
    return urlsToProcess;
  }

  // Backfills URLs into errorTracker.failedVideos (read later by reconcileArchive),
  // then splits videoData into successful vs failed by file presence.
  partitionDownloadResults(videoData, errorTracker, urlsToProcess) {
    for (const url of urlsToProcess) {
      const videoId = url.split('youtu.be/')[1]?.trim().split('?')[0].split('&')[0];
      if (videoId && errorTracker.failedVideos.has(videoId)) {
        const failureInfo = errorTracker.failedVideos.get(videoId);
        failureInfo.url = url;
        errorTracker.failedVideos.set(videoId, failureInfo);
      }
    }

    const successfulVideos = [];
    const failedVideosList = [];

    for (const video of videoData) {
      // Check if this video was explicitly marked as failed during download
      const wasMarkedFailed = errorTracker.failedVideos.has(video.youtubeId);

      // Check if video or audio file actually exists and has size
      // For video_mp3 mode: both fileSize and audioFileSize will be set
      // For mp3_only mode: only audioFileSize will be set
      // For standard video: only fileSize will be set
      const hasVideoFile = video.fileSize && video.fileSize !== 'null' && video.fileSize !== '0';
      const hasAudioFile = video.audioFileSize && video.audioFileSize !== 'null' && video.audioFileSize !== '0';
      const hasAnyFile = hasVideoFile || hasAudioFile;

      if (wasMarkedFailed || !hasAnyFile) {
        const failureInfo = errorTracker.failedVideos.get(video.youtubeId) || {
          youtubeId: video.youtubeId,
          error: hasAnyFile ? 'Unknown error' : 'Media file not found or incomplete',
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
          hasVideoFile,
          hasAudioFile
        }, 'Download failed');
      } else {
        successfulVideos.push(video);
      }
    }

    // For any videos in failedVideos that weren't in videoData, add them to failedVideosList
    for (const [youtubeId, failureInfo] of errorTracker.failedVideos) {
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

    return { successfulVideos, failedVideosList };
  }

  async reconcileArchive({ allowRedownload, failedVideosList, videoData, errorTracker }) {
    // Remove failed videos from the yt-dlp archive so they can be retried on the next run.
    // yt-dlp writes to the archive BEFORE calling --exec (the post-processor), so when
    // the post-processor fails (e.g. EACCES on NFS move), the video is stuck as archived
    // but never actually made it to the final location. Without this cleanup, the video
    // would be permanently skipped with "already been recorded in the archive".
    if (!allowRedownload && failedVideosList.length > 0) {
      const archiveModule = require('../archiveModule');
      for (const failedVideo of failedVideosList) {
        if (failedVideo.youtubeId) {
          // Only remove from archive if the video was explicitly marked as failed during download.
          // Videos classified as "failed" solely because stat/waitForFile couldn't confirm the file
          // (e.g. NFS lag) may actually exist on disk; removing them would cause spurious re-downloads.
          const wasExplicitlyFailed = errorTracker.failedVideos.has(failedVideo.youtubeId);
          if (!wasExplicitlyFailed) {
            logger.info({ youtubeId: failedVideo.youtubeId }, 'Skipping archive removal - video was not explicitly failed (file may exist but stat failed)');
            continue;
          }
          const removed = await archiveModule.removeVideoFromArchive(failedVideo.youtubeId);
          if (removed) {
            logger.info({ youtubeId: failedVideo.youtubeId }, 'Removed failed video from archive for retry on next run');
          }
        }
      }
    }

    // If allowRedownload is true, we need to manually update the archive since yt-dlp won't
    if (allowRedownload && videoData.length > 0) {
      const archiveModule = require('../archiveModule');
      logger.debug({ videoCount: videoData.length }, 'Updating archive for videos (allowRedownload was true)');

      for (const video of videoData) {
        // Check for either video file or audio file (supports mp3_only mode)
        const fileToCheck = video.filePath || video.audioFilePath;
        if (video.youtubeId && fileToCheck) {
          // Only add to archive if the file actually exists (was successfully downloaded)
          const fs = require('fs');
          if (fs.existsSync(fileToCheck)) {
            await archiveModule.addVideoToArchive(video.youtubeId);
          } else {
            logger.debug({ youtubeId: video.youtubeId }, 'Skipping archive update - file not found');
          }
        }
      }
    }
  }

  // Post-completion cleanup, poster backfill, playlist hooks, Plex refresh, and
  // next-job kickoff. Deliberately fire-and-forget except poster backfill.
  async runCompletionSideEffects({ jobId, videoData, skipJobTransition }) {
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

    // Trigger playlist M3U regeneration and media-server sync for any playlists
    // that contain videos from this download batch.
    if (videoData && videoData.length > 0) {
      const downloadedIds = videoData.map((v) => v.youtubeId).filter(Boolean);
      if (downloadedIds.length > 0) {
        require('../downloadModule').afterDownloadHook(downloadedIds).catch((err) => {
          logger.error({ err }, 'afterDownloadHook failed');
        });
      }
    }

    // Only refresh Plex and start next job if not processing multiple groups
    if (!skipJobTransition) {
      // Derive the set of subfolders from where each video actually ended up
      // on disk. This mirrors reality (the post-processor may have placed
      // each video under its channel-specific sub_folder) instead of relying
      // on the job-level subfolderOverride, which is null for typical
      // manual URL and non-grouped channel downloads.
      const baseDir = configModule.directoryPath;
      const subfoldersInUse = new Set();
      for (const video of (videoData || [])) {
        const mediaPath = video.filePath || video.audioFilePath;
        if (!mediaPath) continue;
        subfoldersInUse.add(filesystem.extractSubfolderFromAbsPath(mediaPath, baseDir));
      }

      if (subfoldersInUse.size > 0) {
        // Defensive: refreshLibrary currently swallows errors internally
        plexModule.refreshLibrariesForSubfolders([...subfoldersInUse]).catch(err => {
          logger.error({ err }, 'Failed to refresh Plex libraries');
        });
      }

      jobModule.startNextJob().catch(err => {
        logger.error({ err }, 'Failed to start next job');
      });
    }
  }

  async doDownload(args, jobId, jobType, urlCount = 0, originalUrls = null, allowRedownload = false, skipJobTransition = false, postProcessDirectives = {}) {
    const subfolderOverride = (postProcessDirectives || {}).subfolderOverride ?? null;
    const initialCount = this.getCountOfDownloadedVideos();
    const config = configModule.getConfig();
    const monitor = new DownloadProgressMonitor(jobId, jobType);

    // Capture the run id up front: terminal updateJob() calls replace job.data
    // with a fresh object that omits runId, so reading it at completion would
    // always be undefined. The run owns the aggregated summary for its jobs.
    const ownerJob = jobModule.getJob(jobId);
    const runId = ownerJob && ownerJob.data ? ownerJob.data.runId : null;

    // For specific URL-list downloads (manual or playlist), the video count is
    // known upfront, so seed the progress total instead of letting yt-dlp's
    // per-URL "item 1 of 1" output drive it.
    if (isSpecificUrlDownloadJob(jobType) && urlCount > 0) {
      monitor.videoCount.total = urlCount;
    }

    // Clean temp directory before starting download if temp downloads are enabled
    try {
      await tempPathManager.cleanTempDirectory();
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning temp directory before job start');
      // Continue anyway - don't fail the job just because cleanup failed
    }

    // Pre-flight health check: verify output directory is writable before downloading.
    // Catches stale NFS mounts early, before yt-dlp downloads to temp and adds to archive.
    try {
      await this.checkOutputDirectoryHealth(configModule.directoryPath);
    } catch (error) {
      const errorMsg = `Output directory is not accessible: ${error.message}`;
      logger.error({ err: error, outputDir: configModule.directoryPath }, errorMsg);

      await jobModule.updateJob(jobId, {
        status: 'Error',
        endDate: Date.now(),
        output: errorMsg,
        notes: 'The output directory could not be written to. If using NFS, check that the mount is healthy (not stale). See Youtarr docs for NFS mount recommendations.',
      });

      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: errorMsg,
          progress: monitor.snapshot('error'),
          error: true
        }
      );

      if (!skipJobTransition) {
        jobModule.startNextJob().catch(err => {
          logger.error({ err }, 'Failed to start next job');
        });
      }

      return;
    }

    return new Promise((resolve, reject) => {
      logger.info({ jobType, args, subfolderOverride }, 'Running yt-dlp');
      const procEnv = buildYtdlpEnv({
        jobId,
        tempBasePath: tempPathManager.getTempBasePath(),
        postProcessDirectives,
      });

      const proc = spawn('yt-dlp', args, { env: procEnv });

      // Store process reference for manual termination
      this.currentProcess = proc;
      this.currentJobId = jobId;

      const timeoutController = new DownloadTimeoutController({
        activityTimeoutMs: this.activityTimeoutMs,
        postProcessingTimeoutMs: this.postProcessingTimeoutMs,
        maxAbsoluteTimeoutMs: this.maxAbsoluteTimeoutMs,
      });
      timeoutController.start(proc);

      const partialDestinations = new Set();
      let httpForbiddenDetected = false;
      let cookiesSuggestionEmitted = false;
      // Node may emit both 'error' and 'exit' for the same process (e.g. a
      // failed kill() emits 'error' while the process runs on and exits
      // later). Whichever handler runs first owns finalization; the other
      // must not run, or the job gets finalized twice and startNextJob can
      // launch a second concurrent download.
      let finalized = false;

      const errorTracker = new YtdlpErrorTracker({
        persistMembersOnlyAvailability: (id) => this.persistMembersOnlyAvailability(id),
        persistTerminatedChannel: (id) => this.persistTerminatedChannel(id),
        emitWarningMessage: (text) => {
          MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', {
            text,
            progress: monitor.snapshot('warning'),
            warning: true
          });
        },
      });

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

            timeoutController.noteLine(line);

            // Track current video being processed
            if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
              const urlMatch = line.match(/\[youtube\] Extracting URL: (.+)/);
              if (urlMatch) {
                const url = urlMatch[1].trim();
                // Extract video ID from URL
                const idMatch = url.match(/[?&]v=([^&]+)|youtu\.be\/([^?&]+)|\/watch\/([^?&]+)|\/([a-zA-Z0-9_-]{10,12})$/);
                if (idMatch) {
                  errorTracker.trackVideoStart(idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4]);
                  logger.debug({ currentVideoId: errorTracker.currentVideoId, url }, 'Tracking video extraction');
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
                    errorTracker.trackVideoFromDestination(youtubeId);
                    logger.debug({ currentVideoId: errorTracker.currentVideoId, destPath }, 'Updated current video ID from destination');
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

            // Suppress the line when errorTracker.handleErrorLine consumed it
            // (expected skip or termination).
            let suppressErrorLine = false;
            if (line.includes('ERROR:')) {
              suppressErrorLine = errorTracker.handleErrorLine(line, 'stdout');
            }

            if (suppressErrorLine) {
              return;
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
                timeoutController.noteActivity();
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
              errorTracker.handleErrorLine(line, 'stderr');
            });
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
        if (finalized) return;
        finalized = true;
        // True once the job's terminal status has been persisted; the catch
        // below must not overwrite it with 'Error' for failures that happen
        // after that point (broadcast, run tracking, completion side effects).
        let terminalUpdateDone = false;
        try {
          timeoutController.stop();

          if (this.forceKillTimeout) {
            clearTimeout(this.forceKillTimeout);
            this.forceKillTimeout = null;
          }

          if (this.progressFlushTimer) {
            clearTimeout(this.progressFlushTimer);
            this.progressFlushTimer = null;
          }
          this.flushPendingProgressMessage();

          // Check for manual termination before clearing references
          const wasManuallyTerminated = this.manualTerminationReason !== null;
          const manualReason = this.manualTerminationReason;

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

          // Wait for terminated-channel lookups before deriving finalState.
          await errorTracker.settlePersistence();

          const urlsToProcess = this.resolveUrlsToProcess(jobType, originalUrls, initialCount);

          const videoCount = urlsToProcess.length;
          let videoData = await VideoMetadataProcessor.processVideoMetadata(urlsToProcess);

          const { successfulVideos, failedVideosList } = this.partitionDownloadResults(videoData, errorTracker, urlsToProcess);
          // Use successful videos for further processing (archive, database, etc.)
          videoData = successfulVideos;

          await this.reconcileArchive({ allowRedownload, failedVideosList, videoData, errorTracker });

          logger.info({ jobType, jobId }, 'Job complete (with or without errors)');

          const flags = computeOutcomeFlags({
            code,
            expectedSkipCount: errorTracker.expectedSkipCount,
            terminatedChannelCount: errorTracker.terminatedChannelIds.size,
            failedCount: failedVideosList.length,
            unexpectedErrorCount: errorTracker.unexpectedErrorCount,
            botDetected,
            httpForbiddenDetected
          });

          const dataPayload = buildJobDataPayload({
            videoData,
            failedVideosList,
            terminatedChannels: errorTracker.terminatedChannels,
            terminatedChannelIds: errorTracker.terminatedChannelIds,
            terminationFailures: errorTracker.terminationFailures
          });

          if (errorTracker.terminatedChannelIds.size > 0) {
            logger.warn({ terminatedChannels: errorTracker.terminatedChannels }, 'Channels marked terminated during this job');
          }

          let status = '';
          let output = '';
          let jobErrorCode;

          if (botDetected) {
            status = 'Error';
            output = 'Bot detection encountered. Please set cookies in your Configuration.';

            await this.persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);
            await jobModule.updateJob(jobId, {
              status: status,
              endDate: Date.now(),
              output: output,
              data: dataPayload,
              notes: 'YouTube requires authentication. Enable cookies in Configuration to resolve this issue.',
              error: 'COOKIES_REQUIRED'
            });
            jobErrorCode = 'COOKIES_REQUIRED';
          } else if (timeoutController.shutdownInProgress || timeoutController.shutdownReason || wasManuallyTerminated) {
            // Handle timeout/graceful shutdown or manual termination
            await this.cleanupInProgressVideos(jobId);

            const completedCount = videoData.length;
            status = 'Terminated';
            output = `${completedCount} video${completedCount !== 1 ? 's' : ''} completed before termination`;

            const terminationReason = wasManuallyTerminated
              ? manualReason
              : (timeoutController.shutdownReason || 'Download terminated due to timeout');

            // Persist videos to DB before updateJob reloads them from DB.
            await this.persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

            await jobModule.updateJob(jobId, {
              status: status,
              endDate: Date.now(),
              output: output,
              data: dataPayload,
              notes: terminationReason,
            });

            logger.info({ terminationReason, completedCount, failedCount: failedVideosList.length }, 'Job terminated, saved completed videos');
          } else if (code !== 0) {
            // Download actually failed (non-zero exit code)
            await this.cleanupPartialFiles(Array.from(partialDestinations));

            const failureDetails = monitor.lastParsed || null;

            const nonZero = describeNonZeroExit({
              code,
              signal,
              videoCount,
              videoDataCount: videoData.length,
              terminatedChannelCount: errorTracker.terminatedChannelIds.size,
              httpForbiddenDetected,
              flags,
              failureDetails
            });
            status = nonZero.status;
            output = nonZero.output;

            if (nonZero.errorCode) {
              jobErrorCode = nonZero.errorCode;
            }

            if (skipJobTransition) {
              await this.saveIntermediateGroupResults(
                jobId,
                output,
                videoData,
                failedVideosList,
                monitor.videoCount.skipped || 0,
                {
                  notes: nonZero.notes,
                  ...(nonZero.errorCode ? { error: nonZero.errorCode } : {})
                },
                [...errorTracker.terminatedChannels],
                [...errorTracker.terminationFailures]
              );
            } else {
              await this.persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);
              const terminalStatus = resolveTerminalStatus({
                status: nonZero.status,
                flags,
                terminatedChannelCount: errorTracker.terminatedChannelIds.size,
                hasPartialSuccess: nonZero.hasPartialSuccess
              });
              await jobModule.updateJob(jobId, {
                status: terminalStatus,
                endDate: Date.now(),
                output: output,
                data: dataPayload,
                notes: nonZero.notes,
                ...(nonZero.errorCode ? { error: nonZero.errorCode } : {})
              });
            }
          } else if (stderrBuffer && !monitor.hasError && !this.stderrHasOnlyBenignWarnings(stderrBuffer)) {
            status = 'Complete with Warnings';
            output = `${videoCount} videos.`;
            // Intermediate group: just save videos, don't mark complete yet.
            if (skipJobTransition) {
              await this.saveIntermediateGroupResults(
                jobId,
                output,
                videoData,
                failedVideosList,
                monitor.videoCount.skipped || 0,
                {},
                [...errorTracker.terminatedChannels],
                [...errorTracker.terminationFailures]
              );
            } else {
              // Persist videos to DB before updateJob reloads them from DB.
              await this.persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

              await jobModule.updateJob(jobId, {
                status: status,
                output: output,
                data: dataPayload,
              });
            }
          } else {
            // Upgrade to warning shape when terminations were recorded.
            if (errorTracker.terminatedChannelIds.size > 0) {
              status = 'Complete with Warnings';
              output = `${videoCount} videos, ${errorTracker.terminatedChannelIds.size} channel${errorTracker.terminatedChannelIds.size !== 1 ? 's' : ''} marked terminated.`;
            } else {
              status = 'Complete';
              output = `${videoCount} videos.`;
            }
            // Intermediate group: just save videos, don't mark complete yet.
            if (skipJobTransition) {
              await this.saveIntermediateGroupResults(
                jobId,
                output,
                videoData,
                failedVideosList,
                monitor.videoCount.skipped || 0,
                {},
                [...errorTracker.terminatedChannels],
                [...errorTracker.terminationFailures]
              );
            } else {
              // Persist videos to DB before updateJob reloads them from DB.
              await this.persistCompletedVideosBeforeTerminalUpdate(jobId, videoData, failedVideosList);

              await jobModule.updateJob(jobId, {
                status: status,
                output: output,
                data: dataPayload,
              });
            }
          }

          // Every branch above ends in exactly one terminal persist
          // (updateJob or saveIntermediateGroupResults).
          terminalUpdateDone = true;

          const wasTerminated = Boolean(timeoutController.shutdownInProgress || timeoutController.shutdownReason || wasManuallyTerminated);
          const presentation = resolveFinalPresentation({
            code,
            jobErrorCode,
            wasTerminated,
            terminationReason: wasManuallyTerminated ? manualReason : timeoutController.shutdownReason,
            botDetected,
            monitorHasError: monitor.hasError,
            flags,
            videoDataCount: videoData.length,
            failedCount: failedVideosList.length,
            skippedCount: monitor.videoCount.skipped || 0,
            terminatedChannelCount: errorTracker.terminatedChannelIds.size,
            terminationFailureCount: errorTracker.terminationFailures.length,
            videoCount,
            monitorCompletedCount: monitor.videoCount.completed,
            unexpectedErrorCount: errorTracker.unexpectedErrorCount,
            httpForbiddenDetected
          });
          const { debugFlags } = presentation;

          logger.debug({
            code,
            hasProcessedVideos: debugFlags.hasProcessedVideos,
            hasDownloadedNewVideos: debugFlags.hasDownloadedNewVideos,
            isWarningOnly: debugFlags.isWarningOnly,
            hasError: monitor.hasError,
            hasFailures: debugFlags.hasFailures,
            hasSuccesses: debugFlags.hasSuccesses,
            hasNonFatalPartialSuccess: debugFlags.hasNonFatalPartialSuccess,
            expectedSkipCount: errorTracker.expectedSkipCount,
            unexpectedErrorCount: errorTracker.unexpectedErrorCount,
            hasOnlyExpectedSkips: flags.hasOnlyExpectedSkips,
            hasOnlyHandledErrors: flags.hasOnlyHandledErrors,
            terminatedChannelCount: errorTracker.terminatedChannelIds.size,
            successCount: videoData.length,
            failureCount: failedVideosList.length,
            finalState: debugFlags.finalState
          }, 'Final state determination');

          const { finalState, finalText, finalErrorCode } = presentation;

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

          // When this job belongs to a run, the run owns the summary and notification.
          const runActive = !skipJobTransition && downloadRunTracker.isActive(runId);

          // Only include finalSummary if this is the final completion (not an intermediate group)
          // For multi-group downloads, skipJobTransition=true means more groups are coming
          if (!skipJobTransition && !runActive) {
            finalPayload.finalSummary = {
              // Use actual videoData.length for successful downloads
              totalDownloaded: videoData.length,
              totalSkipped: monitor.videoCount.skipped || 0,
              totalFailed: failedVideosList.length,
              totalMembersOnly: errorTracker.membersOnlyVideoIds.size,
              totalTerminatedChannels: errorTracker.terminatedChannelIds.size,
              totalTerminationFailures: errorTracker.terminationFailures.length,
              failedVideos: failedVideosList,
              terminatedChannels: [...errorTracker.terminatedChannels],
              terminationFailures: [...errorTracker.terminationFailures],
              jobType: jobType,
              completedAt: new Date().toISOString()
            };
          }

          if (finalState === 'terminated') {
            // Terminated jobs are warnings, not full errors
            finalPayload.warning = true;
            finalPayload.terminationReason = wasManuallyTerminated ? manualReason : timeoutController.shutdownReason;
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

          // Fold this job's totals into the run; it emits one aggregated summary + notification when its last job finishes.
          if (runActive) {
            downloadRunTracker.recordJobResult(runId, jobId, {
              totalDownloaded: videoData.length,
              totalSkipped: monitor.videoCount.skipped || 0,
              totalFailed: failedVideosList.length,
              totalMembersOnly: errorTracker.membersOnlyVideoIds.size,
              failedVideos: failedVideosList,
              terminatedChannels: [...errorTracker.terminatedChannels],
              terminationFailures: [...errorTracker.terminationFailures],
              videoData: videoData,
              jobType,
            });
          }

          // Send notification if download was successful and notifications are enabled
          // Skip notifications for intermediate groups (only send for final completion)
          if ((finalState === 'complete' || finalState === 'warning') && !isFinalError && !skipJobTransition && !runActive) {
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

          await this.runCompletionSideEffects({ jobId, videoData, skipJobTransition });
          resolve();
        } catch (err) {
          // Finalization failed partway (e.g. DB outage). Without this catch the
          // promise never settles, the job stays 'In Progress' forever, and the
          // queue stalls.
          logger.error({ err, jobId }, 'Unexpected error finalizing download job');
          if (!terminalUpdateDone) {
            await jobModule.updateJob(jobId, {
              status: 'Error',
              endDate: Date.now(),
              output: 'Job finalization error: ' + err.message,
            }).catch((dbErr) => logger.debug({ err: dbErr, jobId }, 'Best-effort error update failed'));
          }
          if (!skipJobTransition) {
            jobModule.startNextJob().catch(err2 => {
              logger.error({ err: err2 }, 'Failed to start next job');
            });
          }
          // Resolve, not reject: the outer .catch would double-update the job.
          resolve();
        }
      });

      proc.on('error', async (err) => {
        if (finalized) return;
        finalized = true;
        timeoutController.stop();

        if (this.forceKillTimeout) {
          clearTimeout(this.forceKillTimeout);
          this.forceKillTimeout = null;
        }

        if (this.progressFlushTimer) {
          clearTimeout(this.progressFlushTimer);
          this.progressFlushTimer = null;
        }
        this.flushPendingProgressMessage();

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

      // This catch block only handles spawn/process errors rejected via
      // proc.on('error'); the exit handler catches its own finalization errors
      await jobModule.updateJob(jobId, {
        status: 'Error',
        endDate: Date.now(),
        output: 'Download process error: ' + error.message,
      }).catch((err) => {
        logger.error({ err, jobId }, 'Failed to mark job as errored after process error');
      });

      if (!skipJobTransition) {
        jobModule.startNextJob().catch(err => {
          logger.error({ err }, 'Failed to start next job');
        });
      }
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
