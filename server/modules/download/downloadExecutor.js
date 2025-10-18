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

class DownloadExecutor {
  constructor() {
    this.tempChannelsFile = null;
    // Timeout configuration
    this.activityTimeoutMs = 30 * 60 * 1000; // 30 minutes of no activity
    this.maxAbsoluteTimeoutMs = 4 * 60 * 60 * 1000; // 4 hours maximum runtime
    // Current process tracking for manual termination
    this.currentProcess = null;
    this.currentJobId = null;
    this.manualTerminationReason = null;
    this.forceKillTimeout = null;
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

  // Helper function to check if a file path is a main video file (not fragments or thumbnails)
  isMainVideoFile(filePath) {
    const filename = path.basename(filePath);
    // Main video files end with [VideoID].mp4 or [VideoID].mkv (not .fXXX.mp4)
    return /\[[a-zA-Z0-9_-]{10,12}\]\.(mp4|mkv|webm)$/.test(filename) &&
           !/\.f\d+\.(mp4|m4a|webm)$/.test(filename);
  }

  // Helper function to check if a directory is a video-specific directory
  // Video directories follow the pattern: "ChannelName - VideoTitle - VideoID"
  // where VideoID is the last segment after the final " - " separator
  isVideoSpecificDirectory(dirPath) {
    try {
      const dirName = path.basename(dirPath);

      // Video directories end with " - <VideoID>" where VideoID is typically 11 chars
      // Pattern: something - something - videoId
      const parts = dirName.split(' - ');
      if (parts.length < 3) {
        return false; // Not enough segments to be a video directory
      }

      const potentialVideoId = parts[parts.length - 1];

      // YouTube video IDs are 11 characters, alphanumeric plus - and _
      // Allow 10-12 chars to be flexible with other platforms
      if (potentialVideoId.length >= 10 && potentialVideoId.length <= 12 &&
          /^[a-zA-Z0-9_-]+$/.test(potentialVideoId)) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ err: error }, 'Error checking if directory is video-specific');
      return false;
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
          // If temp downloads are enabled, also check temp location
          const pathsToCheck = [videoDir];
          if (tempPathManager.isEnabled()) {
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

            if (!this.isVideoSpecificDirectory(dirPath)) {
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

  async doDownload(args, jobId, jobType, urlCount = 0, originalUrls = null, allowRedownload = false) {
    const initialCount = this.getCountOfDownloadedVideos();
    const config = configModule.getConfig();
    const monitor = new DownloadProgressMonitor(jobId, jobType);

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
      logger.info({ jobType, args }, 'Running yt-dlp');
      const proc = spawn('yt-dlp', args, {
        env: {
          ...process.env,
          YOUTARR_JOB_ID: jobId
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

        if (timeSinceActivity > this.activityTimeoutMs) {
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
            // Reset on any download progress output
            if (line.includes('[download]') ||
                line.includes('[Merger]') ||
                line.includes('[MoveFiles]') ||
                line.includes('[Metadata]') ||
                line.includes('Downloading item')) {
              resetActivityTimer();
            }

            // Track destination files for cleanup
            if (line.startsWith('[download] Destination:')) {
              const destPath = line.replace('[download] Destination:', '').trim();
              if (destPath) {
                partialDestinations.add(destPath);

                // Create tracking entry for any video download
                const youtubeId = this.extractYoutubeIdFromPath(destPath);
                if (youtubeId) {
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

            MessageEmitter.emitMessage(
              'broadcast',
              null,
              'download',
              'downloadProgress',
              {
                text: line,
                progress: structuredProgress || monitor.lastParsed || null,
              }
            );

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

        // Check for manual termination before clearing references
        const wasManuallyTerminated = this.manualTerminationReason !== null;
        const manualReason = this.manualTerminationReason;

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

        const videoCount = urlsToProcess.length;
        let videoData = await VideoMetadataProcessor.processVideoMetadata(urlsToProcess);

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
            data: { videos: videoData || [] },
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

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: { videos: videoData || [] },
            notes: terminationReason,
          });

          logger.info({ terminationReason, completedCount }, 'Job terminated, saved completed videos');
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
              data: { videos: videoData || [] },
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
              data: { videos: videoData || [] },
              notes: notes,
            });
          }
        } else if (stderrBuffer && !monitor.hasError) {
          status = 'Complete with Warnings';
          output = `${videoCount} videos.`;
          jobModule.updateJob(jobId, {
            status: status,
            output: output,
            data: { videos: videoData },
          });
        } else {
          status = 'Complete';
          output = `${videoCount} videos.`;
          jobModule.updateJob(jobId, {
            status: status,
            output: output,
            data: { videos: videoData },
          });
        }

        // Consider it successful if:
        // - Exit code is 0 (normal success), OR
        // - Exit code is 1 with stderr warnings but videos were processed (yt-dlp returns 1 for warnings)
        // - We found new video files that were downloaded
        // Only treat as real error if exit code > 1, was killed, or nothing was processed
        const hasProcessedVideos = (monitor.videoCount.completed > 0 || monitor.videoCount.skipped > 0);
        const hasDownloadedNewVideos = videoCount > 0;
        const isWarningOnly = (code === 1 && !monitor.hasError && (hasProcessedVideos || hasDownloadedNewVideos));
        let finalState = (code === 0 || isWarningOnly) ? 'complete' : 'error';

        logger.debug({
          code,
          hasProcessedVideos,
          hasDownloadedNewVideos,
          isWarningOnly,
          hasError: monitor.hasError,
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
        } else if (finalState === 'complete') {
          const actualCount = monitor.videoCount.completed || videoCount;
          const skippedCount = monitor.videoCount.skipped || 0;
          if (actualCount > 0 && skippedCount > 0) {
            finalText = `Download completed: ${actualCount} new video${actualCount !== 1 ? 's' : ''} downloaded, ${skippedCount} already existed`;
          } else if (actualCount > 0) {
            finalText = `Download completed: ${actualCount} new video${actualCount !== 1 ? 's' : ''} downloaded`;
          } else if (skippedCount > 0) {
            finalText = `Download completed: All ${skippedCount} video${skippedCount !== 1 ? 's' : ''} already existed`;
          } else {
            finalText = 'Download completed: No new videos to download';
          }
        } else {
          finalText = 'Download failed';
        }

        // Make sure final counts are accurate
        if (monitor.videoCount.completed === 0 && videoCount > 0 && finalState === 'complete') {
          monitor.videoCount.completed = videoCount;
        }

        const isFinalError = finalState !== 'complete';
        const finalProgress = monitor.snapshot(finalState);
        const finalPayload = {
          text: finalText,
          progress: finalProgress,
          finalSummary: {
            // For terminated jobs, use videoData.length (actual completed videos)
            // For other states, use monitor count or fall back to videoCount
            totalDownloaded: finalState === 'terminated' ? videoData.length : (monitor.videoCount.completed || videoCount),
            totalSkipped: monitor.videoCount.skipped || 0,
            jobType: jobType,
            completedAt: new Date().toISOString()
          }
        };

        if (finalState === 'terminated') {
          // Terminated jobs are warnings, not full errors
          finalPayload.warning = true;
          finalPayload.terminationReason = wasManuallyTerminated ? manualReason : shutdownReason;
        } else if (isFinalError) {
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
        if (finalState === 'complete' && !isFinalError) {
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

        plexModule.refreshLibrary().catch(err => {
          logger.error({ err }, 'Failed to refresh Plex library');
        });
        jobModule.startNextJob();
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

        // Clear current process references
        this.currentProcess = null;
        this.currentJobId = null;

        await this.cleanupPartialFiles(Array.from(partialDestinations));
        reject(err);
      });
    }).catch((error) => {
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
      jobModule.updateJob(jobId, {
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
