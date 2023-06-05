const WebSocket = require('ws');
const wss = require('./webSocketServer.js');

module.exports = {
  emitMessage: (destination, clientId, source, type, payload) => {
    const message = {
      destination: destination,
      source: source,
      type: type,
      payload: payload,
    };

    if (clientId) {
      message.clientId = clientId;
    }

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        if (destination === 'broadcast') {
          client.send(JSON.stringify(message)); // broadcast the message
        } else if (client.id === message.clientId) {
          client.send(JSON.stringify(message)); // send to specific client
        }
      }
    });
  },
};
