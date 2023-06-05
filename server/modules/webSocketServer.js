const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8099 });

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

module.exports = wss;
