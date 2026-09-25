const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const logger = require('../logger');

const MAX_COOKIE_BYTES = 1024 * 1024;
const VALIDATOR_PATH = path.join(__dirname, '../utils/validate-cookies.py');
const VALIDATION_ERRORS = {
  invalid: 'yt-dlp could not load the file. Export cookies in Netscape format.',
  empty: 'yt-dlp did not load any cookies from the file.',
  unavailable: 'the yt-dlp cookie validator could not run. Check the yt-dlp installation.',
  snapshot: 'a private working copy could not be created. Check temporary-directory permissions and free space.',
};

// Only memoize validation of the current contents, never fall back to old cookies.
// The installed executable's identity invalidates the result after yt-dlp updates.
let validationCache = null;
let lastReportedState = null;

function getExternalCookiesPath() {
  return process.env.YOUTARR_COOKIES_FILE?.trim() || null;
}

function cookieError(message) {
  const error = new Error(`External cookies: ${message}`);
  error.code = 'EXTERNAL_COOKIES_INVALID';
  return error;
}

// Read one opened file so an atomic replacement cannot mix two versions.
function readExternalCookies(sourcePath) {
  if (!path.isAbsolute(sourcePath)) {
    throw cookieError('YOUTARR_COOKIES_FILE must be an absolute path inside the container.');
  }

  let fd;
  try {
    // O_NONBLOCK prevents a mistakenly configured FIFO from hanging the server.
    fd = fs.openSync(sourcePath, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw cookieError('the configured path must point to a regular file.');
    if (stat.size > MAX_COOKIE_BYTES) throw cookieError('the file must be no larger than 1 MB.');

    // Bound the read even if another process grows the file after fstat.
    const buffer = Buffer.alloc(MAX_COOKIE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const bytesRead = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_COOKIE_BYTES) throw cookieError('the file must be no larger than 1 MB.');
    return { contents: buffer.subarray(0, length), lastModified: stat.mtime.toISOString() };
  } catch (error) {
    if (error.code === 'EXTERNAL_COOKIES_INVALID') throw error;
    if (error.code === 'ENOENT') {
      throw cookieError('the file was not found. Check the directory mount and YOUTARR_COOKIES_FILE.');
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw cookieError('the file is not readable. Check permissions for the container user.');
    }
    throw cookieError('the file could not be read. Check the path, permissions, and directory mount.');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function getYtDlpExecutable() {
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    try {
      const executable = fs.realpathSync(path.resolve(directory, 'yt-dlp'));
      fs.accessSync(executable, fs.constants.X_OK);
      const stat = fs.statSync(executable);
      if (stat.isFile()) {
        return { executable, identity: [executable, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs] };
      }
    } catch {
      // Continue searching PATH, just as the process launcher does.
    }
  }
  throw cookieError(VALIDATION_ERRORS.unavailable);
}

function reportStatus(sourcePath, status) {
  const state = JSON.stringify([sourcePath, status.error, status.warning]);
  if (state === lastReportedState) return;
  if (status.error) {
    logger.warn({ sourcePath, reason: status.error }, 'External cookies unavailable; operations will continue without cookies while this source is selected');
  } else if (status.warning) {
    logger.warn({ sourcePath, reason: status.warning }, 'External cookies loaded with warnings');
  } else if (lastReportedState) {
    logger.info({ sourcePath }, 'External cookie file is ready');
  }
  lastReportedState = state;
}

function prepareCookieFile(sourcePath) {
  let tempDir;
  let lastModified = null;
  const cleanup = () => {
    if (!tempDir) return;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    } catch {
      logger.warn('Failed to remove temporary external cookies');
    }
  };

  let result;
  try {
    const source = readExternalCookies(sourcePath);
    lastModified = source.lastModified;
    const { executable, identity } = getYtDlpExecutable();
    const digest = crypto.createHash('sha256').update(source.contents).digest('hex');
    const key = JSON.stringify([sourcePath, digest, identity]);
    if (validationCache?.key !== key) validationCache = null;
    if (validationCache?.error) throw cookieError(validationCache.error);

    try {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-cookies-'));
      const snapshotPath = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(snapshotPath, validationCache?.contents || source.contents, { mode: 0o600 });
      if (!validationCache) {
        const checked = spawnSync('python3', [VALIDATOR_PATH, executable, snapshotPath], {
          encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024, windowsHide: true,
        });
        if (checked.error || checked.status !== 0) throw cookieError(VALIDATION_ERRORS.unavailable);
        let validation;
        try {
          validation = JSON.parse(checked.stdout);
        } catch {
          throw cookieError(VALIDATION_ERRORS.unavailable);
        }
        if (validation?.valid !== true) {
          const reason = VALIDATION_ERRORS[validation?.error] || VALIDATION_ERRORS.unavailable;
          // Retry infrastructure failures on the next operation, even if contents are unchanged.
          if (['invalid', 'empty'].includes(validation?.error)) validationCache = { key, error: reason };
          throw cookieError(reason);
        }
        validationCache = {
          key,
          contents: fs.readFileSync(snapshotPath),
          warning: validation.warnings
            ? 'yt-dlp reported warnings while loading the file. Only the cookies it loaded will be used.'
            : null,
        };
      }
      result = { snapshotPath, cleanup, lastModified, fingerprint: digest, error: null, warning: validationCache.warning };
    } catch (error) {
      if (error.code === 'EXTERNAL_COOKIES_INVALID') throw error;
      throw cookieError(VALIDATION_ERRORS.snapshot);
    }
  } catch (error) {
    cleanup();
    // Do not expose parser output, exception text, or cookie contents to logs or the API.
    result = {
      snapshotPath: null, cleanup: null, lastModified, fingerprint: null, warning: null,
      error: error.code === 'EXTERNAL_COOKIES_INVALID'
        ? error.message : `External cookies: ${VALIDATION_ERRORS.unavailable}`,
    };
  }
  reportStatus(sourcePath, result);
  return result;
}

function getExternalCookiesStatus() {
  const sourcePath = getExternalCookiesPath();
  if (!sourcePath) return null;
  const { snapshotPath, cleanup, ...status } = prepareCookieFile(sourcePath);
  cleanup?.();
  return { path: sourcePath, ready: Boolean(snapshotPath), ...status };
}

function prepareExternalCookies(args) {
  const sourcePath = getExternalCookiesPath();
  const cookieIndex = args.indexOf('--cookies');
  if (!sourcePath || cookieIndex < 0 || args[cookieIndex + 1] !== sourcePath) {
    return { args, cleanup: null };
  }

  const { snapshotPath, cleanup } = prepareCookieFile(sourcePath);
  const preparedArgs = [...args];
  if (snapshotPath) preparedArgs[cookieIndex + 1] = snapshotPath;
  else preparedArgs.splice(cookieIndex, 2);
  return { args: preparedArgs, cleanup };
}

module.exports = { getExternalCookiesPath, getExternalCookiesStatus, prepareExternalCookies };
