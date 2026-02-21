/**
 * Directory management utilities
 * Creation, validation, cleanup, and traversal operations
 */

const fs = require('fs-extra');
const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const { YOUTUBE_ID_PATTERN, SUBFOLDER_PREFIX, MAIN_VIDEO_FILE_PATTERN, FRAGMENT_FILE_PATTERN } = require('./constants');
const { sleep } = require('./fileOperations');

/**
 * Ensure a directory exists, creating it if necessary
 *
 * @param {string} dirPath - Directory path to ensure
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Ensure a directory exists with exponential backoff retries
 * Handles transient filesystem errors (EACCES on NFS stale handles, etc.)
 *
 * @param {string} dirPath - Directory path to ensure
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retry attempts (default: 5)
 * @param {number} options.delayMs - Base delay in milliseconds (default: 200)
 * @returns {Promise<void>}
 * @throws {Error} If all retries fail
 */
async function ensureDirWithRetries(dirPath, { retries = 5, delayMs = 200 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      await fs.ensureDir(dirPath);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt);
      logger.debug({ dirPath, attempt, backoff }, 'ensureDir failed, retrying after backoff');
      await sleep(backoff);
      attempt += 1;
    }
  }

  throw lastError;
}

/**
 * Ensure a directory exists synchronously
 *
 * @param {string} dirPath - Directory path to ensure
 */
function ensureDirSync(dirPath) {
  fs.ensureDirSync(dirPath);
}

/**
 * Check if a directory is empty
 *
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<boolean>} - True if directory is empty or doesn't exist
 */
async function isDirectoryEmpty(dirPath) {
  try {
    const entries = await fsPromises.readdir(dirPath);
    return entries.length === 0;
  } catch (error) {
    // Directory doesn't exist or can't be read - treat as "empty" for cleanup purposes
    logger.debug({ err: error, dirPath }, 'Cannot read directory (may not exist)');
    return false;
  }
}

/**
 * Remove a directory only if it's empty
 *
 * @param {string} dirPath - Directory path to remove
 * @returns {Promise<boolean>} - True if directory was removed
 */
async function removeIfEmpty(dirPath) {
  try {
    const isEmpty = await isDirectoryEmpty(dirPath);
    if (!isEmpty) {
      return false;
    }
    await fsPromises.rmdir(dirPath);
    logger.debug({ dirPath }, 'Removed empty directory');
    return true;
  } catch (error) {
    logger.debug({ err: error, dirPath }, 'Could not remove directory');
    return false;
  }
}

/**
 * Check if a directory is a video-specific directory
 * Video directories follow the pattern: "ChannelName - VideoTitle - VideoID"
 * where VideoID is the last segment after the final " - " separator
 *
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} - True if it's a video directory
 */
function isVideoDirectory(dirPath) {
  try {
    const dirName = path.basename(dirPath);

    // Video directories end with " - <VideoID>" where VideoID is typically 11 chars
    // Pattern: something - something - videoId
    const parts = dirName.split(' - ');
    if (parts.length < 3) {
      return false; // Not enough segments to be a video directory
    }

    const potentialVideoId = parts[parts.length - 1];

    // YouTube video IDs are 11 characters, alphanumeric plus - and _
    // Allow 10-12 chars to be flexible with other platforms
    return YOUTUBE_ID_PATTERN.test(potentialVideoId);
  } catch (error) {
    logger.error({ err: error }, 'Error checking if directory is video-specific');
    return false;
  }
}

/**
 * Check if a directory is a channel-level directory
 * A channel directory is:
 * - One level below baseDir (no subfolder): baseDir/channelName
 * - Two levels below baseDir (with subfolder): baseDir/__subfolder/channelName
 * We never want to clean up baseDir itself or subfolder directories
 *
 * @param {string} dirPath - Directory path to check
 * @param {string} baseDir - The base output directory
 * @returns {boolean} - True if it's a channel directory
 */
function isChannelDirectory(dirPath, baseDir) {
  try {
    // Normalize paths for comparison
    const normalizedDirPath = path.resolve(dirPath);
    const normalizedBaseDir = path.resolve(baseDir);

    // Cannot be baseDir itself
    if (normalizedDirPath === normalizedBaseDir) {
      return false;
    }

    // Get the parent directory
    const parentDir = path.dirname(normalizedDirPath);

    // Check if parent is baseDir (channel without subfolder)
    if (parentDir === normalizedBaseDir) {
      return true;
    }

    // Check if grandparent is baseDir (channel with subfolder)
    const grandparentDir = path.dirname(parentDir);
    if (grandparentDir === normalizedBaseDir) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error({ err: error, dirPath }, 'Error checking if directory is channel directory');
    return false;
  }
}

/**
 * Check if a directory name is a subfolder directory (starts with __ prefix)
 *
 * @param {string} dirName - Directory name to check
 * @returns {boolean} - True if it's a subfolder directory
 */
function isSubfolderDir(dirName) {
  if (!dirName) {
    return false;
  }
  return dirName.startsWith(SUBFOLDER_PREFIX);
}

/**
 * Clean up an empty channel directory
 * Only removes the directory if it's a valid channel directory and empty
 *
 * @param {string} channelDir - Channel directory path
 * @param {string} baseDir - The base output directory
 * @returns {Promise<void>}
 */
async function cleanupEmptyChannelDirectory(channelDir, baseDir) {
  try {
    // Verify this is actually a channel directory (not root or subfolder)
    if (!isChannelDirectory(channelDir, baseDir)) {
      logger.debug({ channelDir }, 'Not a channel directory, skipping cleanup');
      return;
    }

    // Check if directory exists
    try {
      await fsPromises.access(channelDir);
    } catch {
      logger.debug({ channelDir }, 'Channel directory does not exist');
      return;
    }

    // Check if directory is empty
    const isEmpty = await isDirectoryEmpty(channelDir);
    if (!isEmpty) {
      logger.debug({ channelDir }, 'Channel directory not empty, keeping it');
      return;
    }

    // Remove empty channel directory
    await fsPromises.rmdir(channelDir);
    logger.info({ channelDir }, 'Removed empty channel directory');
  } catch (error) {
    logger.error({ err: error, channelDir }, 'Error cleaning up empty channel directory');
    // Don't throw - this is a best-effort cleanup
  }
}

/**
 * Recursively clean up empty parent directories up to a stop point
 *
 * @param {string} startDir - Starting directory to check
 * @param {string} stopAt - Stop when reaching this directory (don't remove it)
 * @returns {Promise<void>}
 */
async function cleanupEmptyParents(startDir, stopAt) {
  let currentDir = startDir;
  const normalizedStopAt = path.resolve(stopAt);

  while (currentDir && path.resolve(currentDir) !== normalizedStopAt) {
    const isEmpty = await isDirectoryEmpty(currentDir);
    if (!isEmpty) {
      break;
    }

    try {
      await fsPromises.rmdir(currentDir);
      logger.debug({ currentDir }, 'Removed empty parent directory');
      currentDir = path.dirname(currentDir);
    } catch (error) {
      logger.debug({ err: error, currentDir }, 'Could not remove parent directory');
      break;
    }
  }
}

/**
 * List all entries in a directory
 *
 * @param {string} dirPath - Directory to list
 * @param {Object} options - Options
 * @param {boolean} options.withFileTypes - Return Dirent objects (default: true)
 * @returns {Promise<fs.Dirent[]|string[]>} - Directory entries
 */
async function listDirectory(dirPath, { withFileTypes = true } = {}) {
  try {
    return await fsPromises.readdir(dirPath, { withFileTypes });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }
}

/**
 * List all subdirectories in a directory
 *
 * @param {string} dirPath - Directory to scan
 * @returns {Promise<string[]>} - Array of full paths to subdirectories
 */
async function listSubdirectories(dirPath) {
  const entries = await listDirectory(dirPath);
  const dirs = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs.push(path.join(dirPath, entry.name));
    }
  }

  return dirs;
}

/**
 * Check if a file is a main video file (not a fragment or thumbnail)
 *
 * @param {string} filePath - File path to check
 * @returns {boolean} - True if it's a main video file
 */
function isMainVideoFile(filePath) {
  const filename = path.basename(filePath);
  // Main video files end with [VideoID].mp4/mkv/webm (not .fXXX.mp4)
  return MAIN_VIDEO_FILE_PATTERN.test(filename) && !FRAGMENT_FILE_PATTERN.test(filename);
}

module.exports = {
  ensureDir,
  ensureDirSync,
  ensureDirWithRetries,
  isDirectoryEmpty,
  removeIfEmpty,
  isVideoDirectory,
  isChannelDirectory,
  isSubfolderDir,
  cleanupEmptyChannelDirectory,
  cleanupEmptyParents,
  listDirectory,
  listSubdirectories,
  isMainVideoFile
};
