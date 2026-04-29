/**
 * Directory management utilities
 * Creation, validation, cleanup, and traversal operations
 */

const fs = require('fs-extra');
const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const { YOUTUBE_ID_PATTERN, SUBFOLDER_PREFIX, MAIN_VIDEO_FILE_PATTERN, FRAGMENT_FILE_PATTERN, CHANNEL_CLEANUP_IGNORABLE_FILES, APPLEDOUBLE_FILE_PATTERN } = require('./constants');
const { sleep } = require('./fileOperations');

/**
 * Decide whether a directory entry can be ignored when judging emptiness or
 * sweeping junk before rmdir. Covers both the explicit ignore list (poster.jpg,
 * .DS_Store, etc.) and AppleDouble sidecar files written by macOS SMB clients.
 *
 * @param {string} entryName - Bare file name (no path)
 * @returns {boolean}
 */
function isIgnorableEntry(entryName) {
  if (!entryName) return false;
  if (APPLEDOUBLE_FILE_PATTERN.test(entryName)) return true;
  return CHANNEL_CLEANUP_IGNORABLE_FILES.includes(entryName.toLowerCase());
}

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
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fs.ensureDir(dirPath);
      return;
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt);
      logger.debug({ dirPath, attempt, backoff }, 'ensureDir failed, retrying after backoff');
      await sleep(backoff);
    }
  }
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
 * Check if a directory is "effectively empty" — either truly empty
 * or contains only ignorable files (e.g., poster.jpg)
 *
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<boolean>} - True if directory is effectively empty
 */
async function isDirectoryEffectivelyEmpty(dirPath) {
  try {
    const entries = await fsPromises.readdir(dirPath);
    if (entries.length === 0) return true;
    return entries.every(isIgnorableEntry);
  } catch (error) {
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
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeIgnorableFiles=false] - When true, also removes directories containing only ignorable files (e.g., poster.jpg)
 * @returns {Promise<boolean>} - True if directory was removed
 */
async function cleanupEmptyChannelDirectory(channelDir, baseDir, options = {}) {
  const { includeIgnorableFiles = false } = options;

  try {
    // Verify this is actually a channel directory (not root or subfolder)
    if (!isChannelDirectory(channelDir, baseDir)) {
      logger.debug({ channelDir }, 'Not a channel directory, skipping cleanup');
      return false;
    }

    // Check if directory exists
    try {
      await fsPromises.access(channelDir);
    } catch {
      logger.debug({ channelDir }, 'Channel directory does not exist');
      return false;
    }

    // Check if directory is empty (or effectively empty)
    const isEmpty = includeIgnorableFiles
      ? await isDirectoryEffectivelyEmpty(channelDir)
      : await isDirectoryEmpty(channelDir);
    if (!isEmpty) {
      logger.debug({ channelDir }, 'Channel directory not empty, keeping it');
      return false;
    }

    // When includeIgnorableFiles is true, delete ignorable files before rmdir.
    // Filter the second readdir explicitly via isIgnorableEntry so a real video
    // file appearing between the emptiness check and this read isn't deleted.
    if (includeIgnorableFiles) {
      const entries = await fsPromises.readdir(channelDir);
      for (const entry of entries) {
        if (!isIgnorableEntry(entry)) continue;
        const filePath = path.join(channelDir, entry);
        try {
          await fsPromises.unlink(filePath);
          logger.debug({ filePath }, 'Removed ignorable file from channel directory');
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') {
            logger.warn({ err: unlinkErr, filePath }, 'Failed to remove ignorable file');
          }
        }
      }
    }

    // Remove empty channel directory
    await fsPromises.rmdir(channelDir);
    logger.info({ channelDir }, 'Removed empty channel directory');
    return true;
  } catch (error) {
    logger.error({ err: error, channelDir }, 'Error cleaning up empty channel directory');
    // Don't throw - this is a best-effort cleanup
    return false;
  }
}

/**
 * Recursively remove a directory and its contents, with resilience for
 * macOS SMB shares that race-create AppleDouble (._*) sidecar files.
 *
 * Strategy: try fs.rm with recursive+force. If rmdir fails with ENOTEMPTY
 * because junk reappeared after the recursive walk, sweep ignorable entries
 * (AppleDouble + the standard ignore list) and retry with backoff.
 *
 * Behavior:
 * - ENOENT (already gone): resolves cleanly.
 * - ENOTEMPTY: sweep ignorable entries, retry up to `retries` times.
 * - Other errors (EACCES, EPERM, etc.): rejects immediately, no retry.
 *
 * @param {string} dirPath - Directory to remove
 * @param {Object} [options]
 * @param {number} [options.retries=3] - Number of retry attempts after the initial try
 * @param {number} [options.delayMs=150] - Base delay in ms; doubles each retry
 * @returns {Promise<void>}
 */
async function removeDirectoryResilient(dirPath, { retries = 3, delayMs = 150 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fsPromises.rm(dirPath, { recursive: true, force: true });
      return;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return;
      }
      if (err.code !== 'ENOTEMPTY' || attempt === retries) {
        throw err;
      }

      // ENOTEMPTY: sweep junk that appeared after the recursive walk, then retry.
      // The directory may also have disappeared by now, so tolerate ENOENT here.
      try {
        const entries = await fsPromises.readdir(dirPath);
        for (const entry of entries) {
          if (!isIgnorableEntry(entry)) continue;
          try {
            await fsPromises.unlink(path.join(dirPath, entry));
          } catch (unlinkErr) {
            if (unlinkErr.code !== 'ENOENT') {
              logger.debug({ err: unlinkErr, dirPath, entry }, 'Failed to sweep ignorable entry before rmdir retry');
            }
          }
        }
      } catch (readErr) {
        if (readErr.code === 'ENOENT') {
          return;
        }
        throw readErr;
      }

      const backoff = delayMs * Math.pow(2, attempt);
      logger.debug({ dirPath, attempt, backoff }, 'rmdir hit ENOTEMPTY, swept ignorable entries, retrying after backoff');
      await sleep(backoff);
    }
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
  isDirectoryEffectivelyEmpty,
  removeIfEmpty,
  isVideoDirectory,
  isChannelDirectory,
  isSubfolderDir,
  cleanupEmptyChannelDirectory,
  cleanupEmptyParents,
  removeDirectoryResilient,
  isIgnorableEntry,
  listDirectory,
  listSubdirectories,
  isMainVideoFile
};
