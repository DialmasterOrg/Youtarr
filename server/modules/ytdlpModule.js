/**
 * yt-dlp version management module
 * Handles checking for updates and performing yt-dlp self-updates
 */

const https = require('https');
const { spawn } = require('child_process');
const logger = require('../logger');

// Lazy-loaded to avoid circular dependency issues during test mocking
let _tempPathManager = null;
function getTempPathManager() {
  if (!_tempPathManager) {
    _tempPathManager = require('./download/tempPathManager');
  }
  return _tempPathManager;
}

// Cache for latest versions (per channel) to avoid hitting GitHub API rate limits
const CACHE_DURATION_MS = 15 * 60 * 1000;

const VALID_CHANNELS = ['stable', 'nightly'];

const RELEASE_API_PATHS = {
  stable: '/repos/yt-dlp/yt-dlp/releases/latest',
  nightly: '/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest',
};

// Nightly tags end in a 6-digit HHMMSS build timestamp (e.g. 2026.08.18.013021);
// stable point releases use short integers (e.g. 2023.07.06.1)
const NIGHTLY_BUILD_SUFFIX_LENGTH = 6;

const versionCache = {
  stable: { version: null, timestamp: 0 },
  nightly: { version: null, timestamp: 0 },
};

function normalizeChannel(channel) {
  return VALID_CHANNELS.includes(channel) ? channel : 'stable';
}

// Track if an update is currently in progress to prevent concurrent updates
let updateInProgress = false;

/**
 * Fetches the latest yt-dlp version from GitHub releases for the given channel
 * @param {string} [channel] - 'stable' or 'nightly' (defaults to 'stable')
 * @returns {Promise<string|null>} The latest version string or null on error
 */
async function getLatestVersion(channel) {
  const updateChannel = normalizeChannel(channel);
  const cache = versionCache[updateChannel];
  const now = Date.now();

  if (cache.version && now - cache.timestamp < CACHE_DURATION_MS) {
    return cache.version;
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: RELEASE_API_PATHS[updateChannel],
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
              { statusCode: res.statusCode, channel: updateChannel },
              'GitHub API returned non-200 status for yt-dlp version check'
            );
            resolve(cache.version);
            return;
          }

          const release = JSON.parse(data);
          const version = release.tag_name;

          cache.version = version;
          cache.timestamp = now;

          resolve(version);
        } catch (err) {
          logger.error({ err, channel: updateChannel }, 'Failed to parse GitHub API response for yt-dlp version');
          resolve(cache.version);
        }
      });
    });

    req.on('error', (err) => {
      logger.error({ err, channel: updateChannel }, 'Failed to fetch latest yt-dlp version from GitHub');
      resolve(cache.version);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      logger.warn({ channel: updateChannel }, 'GitHub API request timed out for yt-dlp version check');
      resolve(cache.version);
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
 * @param {Object} [options]
 * @param {string} [options.channel] - 'stable' or 'nightly' (defaults to 'stable')
 * @returns {Promise<{success: boolean, reason: 'updated'|'up-to-date'|'skipped'|'error', message: string, newVersion?: string}>}
 */
function performUpdate({ channel } = {}) {
  const updateChannel = normalizeChannel(channel);

  // Prevent concurrent updates
  if (updateInProgress) {
    return Promise.resolve({
      success: false,
      reason: 'skipped',
      message: 'An update is already in progress',
    });
  }

  // Replacing the binary is safe while downloads run: on Linux the running
  // yt-dlp process keeps its old inode and finishes on the previous version.
  if (isDownloadInProgress()) {
    logger.info(
      { channel: updateChannel },
      'yt-dlp update starting while a download is active; in-flight jobs continue on the previous version'
    );
  }

  updateInProgress = true;

  return new Promise((resolve) => {
    const timeout = 120000; // 2 minutes timeout
    let timeoutId;
    let stdout = '';
    let stderr = '';

    logger.info({ channel: updateChannel }, 'Starting yt-dlp update');

    const updateProcess = spawn('yt-dlp', ['--update-to', `${updateChannel}@latest`], {
      env: {
        ...process.env,
        TMPDIR: getTempPathManager().getTempBasePath()
      }
    });

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
        if (output.includes('Permission denied') || output.includes('Unable to write to')) {
          logger.warn({ output }, 'yt-dlp update failed: permission denied');
          resolve({
            success: false,
            reason: 'error',
            message:
              'Update failed: Permission denied. On managed platforms, yt-dlp may be updated by the platform operator.',
          });
          return;
        }

        logger.error({ code, output }, 'yt-dlp update failed');
        resolve({
          success: false,
          reason: 'error',
          message: `Update failed with exit code ${code}`,
        });
        return;
      }

      if (output.includes('yt-dlp is up to date')) {
        logger.info('yt-dlp is already up to date');
        resolve({
          success: true,
          reason: 'up-to-date',
          message: 'yt-dlp is already up to date',
        });
        return;
      }

      const versionMatch = output.match(/Updated yt-dlp to (\S+)/);
      const newVersion = versionMatch
        ? versionMatch[1].replace(/^(?:stable|nightly)@/, '')
        : null;

      clearVersionCache();

      logger.info({ newVersion, output }, 'yt-dlp updated successfully');
      resolve({
        success: true,
        reason: 'updated',
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
        reason: 'error',
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
        reason: 'error',
        message: 'Update timed out. Please try again later.',
      });
    }, timeout);
  });
}

function clearVersionCache() {
  // Mutate the per-channel objects in place: an in-flight getLatestVersion()
  // holds a reference and must write into the live cache, not a detached object.
  VALID_CHANNELS.forEach((channel) => {
    versionCache[channel].version = null;
    versionCache[channel].timestamp = 0;
  });
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

/**
 * Detects nightly-channel builds by their version shape.
 * @param {string|null} version
 * @returns {boolean}
 */
function isNightlyVersion(version) {
  if (!version) {
    return false;
  }
  const parts = version.replace(/^v/, '').trim().split('.');
  if (parts.length < 4) {
    return false;
  }
  const suffix = parts[3];
  return suffix.length === NIGHTLY_BUILD_SUFFIX_LENGTH && /^\d+$/.test(suffix);
}

/**
 * True when the installed binary does not match the configured channel
 * (e.g. a container recreation reset a nightly install back to baked-in stable).
 * @param {string|undefined} configuredChannel
 * @param {string|null} installedVersion
 * @returns {boolean}
 */
function shouldReapplyChannel(configuredChannel, installedVersion) {
  if (!installedVersion) {
    return false;
  }
  return normalizeChannel(configuredChannel) === 'nightly'
    ? !isNightlyVersion(installedVersion)
    : isNightlyVersion(installedVersion);
}

module.exports = {
  getLatestVersion,
  isUpdateAvailable,
  performUpdate,
  clearVersionCache,
  resetUpdateState,
  isUpdateInProgress,
  normalizeChannel,
  isNightlyVersion,
  shouldReapplyChannel,
};
