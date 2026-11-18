const WebSocket = require('ws');
const { hasFailureStop } = require('./notifications/utils');

// Store only the final state of the last download, not the entire history
let lastDownloadState = null;
// The last summary that had something to report. A check that finds nothing new
// shows this instead of its own empty summary, so the hourly sweep doesn't hide
// what the last real job did.
let lastResultSummary = null;
// How the run behind lastResultSummary ended. A later check that found nothing
// new shows that summary again, and it must keep that run's outcome, not the
// clean check's.
let lastResultEnding = null;
// The last final summary and how its run ended. Unlike lastDownloadState it is
// not cleared when the next download starts, so "the last finished run" stays
// readable while a new one is in progress.
let lastFinishedRun = null;

const RESULT_COUNT_FIELDS = [
  'totalDownloaded',
  'totalFailed',
  'totalAutoRetried',
  'totalMembersOnly',
  'totalTerminatedChannels',
  'totalTerminationFailures',
  'totalAlreadyDownloaded',
  'totalNotAvailable',
];

// A stop the user asked for is not a result on its own: it shows once as a
// warning, and the next check goes back to the earlier result.
function hasResult(summary) {
  return RESULT_COUNT_FIELDS.some((field) => summary[field] > 0) || hasFailureStop(summary);
}

// The run to show for a final summary, as { finalSummary, error, warning }:
// its own, or the last one with a result when this one has none.
function resolveRunToShow({ finalSummary, error, warning }) {
  const ending = { error: Boolean(error), warning: Boolean(warning) };
  if (hasResult(finalSummary)) {
    lastResultSummary = finalSummary;
    lastResultEnding = ending;
    return { finalSummary, ...ending };
  }
  // A job that failed or was stopped did not finish looking, so it can't say
  // when Youtarr last checked.
  if (error || warning || !lastResultSummary) return { finalSummary, ...ending };
  return {
    finalSummary: { ...lastResultSummary, lastCheckedAt: finalSummary.completedAt },
    ...lastResultEnding,
  };
}

module.exports = {
  emitMessage: (destination, clientId, source, type, payload) => {
    payload = payload || {};
    payload.dateTimeStamp = new Date().getTime();
    // A copy, because callers still read their own summary (notifications do).
    if (destination === 'broadcast' && type === 'downloadProgress' && payload.finalSummary) {
      lastFinishedRun = resolveRunToShow(payload);
      payload = { ...payload, finalSummary: lastFinishedRun.finalSummary };
    }
    const message = {
      destination: destination,
      source: source,
      type: type,
      payload: payload,
    };

    if (clientId) {
      message.clientId = clientId;
    }

    if (destination === 'broadcast' && type === 'downloadProgress') {
      // Only store the final summary or complete/error states, not progress updates
      if (payload.finalSummary ||
          (payload.progress && (payload.progress.state === 'complete' || payload.progress.state === 'error'))) {
        // Create a simplified message for replay without progress details
        // This prevents the progress bar from "replaying" when clients reconnect
        lastDownloadState = {
          ...message,
          payload: {
            ...message.payload,
            progress: undefined  // Remove progress object to show only final summary
          }
        };
      }
      // Clear the stored state when a new download starts
      if (payload.clearPreviousSummary ||
          (payload.progress && payload.progress.state === 'initiating')) {
        lastDownloadState = null;
      }
    }

    global.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        if (destination === 'broadcast') {
          client.send(JSON.stringify(message)); // broadcast the message
        } else if (client.id === message.clientId) {
          client.send(JSON.stringify(message)); // send to specific client
        }
      }
    });
  },
  getLastMessages: () => {
    // Return only the final state if available, not progress history
    return lastDownloadState ? [lastDownloadState] : [];
  },
  // The stored final-state payload without the WebSocket transport envelope,
  // for REST consumers (GET /api/jobs/current-activity)
  getLastFinalActivity: () => {
    return lastDownloadState ? lastDownloadState.payload : null;
  },
  // { finalSummary, error, warning } of the last run that produced a final
  // summary, or null until one finishes after startup.
  getLastFinishedRun: () => lastFinishedRun,
};
