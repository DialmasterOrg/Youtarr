const WebSocket = require('ws');
const messageEmitter = require('./messageEmitter.js');
const logger = require('../logger');

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    // Send last downloadProgress messages to new client
    messageEmitter.getLastMessages().forEach(message => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });

  global.wss = wss;
};
