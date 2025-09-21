const WebSocket = require('ws');

// Store only the final state of the last download, not the entire history
let lastDownloadState = null;

module.exports = {
  emitMessage: (destination, clientId, source, type, payload) => {
    payload = payload || {};
    payload.dateTimeStamp = new Date().getTime();
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
        lastDownloadState = message;
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
};
