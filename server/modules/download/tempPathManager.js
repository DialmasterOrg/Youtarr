const path = require('path');
const fs = require('fs-extra');
const configModule = require('../configModule');
const logger = require('../../logger');

// Hidden temp directory name (dot-prefix hides from media servers like Plex/Jellyfin)
const LOCAL_TEMP_DIR_NAME = '.youtarr_tmp';

/**
 * Manages temporary download paths and conversions between temp and final locations.
 * Downloads are always staged in a temporary location before moving to the final destination.
 * This prevents media servers from scanning incomplete files during download.
 *
 * When useTmpForDownloads is true: uses external tmpFilePath (e.g., /tmp) - useful for network mounts
 * When useTmpForDownloads is false: uses .youtarr_tmp/ in output directory - fast same-filesystem moves
 */
class TempPathManager {
  /**
   * Check if staging downloads is enabled (always true - downloads are always staged)
   * @returns {boolean}
   */
  isEnabled() {
    // Staging is always enabled - downloads go to temp location first, then move to final
    return true;
  }

  /**
   * Check if using external temp path (e.g., /tmp) vs local .youtarr_tmp
   * @returns {boolean} - true if useTmpForDownloads is enabled (external temp)
   */
  isUsingExternalTemp() {
    const config = configModule.getConfig();
    return config.useTmpForDownloads === true;
  }

  /**
   * Get the temporary download base path
   * When useTmpForDownloads is true: uses configured tmpFilePath (external)
   * When useTmpForDownloads is false: uses .youtarr_tmp in output directory (local)
   * @returns {string}
   */
  getTempBasePath() {
    if (this.isUsingExternalTemp()) {
      const config = configModule.getConfig();
      return config.tmpFilePath || '/tmp/youtarr-downloads';
    }
    // Local temp directory in output path
    return path.join(configModule.directoryPath, LOCAL_TEMP_DIR_NAME);
  }

  /**
   * Get the final destination base path
   * @returns {string}
   */
  getFinalBasePath() {
    return configModule.directoryPath;
  }

  /**
   * Check if a given path is in the temp directory (either external or local)
   * @param {string} filePath - Path to check
   * @returns {boolean}
   */
  isTempPath(filePath) {
    const tempBase = this.getTempBasePath();
    // Use path.resolve to normalize and remove trailing separators on all platforms
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(tempBase);

    // Check if path equals base
    if (resolvedPath === resolvedBase) {
      return true;
    }

    // Get relative path - if it doesn't start with '..' it's a descendant
    const relativePath = path.relative(resolvedBase, resolvedPath);
    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Convert a temp path to its corresponding final destination path
   * @param {string} tempPath - Path in temp directory
   * @returns {string} - Corresponding path in final directory
   */
  convertTempToFinal(tempPath) {
    if (!this.isTempPath(tempPath)) {
      // If not a temp path, return as-is (might already be final path)
      return tempPath;
    }

    const tempBase = this.getTempBasePath();
    const finalBase = this.getFinalBasePath();

    // Get the relative path from temp base
    const relativePath = path.relative(tempBase, tempPath);

    // Join with final base to get final path
    const finalPath = path.join(finalBase, relativePath);

    return finalPath;
  }

  /**
   * Convert a final destination path to its corresponding temp path
   * Mainly used for debugging and testing
   * @param {string} finalPath - Path in final directory
   * @returns {string} - Corresponding path in temp directory
   */
  convertFinalToTemp(finalPath) {
    const tempBase = this.getTempBasePath();
    const finalBase = this.getFinalBasePath();

    // Get the relative path from final base
    const relativePath = path.relative(finalBase, finalPath);

    // Join with temp base to get temp path
    const tempPath = path.join(tempBase, relativePath);

    return tempPath;
  }

  /**
   * Ensure temp directory exists and is writable
   * Creates the directory structure if it doesn't exist
   * @returns {Promise<void>}
   */
  async ensureTempDirectory() {
    const tempBase = this.getTempBasePath();

    try {
      await fs.ensureDir(tempBase);
      logger.info({ tempBasePath: tempBase }, 'Ensured temp directory exists');
    } catch (error) {
      logger.error({ tempBasePath: tempBase, err: error }, 'Failed to create temp directory');
      throw new Error(`Cannot create temp directory: ${error.message}`);
    }
  }

  /**
   * Clean temp directory by removing all contents
   * Called on server startup and before each download job starts
   * @returns {Promise<void>}
   */
  async cleanTempDirectory() {
    const tempBase = this.getTempBasePath();

    try {
      // Check if directory exists
      const exists = await fs.pathExists(tempBase);

      if (exists) {
        logger.info({ tempBasePath: tempBase }, 'Cleaning temp directory');

        // Remove entire directory
        await fs.remove(tempBase);
        logger.info('Removed temp directory');
      } else {
        logger.debug('Temp directory doesn\'t exist, nothing to clean');
      }

      // Recreate empty directory
      await fs.ensureDir(tempBase);
      logger.info({ tempBasePath: tempBase }, 'Recreated temp directory');

    } catch (error) {
      logger.error({ tempBasePath: tempBase, err: error }, 'Error cleaning temp directory');
      throw new Error(`Failed to clean temp directory: ${error.message}`);
    }
  }

  /**
   * Get status information for debugging
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.isEnabled(),
      isUsingExternalTemp: this.isUsingExternalTemp(),
      tempBasePath: this.getTempBasePath(),
      finalBasePath: this.getFinalBasePath()
    };
  }
}

module.exports = new TempPathManager();
