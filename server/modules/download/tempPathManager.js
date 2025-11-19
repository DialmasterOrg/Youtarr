const path = require('path');
const fs = require('fs-extra');
const configModule = require('../configModule');
const logger = require('../../logger');

/**
 * Manages temporary download paths and conversions between temp and final locations.
 * When useTmpForDownloads is enabled, all downloads happen in tmpFilePath first,
 * then get moved to the final location atomically to minimize network I/O.
 */
class TempPathManager {
  /**
   * Check if temporary downloads are enabled
   * @returns {boolean}
   */
  isEnabled() {
    const config = configModule.getConfig();
    return config.useTmpForDownloads === true;
  }

  /**
   * Get the temporary download base path from config
   * @returns {string}
   */
  getTempBasePath() {
    const config = configModule.getConfig();
    return config.tmpFilePath || '/tmp/youtarr-downloads';
  }

  /**
   * Get the final destination base path
   * @returns {string}
   */
  getFinalBasePath() {
    return configModule.directoryPath;
  }

  /**
   * Check if a given path is in the temp directory
   * @param {string} filePath - Path to check
   * @returns {boolean}
   */
  isTempPath(filePath) {
    if (!this.isEnabled()) {
      return false;
    }

    const tempBase = this.getTempBasePath();
    const normalized = path.normalize(filePath);
    const normalizedBase = path.normalize(tempBase);

    return normalized.startsWith(normalizedBase);
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
    if (!this.isEnabled()) {
      return;
    }

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
    if (!this.isEnabled()) {
      logger.debug('Temp downloads disabled, skipping cleanup');
      return;
    }

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
   * Move a video directory from temp to final location atomically
   * @param {string} tempPath - Source path in temp directory (can be file or directory)
   * @param {string} finalPath - Destination path (optional, calculated if not provided)
   * @returns {Promise<{success: boolean, finalPath: string, error?: string}>}
   */
  async moveToFinal(tempPath, finalPath = null) {
    try {
      // Calculate final path if not provided
      const targetPath = finalPath || this.convertTempToFinal(tempPath);

      // Determine if we're moving a directory or a file
      const stats = await fs.stat(tempPath);
      const isDirectory = stats.isDirectory();

      // For files, we need to move the parent directory (the video directory)
      const sourcePath = isDirectory ? tempPath : path.dirname(tempPath);
      const destinationPath = isDirectory ? targetPath : path.dirname(targetPath);

      logger.debug({ sourcePath, destinationPath }, 'Moving from temp to final');

      // Pre-verification: Check source exists
      const sourceExists = await fs.pathExists(sourcePath);
      if (!sourceExists) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }

      // Ensure parent directory of destination exists
      const destParent = path.dirname(destinationPath);
      await fs.ensureDir(destParent);

      // Move the directory (will copy+delete if cross-filesystem)
      await fs.move(sourcePath, destinationPath, { overwrite: true });

      // Post-verification: Check destination exists
      const destExists = await fs.pathExists(destinationPath);
      if (!destExists) {
        throw new Error(`Move completed but destination doesn't exist: ${destinationPath}`);
      }

      logger.info({ sourcePath, destinationPath }, 'Successfully moved to final location');

      return {
        success: true,
        finalPath: isDirectory ? destinationPath : path.join(destinationPath, path.basename(tempPath))
      };

    } catch (error) {
      logger.error({ tempPath, finalPath, err: error }, 'Error moving to final location');
      return {
        success: false,
        finalPath: finalPath || this.convertTempToFinal(tempPath),
        error: error.message
      };
    }
  }

  /**
   * Get status information for debugging
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.isEnabled(),
      tempBasePath: this.isEnabled() ? this.getTempBasePath() : null,
      finalBasePath: this.getFinalBasePath()
    };
  }
}

module.exports = new TempPathManager();
