const WebSocket = require('ws');

// Create a cache of last download Progress messages sent to broadcast
let lastDownloadProgressMessages = [];

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
      lastDownloadProgressMessages.push(message); // Add message to the cache
      if (lastDownloadProgressMessages.length > 40) { // Keep only last 40 messages
        lastDownloadProgressMessages.shift();
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
  getLastMessages: () => lastDownloadProgressMessages, // Method to retrieve last messages
};
