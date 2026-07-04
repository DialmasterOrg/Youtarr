/**
 * Resilient file operations with retries and safe error handling
 * All I/O operations for files are centralized here
 */

const fs = require('fs-extra');
const fsPromises = require('fs').promises;
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const logger = require('../../logger');

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Some FUSE-backed filesystems (e.g. rclone mounts) return EPERM instead of
 * EXDEV/EOPNOTSUPP when Node's copy_file_range-based fs.copyFile is used for
 * a cross-device copy, and fs-extra doesn't fall back to a plain read/write
 * copy in that case. The system 'cp' binary handles this correctly, so shell
 * out to it as a last resort.
 *
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {boolean} overwrite - Whether to overwrite an existing destination
 * @returns {Promise<void>}
 */
async function moveViaCpFallback(src, dest, overwrite) {
  if (overwrite) {
    await fs.remove(dest);
  }
  // Plain recursive copy, no -a/--preserve: some FUSE mounts (e.g. rclone)
  // reject utimes()/chown() on the destination with EPERM even though the
  // actual data copy is allowed.
  await execFileAsync('cp', ['-r', '--', src, dest]);
  await fs.remove(src);
}

/**
 * Move a file or directory with exponential backoff retries
 * Handles transient filesystem errors that can occur during cross-device moves
 *
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retry attempts (default: 5)
 * @param {number} options.delayMs - Base delay in milliseconds (default: 200)
 * @param {boolean} options.overwrite - Whether to overwrite existing (default: true)
 * @returns {Promise<void>}
 * @throws {Error} If all retries fail
 */
async function moveWithRetries(src, dest, { retries = 5, delayMs = 200, overwrite = true } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fs.move(src, dest, { overwrite });
      return;
    } catch (err) {
      if (err && err.code === 'EPERM' && err.syscall === 'copyfile') {
        try {
          await moveViaCpFallback(src, dest, overwrite);
          logger.warn({ src, dest }, 'Move succeeded via cp fallback after EPERM from fs.move');
          return;
        } catch (fallbackErr) {
          logger.warn({ src, dest, fallbackErr }, 'cp fallback for cross-device move also failed');
          throw fallbackErr;
        }
      }
      if (attempt === retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt);
      logger.debug({ src, dest, attempt, backoff }, 'Move failed, retrying after backoff');
      await sleep(backoff);
    }
  }
}

/**
 * Remove a file or directory, ignoring ENOENT errors (already deleted)
 * Safe for cleanup operations where the file may already be gone
 *
 * @param {string} filePath - Path to remove
 * @returns {Promise<void>}
 */
async function safeRemove(filePath) {
  try {
    await fs.remove(filePath);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      logger.warn({ err, filePath }, 'Error deleting file');
    }
  }
}

/**
 * Synchronous copy with the same EPERM/copy_file_range fallback as
 * moveWithRetries, for call sites that use fs.copySync directly.
 *
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {Object} options - Options
 * @param {boolean} options.overwrite - Whether to overwrite existing (default: true)
 */
function copySyncWithFallback(src, dest, { overwrite = true } = {}) {
  try {
    fs.copySync(src, dest, { overwrite });
  } catch (err) {
    if (err && err.code === 'EPERM' && err.syscall === 'copyfile') {
      if (overwrite) {
        fs.removeSync(dest);
      }
      execFileSync('cp', ['-r', '--', src, dest]);
      return;
    }
    throw err;
  }
}

/**
 * Copy a file with optional overwrite protection
 *
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @param {Object} options - Options
 * @param {boolean} options.overwrite - Whether to overwrite existing (default: false)
 * @returns {Promise<void>}
 */
async function safeCopy(src, dest, { overwrite = false } = {}) {
  try {
    await fs.copy(src, dest, { overwrite });
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      logger.warn({ err, src, dest }, 'Error copying file');
      throw err;
    }
  }
}

/**
 * Check if a path exists (file or directory)
 * Safe version that handles permission errors
 *
 * @param {string} targetPath - Path to check
 * @returns {Promise<boolean>} - True if path exists
 */
async function pathExists(targetPath) {
  try {
    await fsPromises.access(targetPath);
    return true;
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return false;
    }
    throw err;
  }
}

/**
 * Get file/directory stats, returning null if not found
 * Safe version that doesn't throw on missing files
 *
 * @param {string} filePath - Path to stat
 * @returns {Promise<{path: string, stats: fs.Stats}|null>} - Stats object or null
 */
async function safeStat(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    return { path: filePath, stats };
  } catch (err) {
    if (!err || (err.code !== 'ENOENT' && err.code !== 'ENOTDIR')) {
      throw err;
    }
    return null;
  }
}

/**
 * Set file timestamps (access time and modification time)
 *
 * @param {string} filePath - Path to the file
 * @param {Date|number} timestamp - The timestamp to set (Date object or Unix time in seconds)
 * @returns {Promise<void>}
 */
async function setTimestamp(filePath, timestamp) {
  const time = timestamp instanceof Date ? timestamp : new Date(timestamp * 1000);
  await fsPromises.utimes(filePath, time, time);
}

/**
 * Set file timestamps synchronously
 *
 * @param {string} filePath - Path to the file
 * @param {Date|number} timestamp - The timestamp to set (Date object or Unix time in seconds)
 */
function setTimestampSync(filePath, timestamp) {
  const time = timestamp instanceof Date ? timestamp : new Date(timestamp * 1000);
  require('fs').utimesSync(filePath, time, time);
}

/**
 * Read file contents
 *
 * @param {string} filePath - Path to the file
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<string>} - File contents
 */
async function readFile(filePath, encoding = 'utf8') {
  return fsPromises.readFile(filePath, encoding);
}

/**
 * Write file contents
 *
 * @param {string} filePath - Path to the file
 * @param {string|Buffer} content - Content to write
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<void>}
 */
async function writeFile(filePath, content, encoding = 'utf8') {
  await fsPromises.writeFile(filePath, content, encoding);
}

/**
 * Append content to a file
 *
 * @param {string} filePath - Path to the file
 * @param {string} content - Content to append
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<void>}
 */
async function appendFile(filePath, content, encoding = 'utf8') {
  await fsPromises.appendFile(filePath, content, encoding);
}

/**
 * Check if a path is a file
 *
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - True if path is a file
 */
async function isFile(filePath) {
  const result = await safeStat(filePath);
  return result ? result.stats.isFile() : false;
}

/**
 * Check if a path is a directory
 *
 * @param {string} dirPath - Path to check
 * @returns {Promise<boolean>} - True if path is a directory
 */
async function isDirectory(dirPath) {
  const result = await safeStat(dirPath);
  return result ? result.stats.isDirectory() : false;
}

module.exports = {
  sleep,
  moveWithRetries,
  safeRemove,
  safeCopy,
  copySyncWithFallback,
  pathExists,
  safeStat,
  setTimestamp,
  setTimestampSync,
  readFile,
  writeFile,
  appendFile,
  isFile,
  isDirectory
};
