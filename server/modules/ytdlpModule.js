/**
 * yt-dlp version management module
 * Handles checking for updates and performing yt-dlp self-updates
 */

const https = require('https');
const { spawn } = require('child_process');
const logger = require('../logger');

// Cache for latest version to avoid hitting GitHub API rate limits
let cachedLatestVersion = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000;

// Track if an update is currently in progress to prevent concurrent updates
let updateInProgress = false;

/**
 * Fetches the latest yt-dlp version from GitHub releases
 * @returns {Promise<string|null>} The latest version string or null on error
 */
async function getLatestVersion() {
  const now = Date.now();

  if (cachedLatestVersion && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedLatestVersion;
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yt-dlp/yt-dlp/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Youtarr',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            logger.warn(
              { statusCode: res.statusCode },
              'GitHub API returned non-200 status for yt-dlp version check'
            );
            resolve(cachedLatestVersion);
            return;
          }

          const release = JSON.parse(data);
          const version = release.tag_name;

          cachedLatestVersion = version;
          cacheTimestamp = now;

          resolve(version);
        } catch (err) {
          logger.error({ err }, 'Failed to parse GitHub API response for yt-dlp version');
          resolve(cachedLatestVersion);
        }
      });
    });

    req.on('error', (err) => {
      logger.error({ err }, 'Failed to fetch latest yt-dlp version from GitHub');
      resolve(cachedLatestVersion);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      logger.warn('GitHub API request timed out for yt-dlp version check');
      resolve(cachedLatestVersion);
    });

    req.end();
  });
}

/**
 * Compares two yt-dlp versions to determine if an update is available
 * yt-dlp uses date-based versioning: YYYY.MM.DD or YYYY.MM.DD.N
 * @param {string} current - Current installed version
 * @param {string} latest - Latest available version
 * @returns {boolean} True if latest is newer than current
 */
function isUpdateAvailable(current, latest) {
  if (!current || !latest) {
    return false;
  }

  const currentNorm = current.replace(/^v/, '').trim();
  const latestNorm = latest.replace(/^v/, '').trim();

  if (currentNorm === latestNorm) {
    return false;
  }

  const parseVersion = (v) => {
    const parts = v.split('.').map((p) => parseInt(p, 10) || 0);
    while (parts.length < 4) {
      parts.push(0);
    }
    return parts;
  };

  const currentParts = parseVersion(currentNorm);
  const latestParts = parseVersion(latestNorm);

  for (let i = 0; i < 4; i++) {
    if (latestParts[i] > currentParts[i]) {
      return true;
    }
    if (latestParts[i] < currentParts[i]) {
      return false;
    }
  }

  return false;
}

/**
 * Checks if a download job is currently in progress
 * @returns {boolean} True if downloads are active
 */
function isDownloadInProgress() {
  const jobModule = require('./jobModule');
  return jobModule.getInProgressJobId() !== null;
}

/**
 * Performs yt-dlp self-update
 * @returns {Promise<{success: boolean, message: string, newVersion?: string}>}
 */
function performUpdate() {
  // Prevent concurrent updates
  if (updateInProgress) {
    return Promise.resolve({
      success: false,
      message: 'An update is already in progress',
    });
  }

  // Prevent updates during active downloads
  if (isDownloadInProgress()) {
    return Promise.resolve({
      success: false,
      message: 'Cannot update while downloads are in progress. Please wait for downloads to complete.',
    });
  }

  updateInProgress = true;

  return new Promise((resolve) => {
    const timeout = 120000; // 2 minutes timeout
    let timeoutId;
    let stdout = '';
    let stderr = '';

    logger.info('Starting yt-dlp update');

    const updateProcess = spawn('yt-dlp', ['-U']);

    updateProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    updateProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    updateProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      updateInProgress = false;
      const output = stdout + stderr;

      if (code !== 0) {
        if (output.includes('Permission denied')) {
          logger.warn({ output }, 'yt-dlp update failed: permission denied');
          resolve({
            success: false,
            message:
              'Update failed: Permission denied. On managed platforms, yt-dlp may be updated by the platform operator.',
          });
          return;
        }

        logger.error({ code, output }, 'yt-dlp update failed');
        resolve({
          success: false,
          message: `Update failed with exit code ${code}`,
        });
        return;
      }

      if (output.includes('yt-dlp is up to date')) {
        logger.info('yt-dlp is already up to date');
        resolve({
          success: true,
          message: 'yt-dlp is already up to date',
        });
        return;
      }

      const versionMatch = output.match(/Updated yt-dlp to (\S+)/);
      const newVersion = versionMatch ? versionMatch[1] : null;

      cachedLatestVersion = null;
      cacheTimestamp = 0;

      logger.info({ newVersion, output }, 'yt-dlp updated successfully');
      resolve({
        success: true,
        message: newVersion ? `Successfully updated to ${newVersion}` : 'Update completed successfully',
        newVersion,
      });
    });

    updateProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      updateInProgress = false;
      logger.error({ err }, 'Failed to spawn yt-dlp update process');
      resolve({
        success: false,
        message: 'Failed to start update process',
      });
    });

    // Set up timeout
    timeoutId = setTimeout(() => {
      updateProcess.kill();
      updateInProgress = false;
      logger.warn('yt-dlp update timed out');
      resolve({
        success: false,
        message: 'Update timed out. Please try again later.',
      });
    }, timeout);
  });
}

function clearVersionCache() {
  cachedLatestVersion = null;
  cacheTimestamp = 0;
}

/**
 * Resets the update in progress state (for testing purposes)
 */
function resetUpdateState() {
  updateInProgress = false;
}

/**
 * Checks if an update is currently in progress
 * @returns {boolean}
 */
function isUpdateInProgress() {
  return updateInProgress;
}

module.exports = {
  getLatestVersion,
  isUpdateAvailable,
  performUpdate,
  clearVersionCache,
  isDownloadInProgress,
  resetUpdateState,
  isUpdateInProgress,
};
