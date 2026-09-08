const pino = require('pino');

/**
 * Pino logger configuration for Youtarr backend.
 *
 * Features:
 * - Configurable log level via LOG_LEVEL env var (default: info)
 * - Pretty printing in development for readability
 * - JSON structured logs in production
 * - Sensitive data redaction (passwords, tokens, API keys)
 * - Request correlation via request IDs
 */
const logLevel = process.env.LOG_LEVEL || 'info';

const pinoConfig = {
  level: logLevel,

  // Redact sensitive data from logs
  redact: {
    paths: [
      // Authentication
      'password',
      'passwordHash',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',

      // Tokens and keys
      'token',
      'authToken',
      'plexAuthToken',
      'session_token',
      'plexApiKey',
      'plexPlaylistToken',
      'jellyfinApiKey',
      'embyApiKey',
      'youtubeApiKey',
      'apiKey',
      'key',
      'key_hash',
      'idempotencyKey',
      'req.body.apiKey',
      'req.body.key',
      'req.body.idempotencyKey',
      'req.headers.authorization',
      'req.headers["x-access-token"]',
      'req.headers["x-api-key"]',
      'authorization',

      // Cookies
      'cookie',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    remove: true // Completely remove instead of replacing with [Redacted]
  },

  // Add custom serializers
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },

  // Base fields for all logs
  base: {
    pid: process.pid,
  },
};

// pino-pretty uses a worker thread. Tests use Pino's synchronous destination
// so Jest can prove the backend leaves no worker/message-port handles open.
if (process.env.NODE_ENV !== 'test') {
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
      ignore: 'pid,hostname',
      singleLine: true,
      messageFormat: '{if req.id}[{req.id}] {end}{msg}',
    },
  };
}

const logger = pino(pinoConfig);

// Export logger instance
module.exports = logger;
