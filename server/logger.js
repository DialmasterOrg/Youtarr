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

  // Use pino-pretty
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
      ignore: 'pid,hostname',
      singleLine: true, // Keep structured data as compact JSON
      messageFormat: '{if req.id}[{req.id}] {end}{msg}'
    }
  },

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
      'req.headers.authorization',
      'req.headers["x-access-token"]',
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

const logger = pino(pinoConfig);

// Export logger instance
module.exports = logger;
