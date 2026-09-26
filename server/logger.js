const path = require('path');
const pino = require('pino');
const { DEFAULT_ENV_LEVEL, resolveLevel } = require('./logging/logLevel');
const { resolveLogFileConfig, checkLogDirectoryWritable } = require('./logging/logFileConfig');

/**
 * Pino logger configuration for Youtarr backend.
 *
 * Features:
 * - Log level from LOG_LEVEL (default: info), overridable at runtime from
 *   Settings via applyLevelSetting
 * - Pretty printing with compact structured data in all environments
 * - Console timestamps use the local timezone configured via TZ
 * - The server process also writes the same lines, without colors, to rolling
 *   files in config/logs
 * - Sensitive data redaction (passwords, tokens, API keys)
 * - Request correlation via request IDs
 */
const envLevel = process.env.LOG_LEVEL || DEFAULT_ENV_LEVEL;

// Shared by the console and the log file so both read the same.
const PRETTY_OPTIONS = {
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l o',
  ignore: 'pid,hostname',
  singleLine: true, // Keep structured data as compact JSON
  messageFormat: '{if req.id}[{req.id}] {end}{msg}'
};

// Only the server writes log files. The yt-dlp post-processor, scripts, and
// tests load this module too; post-processor output already reaches the
// server's log through yt-dlp's stdout, and two processes rotating the same
// files can delete or split each other's logs.
const isServerProcess = path.resolve(process.argv[1] || '') === path.join(__dirname, 'server.js');

const logFileConfig = resolveLogFileConfig(process.env);
const logDirectoryError = isServerProcess ? checkLogDirectoryWritable(logFileConfig.directory) : null;
const fileLoggingEnabled = isServerProcess && !logDirectoryError;

// Targets are pinned to trace so the root level, which applyLevelSetting
// changes at runtime, is the only filter; a target's own level is fixed at startup.
const targets = [
  { target: 'pino-pretty', level: 'trace', options: { ...PRETTY_OPTIONS, colorize: true, destination: 1 } },
];
if (fileLoggingEnabled) {
  targets.push({
    target: path.join(__dirname, 'logging', 'logFileTransport.js'),
    level: 'trace',
    options: {
      file: logFileConfig.file,
      maxSizeBytes: logFileConfig.maxSizeBytes,
      maxFiles: logFileConfig.maxFiles,
      prettyOptions: PRETTY_OPTIONS,
    },
  });
}

const pinoConfig = {
  level: envLevel,

  transport: { targets },

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
      'req.body.apiKey',
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

const logger = pino(pinoConfig);

if (logDirectoryError) {
  logger.warn(
    { err: logDirectoryError, directory: logFileConfig.directory },
    'Cannot write to the log folder; logging to the console only'
  );
}
if (isServerProcess) {
  for (const warning of logFileConfig.warnings) {
    logger.warn(warning, `Invalid ${warning.variable}; using the default`);
  }
}

// announce: false skips the "Log level changed" record, for a process that
// is only aligning its startup level rather than reacting to a change.
function applyLevelSetting(setting, { announce = true } = {}) {
  const { level, source } = resolveLevel({ setting, envLevel });
  const previous = logger.level;
  if (level === previous) return;
  if (!announce) {
    logger.level = level;
    return;
  }

  // Log at whichever end still shows info, so the change is recorded both
  // when switching to Warn and when switching away from it. A `level` key
  // would overwrite pino's own level field and the record would be dropped.
  const details = { newLevel: level, previousLevel: previous, source };
  if (logger.isLevelEnabled('info')) {
    logger.info(details, 'Log level changed');
    logger.level = level;
  } else {
    logger.level = level;
    logger.info(details, 'Log level changed');
  }
}

function getLoggingStatus() {
  return {
    envLevel,
    file: {
      enabled: fileLoggingEnabled,
      directory: logFileConfig.directory,
      maxSizeBytes: logFileConfig.maxSizeBytes,
      maxFiles: logFileConfig.maxFiles,
      error: logDirectoryError ? logDirectoryError.message : null,
    },
  };
}

// Export logger instance
module.exports = logger;
module.exports.applyLevelSetting = applyLevelSetting;
module.exports.getLoggingStatus = getLoggingStatus;
