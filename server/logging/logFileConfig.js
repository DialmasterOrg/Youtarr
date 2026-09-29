const fs = require('fs');
const path = require('path');

// Inside the config volume so the files survive container recreation and are
// reachable from the host next to config.json.
const LOG_DIRECTORY = path.join(__dirname, '../../config/logs');
const LOG_FILE_BASENAME = 'youtarr.log';
// pino-roll inserts a number before the extension: youtarr.1.log, youtarr.2.log, ...
const LOG_FILE_NAME_PATTERN = /^youtarr\.(\d+)\.log$/;

const DEFAULT_MAX_SIZE = '10MB';
const DEFAULT_MAX_FILES = 5;
const BYTES_PER_UNIT = { M: 1024 ** 2, G: 1024 ** 3 };
// A whole number of MB or GB; a bare number means MB.
const SIZE_PATTERN = /^([1-9]\d*)\s*(?:([MG])B?)?$/i;
const COUNT_PATTERN = /^[1-9]\d*$/;

function parseMaxSize(raw) {
  const match = SIZE_PATTERN.exec(String(raw).trim());
  if (!match) return null;
  const unit = (match[2] || 'M').toUpperCase();
  return Number(match[1]) * BYTES_PER_UNIT[unit];
}

function parseMaxFiles(raw) {
  const trimmed = String(raw).trim();
  return COUNT_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

function resolveLogFileConfig(env) {
  const warnings = [];

  let maxSizeBytes = parseMaxSize(DEFAULT_MAX_SIZE);
  if (env.LOG_FILE_MAX_SIZE) {
    const parsed = parseMaxSize(env.LOG_FILE_MAX_SIZE);
    if (parsed) {
      maxSizeBytes = parsed;
    } else {
      warnings.push({ variable: 'LOG_FILE_MAX_SIZE', value: env.LOG_FILE_MAX_SIZE, fallback: DEFAULT_MAX_SIZE });
    }
  }

  let maxFiles = DEFAULT_MAX_FILES;
  if (env.LOG_FILE_MAX_COUNT) {
    const parsed = parseMaxFiles(env.LOG_FILE_MAX_COUNT);
    if (parsed) {
      maxFiles = parsed;
    } else {
      warnings.push({ variable: 'LOG_FILE_MAX_COUNT', value: env.LOG_FILE_MAX_COUNT, fallback: DEFAULT_MAX_FILES });
    }
  }

  return {
    directory: LOG_DIRECTORY,
    file: path.join(LOG_DIRECTORY, LOG_FILE_BASENAME),
    maxSizeBytes,
    maxFiles,
    warnings,
  };
}

// Checked up front, in the main thread, so the logger can fall back to
// console-only output and Settings can say why.
function checkLogDirectoryWritable(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.accessSync(directory, fs.constants.W_OK);
    return null;
  } catch (err) {
    return err;
  }
}

module.exports = {
  LOG_DIRECTORY,
  LOG_FILE_NAME_PATTERN,
  resolveLogFileConfig,
  checkLogDirectoryWritable,
};
