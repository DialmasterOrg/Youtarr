const configModule = require('./configModule');
const sessionAuth = require('./sessionAuth');
const { isAuthConfigured } = require('./authState');
const logger = require('../logger');

// Browsers cannot set headers on a WebSocket handshake, so the client offers
// its session token as a second subprotocol (`youtarr.auth.<token>`) next to
// `youtarr`, which the server echoes back. Keeps the token out of the URL and
// so out of reverse proxy access logs. Mirrored in
// client/src/providers/WebSocketProvider.tsx.
const WEBSOCKET_PROTOCOL = 'youtarr';
const AUTH_PROTOCOL_PREFIX = 'youtarr.auth.';

class WebSocketAuth {
  constructor() {
    this.WEBSOCKET_PROTOCOL = WEBSOCKET_PROTOCOL;
  }

  readSessionToken(req) {
    const header = req.headers['sec-websocket-protocol'];
    if (typeof header !== 'string') {
      return null;
    }

    const authProtocol = header
      .split(',')
      .map((protocol) => protocol.trim())
      .find((protocol) => protocol.startsWith(AUTH_PROTOCOL_PREFIX));

    return authProtocol ? authProtocol.slice(AUTH_PROTOCOL_PREFIX.length) || null : null;
  }

  // Same rules as verifyToken for session tokens. API keys are not accepted:
  // their scope is the download endpoint only.
  async authorize(req) {
    if (process.env.AUTH_ENABLED === 'false') {
      return { ok: true, sessionToken: null };
    }

    if (!isAuthConfigured(configModule.getConfig())) {
      return { ok: false, status: 503 };
    }

    const token = this.readSessionToken(req);
    if (!token) {
      return { ok: false, status: 401 };
    }

    try {
      const session = await sessionAuth.findActiveSession(token);
      if (!session) {
        return { ok: false, status: 401 };
      }
      return { ok: true, sessionToken: token };
    } catch (err) {
      logger.error({ err }, 'WebSocket session lookup failed');
      return { ok: false, status: 500 };
    }
  }

  async isSessionActive(token) {
    return Boolean(await sessionAuth.findActiveSession(token));
  }
}

module.exports = new WebSocketAuth();
