const WebSocket = require('ws');
const { hasFailureStop } = require('./notifications/utils');

// Store only the final state of the last download, not the entire history
let lastDownloadState = null;
// The last summary that had something to report. A check that finds nothing new
// shows this instead of its own empty summary, so the hourly sweep doesn't hide
// what the last real job did.
let lastResultSummary = null;

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

function resolveSummaryToShow({ finalSummary, error, warning }) {
  if (hasResult(finalSummary)) {
    lastResultSummary = finalSummary;
    return finalSummary;
  }
  // A job that failed or was stopped did not finish looking, so it can't say
  // when Youtarr last checked.
  if (error || warning || !lastResultSummary) return finalSummary;
  return { ...lastResultSummary, lastCheckedAt: finalSummary.completedAt };
}

module.exports = {
  emitMessage: (destination, clientId, source, type, payload) => {
    payload = payload || {};
    payload.dateTimeStamp = new Date().getTime();
    // A copy, because callers still read their own summary (notifications do).
    if (destination === 'broadcast' && type === 'downloadProgress' && payload.finalSummary) {
      payload = { ...payload, finalSummary: resolveSummaryToShow(payload) };
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
};
