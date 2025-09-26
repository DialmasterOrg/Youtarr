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

  async doDownload(args, jobId, jobType, urlCount = 0) {
    const initialCount = this.getCountOfDownloadedVideos();
    const config = configModule.getConfig();
    const monitor = new DownloadProgressMonitor(jobId, jobType);

    // For manual URL downloads, set the total count upfront
    if (jobType === 'Manually Added Urls' && urlCount > 0) {
      monitor.videoCount.total = urlCount;
    }

    // Calculate process timeout based on configuration
    const processTimeoutMs = Math.max(
      config.downloadSocketTimeoutSeconds * 1000 * (config.downloadRetryCount + 1),
      20 * 60 * 1000
    );

    return new Promise((resolve, reject) => {
      console.log('Setting timeout for ending job');
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Download timeout exceeded'));
      }, processTimeoutMs);

      console.log(`Running yt-dlp for ${jobType}`);
      console.log('Command args:', args);
      const proc = spawn('yt-dlp', args);

      const partialDestinations = new Set();

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
          });
      });

      let stderrBuffer = '';
      let botDetected = false;
      proc.stderr.on('data', (data) => {
        const dataStr = data.toString();
        stderrBuffer += dataStr;
        console.log(dataStr); // log the data in real-time

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
        clearTimeout(timer);

        // Also check the complete stderr buffer for bot detection
        if (!botDetected && stderrBuffer &&
            stderrBuffer.includes('Sign in to confirm') &&
            stderrBuffer.includes('not a bot')) {
          botDetected = true;
          console.log('Bot detection found in stderr buffer');
        }

        const newVideoUrls = this.getNewVideoUrls(initialCount);
        const videoCount = newVideoUrls.length;

        let videoData = VideoMetadataProcessor.processVideoMetadata(newVideoUrls);

        console.log(
          `${jobType} complete (with or without errors) for Job ID: ${jobId}`
        );

        let status = '';
        let output = '';

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
        } else if (code !== 0) {
          // Cleanup partial files on failure
          await this.cleanupPartialFiles(Array.from(partialDestinations));

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
        } else if (stderrBuffer) {
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
        const isWarningOnly = (code === 1 && (hasProcessedVideos || hasDownloadedNewVideos));
        let finalState = (code === 0 || isWarningOnly) ? 'complete' : 'error';

        console.log(`[DEBUG] Final state determination - code: ${code}, hasProcessedVideos: ${hasProcessedVideos}, hasDownloadedNewVideos: ${hasDownloadedNewVideos}, isWarningOnly: ${isWarningOnly}, finalState: ${finalState}`);

        // Create a more informative final message
        let finalText;
        if (botDetected) {
          finalState = 'failed';
          finalText = 'Download failed: Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.';
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

        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          {
            text: finalText,
            progress: monitor.snapshot(finalState),
            finalSummary: {
              totalDownloaded: monitor.videoCount.completed || videoCount,
              totalSkipped: monitor.videoCount.skipped || 0,
              jobType: jobType,
              completedAt: new Date().toISOString()
            }
          }
        );

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
        clearTimeout(timer);
        await this.cleanupPartialFiles(Array.from(partialDestinations));
        reject(err);
      });
    }).catch((error) => {
      console.log(error.message);

      // Clean up temporary channels file on error
      if (this.tempChannelsFile) {
        const fs = require('fs').promises;
        fs.unlink(this.tempChannelsFile)
          .catch((err) => {
            console.log('Failed to clean up temp channels file:', err.message);
          });
        this.tempChannelsFile = null;
      }

      jobModule.updateJob(jobId, {
        status: 'Killed',
        output: 'Job time exceeded timeout',
      });
    });
  }
}

module.exports = DownloadExecutor;