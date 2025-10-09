const { spawn } = require('child_process');
const path = require('path');
const configModule = require('../configModule');
const plexModule = require('../plexModule');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const DownloadProgressMonitor = require('./DownloadProgressMonitor');
const VideoMetadataProcessor = require('./videoMetadataProcessor');

class DownloadExecutor {
  constructor() {
    this.tempChannelsFile = null;
    // Timeout configuration
    this.activityTimeoutMs = 30 * 60 * 1000; // 30 minutes of no activity
    this.maxAbsoluteTimeoutMs = 4 * 60 * 60 * 1000; // 4 hours maximum runtime
  }

  getCountOfDownloadedVideos() {
    const archive = require('../archiveModule');
    return archive.readCompleteListLines().length;
  }

  getNewVideoUrls(initialCount) {
    const archive = require('../archiveModule');
    return archive.getNewVideoUrlsSince(initialCount);
  }

  // Cleanup function for partial files
  async cleanupPartialFiles(files) {
    const fsPromises = require('fs').promises;

    for (const file of files) {
      try {
        // Check for partial files
        const partFile = file + '.part';

        // Remove .part file
        if (await fsPromises.access(partFile).then(() => true).catch(() => false)) {
          await fsPromises.unlink(partFile);
          console.log(`Cleaned up partial file: ${partFile}`);
        }

        // Remove fragment files
        const dir = path.dirname(file);
        const dirFiles = await fsPromises.readdir(dir);
        const basename = path.basename(file).replace(/\.[^.]+$/, '');

        for (const f of dirFiles) {
          if (f.startsWith(basename + '.f')) {
            await fsPromises.unlink(path.join(dir, f));
            console.log(`Cleaned up fragment: ${f}`);
          }
        }
      } catch (error) {
        console.error(`Error cleaning up ${file}:`, error);
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

    return new Promise((resolve, reject) => {
      console.log(`Running yt-dlp for ${jobType}`);
      console.log('Command args:', args);
      const proc = spawn('yt-dlp', args);

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

        console.log(`Initiating graceful shutdown: ${reason}`);

        // Send SIGTERM to allow process to finish current video
        try {
          proc.kill('SIGTERM');
        } catch (err) {
          console.log('Error sending SIGTERM:', err.message);
        }

        // Wait up to 60 seconds for graceful exit, then force kill
        setTimeout(() => {
          if (proc.exitCode === null && proc.signalCode === null) {
            console.log('Grace period expired, forcing kill with SIGKILL');
            try {
              proc.kill('SIGKILL');
            } catch (err) {
              console.log('Error sending SIGKILL:', err.message);
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
      let partialCleanupPerformed = false;
      let httpForbiddenDetected = false;
      let cookiesSuggestionEmitted = false;

      const emitCookiesSuggestionMessage = () => {
        if (cookiesSuggestionEmitted) {
          return;
        }
        cookiesSuggestionEmitted = true;
        const message = 'Download failed: YouTube returned HTTP 403 (Forbidden). Please set cookies in your Configuration or try different cookies to resolve this issue.';
        monitor.hasError = true;
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          {
            text: message,
            progress: monitor.snapshot('failed'),
            error: true,
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
            console.log(line); // log the data in real-time

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
        console.log(dataStr); // log the data in real-time

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

        // Also check the complete stderr buffer for bot detection
        if (!botDetected && stderrBuffer &&
            stderrBuffer.includes('Sign in to confirm') &&
            stderrBuffer.includes('not a bot')) {
          botDetected = true;
          console.log('Bot detection found in stderr buffer');
        }

        if (!httpForbiddenDetected && stderrBuffer) {
          const lowerStderr = stderrBuffer.toLowerCase();
          if (lowerStderr.includes('http error 403') || lowerStderr.includes('403: forbidden')) {
            httpForbiddenDetected = true;
            console.log('HTTP 403 detected in stderr buffer');
            emitCookiesSuggestionMessage();
          }
        }

        let urlsToProcess;
        if (jobType === 'Manually Added Urls' && originalUrls) {
          urlsToProcess = originalUrls.map(url => {
            // Convert full YouTube URLs to youtu.be format for consistency
            if (url.includes('youtube.com/watch?v=')) {
              const videoId = url.split('v=')[1].split('&')[0];
              console.log(`[DEBUG] Converting ${url} to https://youtu.be/${videoId}`);
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
          console.log(`[DEBUG] Updating archive for ${videoData.length} videos (allowRedownload was true)`);

          for (const video of videoData) {
            if (video.youtubeId && video.filePath) {
              // Only add to archive if the video file actually exists (was successfully downloaded)
              const fs = require('fs');
              if (fs.existsSync(video.filePath)) {
                await archiveModule.addVideoToArchive(video.youtubeId);
              } else {
                console.log(`[DEBUG] Skipping archive update for ${video.youtubeId} - file not found`);
              }
            }
          }
        }

        console.log(
          `${jobType} complete (with or without errors) for Job ID: ${jobId}`
        );

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
        } else if (gracefulShutdownInProgress || shutdownReason) {
          // Handle timeout/graceful shutdown
          await this.cleanupPartialFiles(Array.from(partialDestinations));
          partialCleanupPerformed = true;

          const completedCount = videoData.length;
          status = 'Terminated';
          output = `${completedCount} video${completedCount !== 1 ? 's' : ''} completed before termination`;

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: { videos: videoData || [] },
            notes: shutdownReason || 'Download terminated due to timeout',
          });

          console.log(`Job terminated: ${shutdownReason}. Saved ${completedCount} completed videos.`);
        } else if (httpForbiddenDetected) {
          await this.cleanupPartialFiles(Array.from(partialDestinations));
          partialCleanupPerformed = true;

          status = 'Error';
          output = `${videoCount} videos. Error: YouTube returned HTTP 403 (Forbidden)`;

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: { videos: videoData || [] },
            notes: 'YouTube denied access (HTTP 403). Configure cookies in Settings to resolve this issue.',
            error: 'COOKIES_RECOMMENDED'
          });
          jobErrorCode = 'COOKIES_RECOMMENDED';
        } else if (code !== 0) {
          // Cleanup partial files on failure
          await this.cleanupPartialFiles(Array.from(partialDestinations));
          partialCleanupPerformed = true;

          const failureDetails = monitor.lastParsed || null;

          status = signal === 'SIGKILL' ? 'Killed' : 'Error';
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

        console.log(`[DEBUG] Final state determination - code: ${code}, hasProcessedVideos: ${hasProcessedVideos}, hasDownloadedNewVideos: ${hasDownloadedNewVideos}, isWarningOnly: ${isWarningOnly}, hasError: ${monitor.hasError}, finalState: ${finalState}`);

        // Create a more informative final message
        let finalText;
        let finalErrorCode = jobErrorCode;
        if (gracefulShutdownInProgress || shutdownReason) {
          finalState = 'terminated';
          const completedCount = videoData.length;
          finalText = `Download terminated: ${shutdownReason}. ${completedCount} video${completedCount !== 1 ? 's' : ''} completed successfully.`;
        } else if (botDetected) {
          finalState = 'failed';
          finalErrorCode = 'COOKIES_REQUIRED';
          finalText = 'Download failed: Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.';
        } else if (httpForbiddenDetected) {
          finalState = 'failed';
          finalErrorCode = 'COOKIES_RECOMMENDED';
          finalText = 'Download failed: YouTube returned HTTP 403 (Forbidden). Please set cookies in your Configuration or try different cookies to resolve this issue.';
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
            totalDownloaded: monitor.videoCount.completed || videoCount,
            totalSkipped: monitor.videoCount.skipped || 0,
            jobType: jobType,
            completedAt: new Date().toISOString()
          }
        };

        if (finalState === 'terminated') {
          // Terminated jobs are warnings, not full errors
          finalPayload.warning = true;
          finalPayload.terminationReason = shutdownReason;
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
            console.error('Failed to send notification:', err.message);
            // Continue execution - don't crash if notification fails
          });
        }

        // Perform a best-effort cleanup of any partial download artifacts even on success
        if (!partialCleanupPerformed && partialDestinations.size > 0) {
          await this.cleanupPartialFiles(Array.from(partialDestinations));
        }

        // Clean up temporary channels file if it exists
        if (this.tempChannelsFile) {
          const fs = require('fs').promises;
          fs.unlink(this.tempChannelsFile)
            .then(() => {
              console.log('Cleaned up temporary channels file');
              this.tempChannelsFile = null;
            })
            .catch((err) => {
              console.log('Failed to clean up temp channels file:', err.message);
            });
        }

        plexModule.refreshLibrary().catch(err => {
          console.log('Failed to refresh Plex library:', err.message);
        });
        jobModule.startNextJob();
        resolve();
      });

      proc.on('error', async (err) => {
        if (timeoutChecker) {
          clearInterval(timeoutChecker);
          timeoutChecker = null;
        }
        await this.cleanupPartialFiles(Array.from(partialDestinations));
        partialCleanupPerformed = true;
        reject(err);
      });
    }).catch((error) => {
      console.log('Download process error:', error.message);

      // Clean up temporary channels file on error
      if (this.tempChannelsFile) {
        const fs = require('fs').promises;
        fs.unlink(this.tempChannelsFile)
          .catch((err) => {
            console.log('Failed to clean up temp channels file:', err.message);
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
}

module.exports = DownloadExecutor;
