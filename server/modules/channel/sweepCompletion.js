const logger = require('../../logger');

const POLL_INTERVAL_MS = 5000;
// Every download job has its own 6-hour cap and 30-minute inactivity
// timeout, so a sweep outliving this is stuck, not slow.
const MAX_WAIT_MS = 48 * 60 * 60 * 1000;

/**
 * Wait for a channel-and-playlist download sweep to end, and say how it ended.
 * Never rejects. Ends on whichever comes first:
 * - finished: the run tracker finalized the run, including a run it closed
 *   on jobs that never reported (see downloadRunTracker.maybeFinalize);
 * - paused: downloads are paused and none of the run's jobs is running or
 *   still reporting, so the rest are held until downloads resume;
 * - idle: the tracker knows neither the run nor its end;
 * - timeout: maxWaitMs passed;
 * - error: the check itself failed.
 * The sweep's lock never depends on this: the record it feeds closes late at
 * worst, and AutoDownloadScheduler.isChannelDownloadRunning decides "running".
 *
 * @param {Object} options
 * @param {string} options.runId
 * @param {Object} options.tracker - downloadRunTracker
 * @param {Function} options.isPaused - true while downloads are paused
 * @returns {Promise<{ endedBy: string, finishedAt: Date, totals: Object|null, remainingJobs?: number }>}
 */
function waitForSweepEnd({ runId, tracker, isPaused, pollIntervalMs = POLL_INTERVAL_MS, maxWaitMs = MAX_WAIT_MS }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let timer = null;
    let unsubscribe = () => {};

    // Settles even if the tracker throws here, so the promise always resolves.
    const totalsSoFar = () => {
      try {
        return tracker.getTotals(runId);
      } catch (err) {
        return null;
      }
    };

    const end = (endedBy, extra = {}) => {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      try {
        unsubscribe();
      } catch (err) {
        // Nothing left to clean up.
      }
      resolve({ endedBy, finishedAt: new Date(), totals: totalsSoFar(), ...extra });
    };

    const endFinished = ({ finishedAt, totals }) => end('finished', { finishedAt, totals });

    const check = () => {
      try {
        const finished = tracker.getFinishedRun(runId);
        if (finished) return endFinished(finished);
        if (!tracker.isActive(runId)) return end('idle');

        const unreported = tracker.getUnreportedJobs(runId);
        const queued = unreported.filter((job) => !job.reporting);
        const reporting = unreported.some((job) => job.reporting);
        const running = queued.some((job) => job.status === 'In Progress');
        if (queued.length > 0 && !running && !reporting && isPaused()) {
          return end('paused', { remainingJobs: queued.length });
        }
        if (Date.now() - startedAt >= maxWaitMs) return end('timeout', { remainingJobs: queued.length });
      } catch (err) {
        logger.warn({ err, runId }, 'Could not check whether a download sweep has ended');
        end('error', { error: err.message });
      }
      return undefined;
    };

    try {
      unsubscribe = tracker.onRunFinished(runId, endFinished);
    } catch (err) {
      logger.warn({ err, runId }, 'Could not listen for the end of a download sweep');
    }
    check();
    if (!settled) {
      timer = setInterval(check, pollIntervalMs);
      if (typeof timer.unref === 'function') timer.unref();
    }
  });
}

module.exports = { waitForSweepEnd, POLL_INTERVAL_MS, MAX_WAIT_MS };
