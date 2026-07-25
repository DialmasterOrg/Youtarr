const WebSocket = require('ws');
const messageEmitter = require('./messageEmitter.js');
const logger = require('../logger');

// Reverse proxies commonly idle-timeout WebSockets after ~60s of silence, and
// yt-dlp quiet periods easily exceed that. Ping every 30s so the connection
// always has traffic, and terminate clients that miss a full interval.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    logger.debug('WebSocket client connected');
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send last downloadProgress messages to new client
    messageEmitter.getLastMessages().forEach(message => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });

    ws.on('close', () => {
      logger.debug('WebSocket client disconnected');
    });
  });

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.debug('Terminating unresponsive WebSocket client');
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  // The heartbeat must never keep the process alive on shutdown
  if (typeof heartbeatTimer.unref === 'function') {
    heartbeatTimer.unref();
  }

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  global.wss = wss;
};
