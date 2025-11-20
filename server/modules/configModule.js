const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const EventEmitter = require('events');
const logger = require('../logger');

class ConfigModule extends EventEmitter {
  constructor() {
    super();
    this.configPath = path.join(__dirname, '../../config/config.json');

    // Ensure config exists before attempting to read it
    this.ensureConfigExists();

    this.config = JSON.parse(fs.readFileSync(this.configPath));

    if (this.isPlatformDeployment()) {
      this.ensurePlatformDirectories();
    }
    this.task = null;
    this.configWatcher = null;
    this.debounceTimer = null;
    this.isSaving = false;
    this.lastConfigContent = null;

    this.directoryPath = '';
    // Allow custom data path via environment variable (for Elfhosted compatibility)
    // Falls back to default /usr/src/app/data for backward compatibility
    this.directoryPath = process.env.DATA_PATH || '/usr/src/app/data';
    this.ffmpegPath = '/usr/bin/ffmpeg';

    // Merge with template to add any missing fields
    const mergeResult = this.mergeWithTemplate(this.config);
    this.config = mergeResult.config;

    // Handle legacy field name (cronSchedule → channelDownloadFrequency)
    // This is a one-time migration for old configs
    let legacyMigrationNeeded = false;
    if (this.config.cronSchedule && !this.config.channelDownloadFrequency) {
      this.config.channelDownloadFrequency = this.config.cronSchedule;
      delete this.config.cronSchedule;
      legacyMigrationNeeded = true;
      logger.info('Migrated legacy cronSchedule field to channelDownloadFrequency');
    }

    // Handle plexPort type conversion (ensure it's a string)
    if (this.config.plexPort !== undefined && typeof this.config.plexPort !== 'string') {
      this.config.plexPort = String(this.config.plexPort);
      legacyMigrationNeeded = true;
      logger.info('Converted plexPort to string type');
    }

    // Override temp download settings for Elfhosted platform
    if (this.isElfhostedPlatform()) {
      this.config.useTmpForDownloads = true;
      this.config.tmpFilePath = '/app/config/temp_downloads';
      // Don't save these overrides - they're runtime only
    }

    // Save config if modified by merge or legacy migrations
    if (mergeResult.modified || legacyMigrationNeeded) {
      this.saveConfig();
    }

    this.watchConfig();
  }

  /**
   * Get the path to config.example.json
   * Checks mounted volume first, then falls back to image built-in template
   * @returns {string} Path to config.example.json
   * @throws {Error} If config.example.json not found in either location
   */
  getConfigExamplePath() {
    const configDir = path.dirname(this.configPath);

    // First check mounted volume (user's custom config.example.json)
    const volumePath = path.join(configDir, 'config.example.json');
    if (fs.existsSync(volumePath)) {
      logger.info({ path: volumePath }, 'Using config.example.json from mounted volume');
      return volumePath;
    }

    // Fall back to image built-in template (guaranteed to exist in /app/server/)
    const templatePath = path.join(__dirname, '../config.example.json');
    if (fs.existsSync(templatePath)) {
      logger.info({ path: templatePath }, 'Using config.example.json from image template');
      return templatePath;
    }

    // Error - config.example.json is required
    const error = new Error(
      'config.example.json not found in either mounted volume or image template. ' +
      'This file is required for configuration initialization.'
    );
    logger.error({ volumePath, templatePath }, 'config.example.json not found');
    throw error;
  }

  /**
   * Deep merge two objects, preserving existing values and adding missing ones from template
   * Handles nested objects recursively
   * @param {object} template - Template object with all possible fields
   * @param {object} existing - Existing object with user values
   * @param {string} path - Current path for logging (used in recursion)
   * @returns {object} Object with { merged, fieldsAdded: string[] }
   */
  deepMerge(template, existing, path = '') {
    const merged = {};
    const fieldsAdded = [];

    // First, copy all template keys
    for (const key in template) {
      if (key === '//comment') continue; // Skip comment keys

      const templateValue = template[key];
      const existingValue = existing[key];
      const fieldPath = path ? `${path}.${key}` : key;

      if (!(key in existing)) {
        // Key missing from existing - add from template
        merged[key] = templateValue;
        fieldsAdded.push(fieldPath);
      } else if (typeof templateValue === 'object' && templateValue !== null && !Array.isArray(templateValue)) {
        // Template value is an object - existing should be too
        if (typeof existingValue === 'object' && existingValue !== null && !Array.isArray(existingValue)) {
          // Both are objects - recurse to merge nested fields
          const result = this.deepMerge(templateValue, existingValue, fieldPath);
          merged[key] = result.merged;
          fieldsAdded.push(...result.fieldsAdded);
        } else {
          // Type mismatch - template is object but existing is not
          // Fix corrupted data by using template value
          merged[key] = templateValue;
          fieldsAdded.push(fieldPath);
          logger.warn(
            { field: fieldPath, expectedType: 'object', actualType: typeof existingValue },
            'Config field has incorrect type, replacing with template value'
          );
        }
      } else {
        // Primitive or array - use existing value
        merged[key] = existingValue;
      }
    }

    // Copy any keys from existing that aren't in template (preserve extra user fields)
    for (const key in existing) {
      if (!(key in merged)) {
        merged[key] = existing[key];
      }
    }

    return { merged, fieldsAdded };
  }

  /**
   * Merge existing config with template to add missing fields
   * @param {object} existingConfig - Current config object
   * @returns {object} Object with { config: mergedConfig, modified: boolean }
   */
  mergeWithTemplate(existingConfig) {
    const examplePath = this.getConfigExamplePath();
    const templateContent = fs.readFileSync(examplePath, 'utf8');
    const templateConfig = JSON.parse(templateContent);

    // Remove comment-only keys from template
    delete templateConfig['//comment'];

    // Deep merge to handle nested objects
    const mergeResult = this.deepMerge(templateConfig, existingConfig);
    const mergedConfig = mergeResult.merged;
    const modified = mergeResult.fieldsAdded.length > 0;

    // Log all fields that were added
    if (modified) {
      mergeResult.fieldsAdded.forEach(fieldPath => {
        logger.info({ field: fieldPath }, 'Adding missing config field from template');
      });
    }

    // Preserve UUID if it exists, generate if not
    if (existingConfig.uuid) {
      mergedConfig.uuid = existingConfig.uuid;
    } else {
      mergedConfig.uuid = uuidv4();
      logger.info({ uuid: mergedConfig.uuid }, 'Generated new UUID for config');
      // Don't set modified=true here since UUID is expected to be missing on first run
    }

    return { config: mergedConfig, modified };
  }

  ensureConfigExists() {
    // If config already exists, nothing to do
    if (fs.existsSync(this.configPath)) {
      return;
    }

    logger.info('Auto-creating config.json from config.example.json template');

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info({ path: configDir }, 'Created config directory');
    }

    // Load config.example.json (will throw if not found - which is required)
    const examplePath = this.getConfigExamplePath();
    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    const defaultConfig = JSON.parse(exampleContent);

    // Remove comment-only keys
    delete defaultConfig['//comment'];

    // Generate UUID for this instance
    defaultConfig.uuid = uuidv4();

    // Apply platform-specific environment variable overrides
    if (process.env.PLEX_URL) {
      defaultConfig.plexUrl = process.env.PLEX_URL;
      logger.info({ plexUrl: process.env.PLEX_URL }, 'Applied PLEX_URL from environment');
    }

    // Write the config file and provide actionable guidance if permissions fail
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      logger.info({ configPath: this.configPath }, 'Created config.json from template');
    } catch (error) {
      if (error.code === 'EACCES') {
        const uid = typeof process.getuid === 'function' ? process.getuid() : null;
        const gid = typeof process.getgid === 'function' ? process.getgid() : null;
        logger.error(
          {
            configPath: this.configPath,
            uid,
            gid,
            youtarrUid: process.env.YOUTARR_UID,
            youtarrGid: process.env.YOUTARR_GID,
          },
          'Unable to write config.json because bind-mounted config directory is not writable. Ensure host ownership matches YOUTARR_UID/YOUTARR_GID (see README manual compose instructions).'
        );
      }
      throw error;
    }
  }

  getConfig() {
    return this.config;
  }

  isPlatformDeployment() {
    return !!process.env.DATA_PATH;
  }

  isElfhostedPlatform() {
    return process.env.PLATFORM && process.env.PLATFORM.toLowerCase() === 'elfhosted';
  }

  ensurePlatformDirectories() {
    const imagePath = this.getImagePath();
    if (!fs.existsSync(imagePath)) {
      fs.mkdirSync(imagePath, { recursive: true });
      logger.info({ path: imagePath }, 'Created platform images directory');
    }

    // Jobs directory is created by jobModule, but we can ensure parent exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info({ path: configDir }, 'Created platform config directory');
    }

    // Ensure temp download directory exists for Elfhosted
    if (this.isElfhostedPlatform()) {
      const tempDownloadPath = '/app/config/temp_downloads';
      if (!fs.existsSync(tempDownloadPath)) {
        fs.mkdirSync(tempDownloadPath, { recursive: true });
        logger.info({ path: tempDownloadPath }, 'Created Elfhosted temp downloads directory');
      }
    }
  }

  getImagePath() {
    if (this.isPlatformDeployment()) {
      return path.join(__dirname, '../../config/images');
    }
    return path.join(__dirname, '../images');
  }

  getJobsPath() {
    if (this.isPlatformDeployment()) {
      return path.join(__dirname, '../../config/jobs');
    }
    return path.join(__dirname, '../../jobs');
  }

  updateConfig(newConfig) {
    this.config = newConfig;

    // Override temp download settings for Elfhosted platform
    if (this.isElfhostedPlatform()) {
      this.config.useTmpForDownloads = true;
      this.config.tmpFilePath = '/app/config/temp_downloads';
    }

    this.saveConfig();
    // Emit a change event
    this.emit('change');
  }

  saveConfig() {
    // Create a copy of the config to save
    const configToSave = { ...this.config };

    // Deprecated -- remove from saved config
    delete configToSave.youtubeOutputDirectory;

    // Internal use only
    delete configToSave.envAuthApplied;

    // Don't save Elfhosted temp download overrides to config file
    if (this.isElfhostedPlatform()) {
      delete configToSave.useTmpForDownloads;
      delete configToSave.tmpFilePath;
    }

    // Set flag to ignore file watcher events triggered by this save
    this.isSaving = true;
    const configContent = JSON.stringify(configToSave, null, 2);
    this.lastConfigContent = configContent;
    fs.writeFileSync(this.configPath, configContent);

    // Clear the flag after a short delay to account for fs.watch() firing
    setTimeout(() => {
      this.isSaving = false;
    }, 200);
  }

  watchConfig() {
    // Watch the config file for changes
    this.configWatcher = fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        // Clear any existing debounce timer
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        // Debounce file change events to prevent rapid-fire triggers
        this.debounceTimer = setTimeout(() => {
          // Ignore changes triggered by our own saves
          if (this.isSaving) {
            return;
          }

          try {
            // Read the current file content
            const fileContent = fs.readFileSync(this.configPath, 'utf8');

            // Skip processing if content hasn't actually changed
            if (this.lastConfigContent && fileContent === this.lastConfigContent) {
              return;
            }

            // Store whether this is a new config change (for emitting event later)
            const contentChanged = !this.lastConfigContent || fileContent !== this.lastConfigContent;
            this.lastConfigContent = fileContent;

            // Load the new config file
            this.config = JSON.parse(fileContent);

            // Merge with template to add any new fields
            const mergeResult = this.mergeWithTemplate(this.config);
            this.config = mergeResult.config;

            // Handle legacy field name (cronSchedule → channelDownloadFrequency)
            let legacyMigrationNeeded = false;
            if (this.config.cronSchedule && !this.config.channelDownloadFrequency) {
              this.config.channelDownloadFrequency = this.config.cronSchedule;
              delete this.config.cronSchedule;
              legacyMigrationNeeded = true;
            }

            // Save config if modified by merge or legacy migrations
            if (mergeResult.modified || legacyMigrationNeeded) {
              this.saveConfig();
            }

            // Override temp download settings for Elfhosted platform
            if (this.isElfhostedPlatform()) {
              this.config.useTmpForDownloads = true;
              this.config.tmpFilePath = '/app/config/temp_downloads';
            }

            // Emit change event if the file content actually changed
            if (contentChanged) {
              this.emit('change');
            }
          } catch (error) {
            logger.error({ err: error }, 'Error processing config file change');
          }
        }, 100); // 100ms debounce delay
      }
    });
  }

  stopWatchingConfig() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.configWatcher) {
      this.configWatcher.close();
    }
  }

  onConfigChange(callback) {
    this.on('change', callback);
  }

  // Cookie helper methods
  getCookiesPath() {
    if (!this.config.cookiesEnabled || !this.config.customCookiesUploaded) {
      return null;
    }

    const configDir = path.dirname(this.configPath);
    const cookiePath = path.join(configDir, 'cookies.user.txt');

    // Check if the file exists
    if (fs.existsSync(cookiePath)) {
      return cookiePath;
    }

    // Log warning if cookies are enabled but file is missing
    logger.warn({ cookiePath }, 'Cookie file not found, falling back to no cookies');
    return null;
  }

  getCookiesStatus() {
    const configDir = path.dirname(this.configPath);
    const customPath = path.join(configDir, 'cookies.user.txt');
    const customExists = fs.existsSync(customPath);

    return {
      cookiesEnabled: this.config.cookiesEnabled,
      customCookiesUploaded: this.config.customCookiesUploaded,
      customFileExists: customExists
    };
  }

  writeCustomCookiesFile(buffer) {
    const configDir = path.dirname(this.configPath);
    const customPath = path.join(configDir, 'cookies.user.txt');

    // Write the file
    fs.writeFileSync(customPath, buffer);

    // Set restrictive permissions (owner read/write only)
    fs.chmodSync(customPath, 0o600);

    // Update config
    this.config.customCookiesUploaded = true;
    this.config.cookiesEnabled = true;
    this.saveConfig();
    this.emit('change');

    return customPath;
  }

  deleteCustomCookiesFile() {
    const configDir = path.dirname(this.configPath);
    const customPath = path.join(configDir, 'cookies.user.txt');

    if (fs.existsSync(customPath)) {
      fs.unlinkSync(customPath);
    }

    // Update config
    this.config.customCookiesUploaded = false;
    // Keep cookiesEnabled state unchanged
    this.saveConfig();
    this.emit('change');

    return true;
  }

  async getStorageStatus() {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFilePromise = util.promisify(execFile);

    try {
      const targetPath = process.env.DATA_PATH || '/usr/src/app/data';

      if (!targetPath) {
        logger.warn('No YouTube output directory configured, cannot check storage status');
        return null;
      }

      // Use execFile with array arguments to prevent shell injection
      // -B 1 forces output in bytes for accurate calculations
      const { stdout } = await execFilePromise('df', ['-B', '1', targetPath]);
      const lines = stdout.trim().split('\n');

      if (lines.length < 2) {
        throw new Error('Unexpected df output');
      }

      // Parse the second line which contains the actual data
      const parts = lines[1].split(/\s+/);
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const available = parseInt(parts[3]);
      const percentUsed = Math.round((used / total) * 100);

      return {
        total,
        used,
        available,
        percentUsed,
        percentFree: 100 - percentUsed,
        // Human readable versions
        totalGB: (total / (1024 ** 3)).toFixed(1),
        usedGB: (used / (1024 ** 3)).toFixed(1),
        availableGB: (available / (1024 ** 3)).toFixed(1)
      };
    } catch (error) {
      logger.error({ err: error }, 'Error getting storage status');
      return null;
    }
  }

  /**
   * Convert storage threshold string (e.g., "1GB") to bytes
   * @param {string} threshold - Threshold string like "500MB", "1GB", etc.
   * @returns {number|null} - Threshold in bytes, or null if invalid/not set
   */
  convertStorageThresholdToBytes(threshold) {
    if (!threshold || threshold === null) {
      return null;
    }

    const units = {
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    // Match pattern like "500MB" or "1GB"
    const match = threshold.toString().match(/^(\d+)(MB|GB)$/);
    if (!match) {
      logger.warn({ threshold }, 'Invalid storage threshold format');
      return null;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    return value * units[unit];
  }

  /**
   * Check if current storage is below the threshold
   * @param {number} currentAvailable - Current available bytes
   * @param {string|number} threshold - Threshold (string like "1GB" or number in bytes)
   * @returns {boolean} - true if below threshold, false otherwise
   */
  isStorageBelowThreshold(currentAvailable, threshold) {
    if (currentAvailable === null || currentAvailable === undefined) {
      logger.warn('Cannot check storage threshold: currentAvailable is null/undefined');
      return false;
    }

    let thresholdBytes;
    if (typeof threshold === 'string') {
      thresholdBytes = this.convertStorageThresholdToBytes(threshold);
    } else {
      thresholdBytes = threshold;
    }

    if (thresholdBytes === null || thresholdBytes === undefined) {
      return false;
    }

    return currentAvailable < thresholdBytes;
  }
}

module.exports = new ConfigModule();
