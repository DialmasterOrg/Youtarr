const http = require('http');
const WebSocket = require('ws');
const messageEmitter = require('./messageEmitter.js');
const webSocketAuth = require('./webSocketAuth');
const logger = require('../logger');

const WEBSOCKET_PATH = '/ws';
// Reverse proxies commonly idle-timeout WebSockets after ~60s of silence, and
// yt-dlp quiet periods easily exceed that. Ping every 30s so the connection
// always has traffic, and terminate clients that miss a full interval.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
// A socket outlives the request that authorized it, so its session is checked
// again on this interval and the socket closed once the session has expired
// or been revoked.
const SESSION_RECHECK_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_ENDED_CLOSE_CODE = 1008;
// Clients only listen; nothing they send is read.
const MAX_CLIENT_PAYLOAD_BYTES = 1024;

function rejectUpgrade(socket, status) {
  if (socket.destroyed) {
    return;
  }
  const reason = http.STATUS_CODES[status];
  socket.once('finish', () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\n` +
    'Connection: close\r\n' +
    'Content-Type: text/plain\r\n' +
    `Content-Length: ${Buffer.byteLength(reason)}\r\n` +
    `\r\n${reason}`
  );
}

function ignoreHandshakeSocketError(err) {
  logger.debug({ err }, 'WebSocket upgrade socket error');
}

module.exports = (server) => {
  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: MAX_CLIENT_PAYLOAD_BYTES,
    handleProtocols: (protocols) => (
      protocols.has(webSocketAuth.WEBSOCKET_PROTOCOL) ? webSocketAuth.WEBSOCKET_PROTOCOL : false
    ),
  });

  // The upgrade bypasses Express, so verifyToken never runs for it; the
  // session is checked here before the handshake completes.
  const handleUpgrade = async (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== WEBSOCKET_PATH) {
      rejectUpgrade(socket, 404);
      return;
    }

    let auth;
    try {
      auth = await webSocketAuth.authorize(req);
    } catch (err) {
      logger.error({ err }, 'WebSocket authorization failed');
      rejectUpgrade(socket, 500);
      return;
    }
    if (!auth.ok) {
      logger.debug({ status: auth.status }, 'WebSocket connection rejected');
      rejectUpgrade(socket, auth.status);
      return;
    }

    socket.removeListener('error', ignoreHandshakeSocketError);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, auth);
    });
  };

  server.on('upgrade', (req, socket, head) => {
    // A client that drops the connection during the session lookup must not
    // raise an unhandled socket error.
    socket.on('error', ignoreHandshakeSocketError);
    handleUpgrade(req, socket, head).catch((err) => {
      // ws completes the handshake and emits 'connection' synchronously, so
      // this may be an open WebSocket by now; an HTTP response written into
      // it would reach the client as garbage frames.
      logger.error({ err }, 'WebSocket upgrade failed');
      socket.destroy();
    });
  });

  wss.on('connection', (ws, req, auth) => {
    logger.debug('WebSocket client connected');
    ws.sessionToken = auth.sessionToken;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Without a listener, the 'error' that ws emits for an invalid frame is
    // rethrown and crashes the process. ws closes the connection itself.
    ws.on('error', (err) => {
      logger.warn({ err }, 'WebSocket client error');
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

  const recheckSession = async (sessionToken, sockets) => {
    try {
      if (!(await webSocketAuth.isSessionActive(sessionToken))) {
        logger.debug({ clients: sockets.length }, 'Closing WebSocket clients whose session has ended');
        sockets.forEach((ws) => ws.close(SESSION_ENDED_CLOSE_CODE, 'Session ended'));
      }
    } catch (err) {
      // The session was valid at its last check; a lookup failure is not
      // a reason to drop the connection.
      logger.warn({ err }, 'Could not re-check a WebSocket session');
    }
  };

  let recheckInFlight = false;
  const sessionRecheckTimer = setInterval(() => {
    if (recheckInFlight) {
      return;
    }
    recheckInFlight = true;
    // Every tab of one browser shares its session; look each one up once
    const socketsBySession = new Map();
    wss.clients.forEach((ws) => {
      if (ws.sessionToken) {
        socketsBySession.set(ws.sessionToken, [...(socketsBySession.get(ws.sessionToken) || []), ws]);
      }
    });
    const rechecks = [...socketsBySession].map(([sessionToken, sockets]) => recheckSession(sessionToken, sockets));
    Promise.all(rechecks).finally(() => {
      recheckInFlight = false;
    });
  }, SESSION_RECHECK_INTERVAL_MS);

  // Neither timer may keep the process alive on shutdown
  [heartbeatTimer, sessionRecheckTimer].forEach((timer) => {
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    clearInterval(sessionRecheckTimer);
  });

  global.wss = wss;
};
