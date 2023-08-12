const WebSocket = require('ws');
const messageEmitter = require('./messageEmitter.js');

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New client connected');
    // Send last downloadProgress messages to new client
    messageEmitter.getLastMessages().forEach(message => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  global.wss = wss;
};
