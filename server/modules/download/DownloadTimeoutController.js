const logger = require('../../logger');

const TIMEOUT_CHECK_INTERVAL_MS = 60 * 1000;
const SIGKILL_GRACE_MS = 60 * 1000;

const POST_PROCESSING_MARKERS = ['[Merger]', '[Metadata]', '[MoveFiles]', '[ModifyChapters]', '[ExtractAudio]'];
const DOWNLOAD_ACTIVITY_MARKERS = ['[download]', 'Downloading item'];
const OTHER_ACTIVITY_MARKERS = ['[SubtitlesConvertor]', '[ThumbnailsConvertor]', 'Deleting original file'];

function formatMinutes(ms) {
  return `${Math.round(ms / 60000)} minutes`;
}

// Per-download activity/absolute timeout tracking and graceful shutdown.
// One instance per doDownload run.
class DownloadTimeoutController {
  constructor({ activityTimeoutMs, postProcessingTimeoutMs, maxAbsoluteTimeoutMs }) {
    this.activityTimeoutMs = activityTimeoutMs;
    this.postProcessingTimeoutMs = postProcessingTimeoutMs;
    this.maxAbsoluteTimeoutMs = maxAbsoluteTimeoutMs;
    this.currentActivityTimeout = activityTimeoutMs;
    this.lastActivityTime = Date.now();
    this.jobStartTime = Date.now();
    this.timeoutChecker = null;
    this.graceKillTimer = null;
    this.proc = null;
    this.shutdownInProgress = false;
    this.shutdownReason = null;
  }

  start(proc) {
    this.stop();
    this.proc = proc;
    this.lastActivityTime = Date.now();
    this.timeoutChecker = setInterval(() => {
      const check = this.checkTimeout();
      if (check.timeout) {
        clearInterval(this.timeoutChecker);
        this.timeoutChecker = null;
        this.initiateGracefulShutdown(check.reason);
      }
    }, TIMEOUT_CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timeoutChecker) {
      clearInterval(this.timeoutChecker);
      this.timeoutChecker = null;
    }
    if (this.graceKillTimer) {
      clearTimeout(this.graceKillTimer);
      this.graceKillTimer = null;
    }
  }

  noteActivity() {
    this.lastActivityTime = Date.now();
  }

  // Post-processing markers extend the inactivity window; download activity
  // resets it to normal.
  noteLine(line) {
    const isPostProcessingStart = POST_PROCESSING_MARKERS.some((m) => line.includes(m));
    const isDownloadActivity = DOWNLOAD_ACTIVITY_MARKERS.some((m) => line.includes(m));

    if (isPostProcessingStart) {
      this.currentActivityTimeout = this.postProcessingTimeoutMs;
      this.noteActivity();
      logger.info({ timeout: formatMinutes(this.postProcessingTimeoutMs) }, 'Post-processing detected, extended inactivity timeout');
    } else if (isDownloadActivity) {
      if (this.currentActivityTimeout !== this.activityTimeoutMs) {
        this.currentActivityTimeout = this.activityTimeoutMs;
        logger.debug({ timeout: formatMinutes(this.activityTimeoutMs) }, 'Download activity resumed, reset to normal timeout');
      }
      this.noteActivity();
    } else if (OTHER_ACTIVITY_MARKERS.some((m) => line.includes(m))) {
      this.noteActivity();
    }
  }

  checkTimeout() {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;
    const totalRuntime = now - this.jobStartTime;

    if (timeSinceActivity > this.currentActivityTimeout) {
      return {
        timeout: true,
        reason: `No download activity for ${Math.round(timeSinceActivity / 60000)} minutes`
      };
    }

    // null means "no absolute cap" (channel download-all jobs); the
    // inactivity timeout above remains the hang guard.
    if (this.maxAbsoluteTimeoutMs != null && totalRuntime > this.maxAbsoluteTimeoutMs) {
      return {
        timeout: true,
        reason: `Maximum runtime limit of ${Math.round(this.maxAbsoluteTimeoutMs / 3600000)} hours reached`
      };
    }

    return { timeout: false };
  }

  initiateGracefulShutdown(reason) {
    if (this.shutdownInProgress) return;
    this.shutdownInProgress = true;
    this.shutdownReason = reason;

    logger.info({ reason }, 'Initiating graceful shutdown');

    // Send SIGTERM to allow process to finish current video
    try {
      this.proc.kill('SIGTERM');
    } catch (err) {
      logger.error({ err }, 'Error sending SIGTERM');
    }

    // Wait up to 60 seconds for graceful exit, then force kill
    this.graceKillTimer = setTimeout(() => {
      if (this.proc.exitCode === null && this.proc.signalCode === null) {
        logger.info('Grace period expired, forcing kill with SIGKILL');
        try {
          this.proc.kill('SIGKILL');
        } catch (err) {
          logger.error({ err }, 'Error sending SIGKILL');
        }
      }
    }, SIGKILL_GRACE_MS);
  }
}

module.exports = DownloadTimeoutController;
