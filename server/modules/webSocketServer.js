const WebSocket = require('ws');

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  global.wss = wss;
};
