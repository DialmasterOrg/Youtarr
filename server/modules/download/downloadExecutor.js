const { spawn } = require('child_process');
const path = require('path');
const configModule = require('../configModule');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const DownloadProgressMonitor = require('./DownloadProgressMonitor');
const tempPathManager = require('./tempPathManager');
const { isSpecificUrlDownloadJob, isChannelDownloadAllJob } = require('./jobTypes');
const downloadResultProcessor = require('./downloadResultProcessor');
const downloadCleanup = require('./downloadCleanup');
const { finalizeDownloadJob } = require('./downloadJobFinalizer');
const YtdlpOutputRouter = require('./YtdlpOutputRouter');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const logger = require('../../logger');
const { buildYtdlpEnv } = require('./ytdlpEnvBuilder');
const DownloadTimeoutController = require('./DownloadTimeoutController');
const { YtdlpErrorTracker } = require('./YtdlpErrorTracker');

class DownloadExecutor {
  // enqueueAutoRetry is injected by downloadModule so the finalizer can queue
  // transient-403 retry jobs without a require cycle back into downloadModule.
  constructor({ enqueueAutoRetry = null } = {}) {
    this.enqueueAutoRetry = enqueueAutoRetry;
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

  // Channel download-all jobs legitimately run for days, so they get no
  // absolute runtime cap; the activity timeout remains the hang guard.
  resolveMaxAbsoluteTimeoutMs(jobType) {
    return isChannelDownloadAllJob(jobType) ? null : this.maxAbsoluteTimeoutMs;
  }

  async doDownload(args, jobId, jobType, urlCount = 0, originalUrls = null, allowRedownload = false, skipJobTransition = false, postProcessDirectives = {}) {
    const subfolderOverride = (postProcessDirectives || {}).subfolderOverride ?? null;
    const initialCount = downloadResultProcessor.getCountOfDownloadedVideos();
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
        maxAbsoluteTimeoutMs: this.resolveMaxAbsoluteTimeoutMs(jobType),
      });
      timeoutController.start(proc);

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

      const router = new YtdlpOutputRouter({ jobId, config, monitor, errorTracker, timeoutController });

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

      proc.stdout.on('data', (chunk) => router.handleStdoutChunk(chunk));
      proc.stderr.on('data', (data) => router.handleStderrChunk(data));

      proc.on('exit', async (code, signal) => {
        if (finalized) return;
        finalized = true;
        try {
          timeoutController.stop();

          if (this.forceKillTimeout) {
            clearTimeout(this.forceKillTimeout);
            this.forceKillTimeout = null;
          }

          router.dispose();

          // Check for manual termination before clearing references
          const wasManuallyTerminated = this.manualTerminationReason !== null;
          const manualReason = this.manualTerminationReason;

          this.currentProcess = null;
          this.currentJobId = null;
          this.manualTerminationReason = null;

          await finalizeDownloadJob({
            jobId,
            jobType,
            code,
            signal,
            monitor,
            errorTracker,
            timeoutController,
            router,
            wasManuallyTerminated,
            manualReason,
            initialCount,
            originalUrls,
            allowRedownload,
            skipJobTransition,
            runId,
            tempChannelsFile: this.tempChannelsFile,
            onTempChannelsFileCleaned: () => { this.tempChannelsFile = null; },
            enqueueAutoRetry: this.enqueueAutoRetry,
          });
          resolve();
        } catch (err) {
          // Pre-finalizer failure (finalizeDownloadJob itself never throws and
          // owns the terminal persist). Without this the promise never settles
          // and the queue stalls.
          logger.error({ err, jobId }, 'Unexpected error finalizing download job');
          await jobModule.updateJob(jobId, {
            status: 'Error',
            endDate: Date.now(),
            output: 'Job finalization error: ' + err.message,
          }).catch((dbErr) => logger.debug({ err: dbErr, jobId }, 'Best-effort error update failed'));
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

        router.dispose();

        this.currentProcess = null;
        this.currentJobId = null;

        await downloadCleanup.cleanupPartialFiles(Array.from(router.partialDestinations));
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
