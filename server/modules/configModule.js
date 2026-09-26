const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const EventEmitter = require('events');
const logger = require('../logger');
const { getExternalCookiesPath, getExternalCookiesStatus } = require('./externalCookies');
const { getDefaultNameForUrl } = require('./notificationHelpers');
const { SCHEDULES, normalizeToMinimumInterval, violatesMinimumInterval } = require('./scheduleConfig');
const { normalizeLevelSetting } = require('../logging/logLevel');

// Storage limit settings: a positive whole number with a unit, or '' for off.
const STORAGE_SIZE_KEYS = ['downloadPauseUsageLimit', 'downloadPauseMinFreeSpace', 'autoRemovalUsageLimit'];
const STORAGE_SIZE_PATTERN = /^[1-9]\d*(MB|GB|TB)$/;

// yt-dlp's cache (YouTube signature-function specs) lives under the config
// volume so it survives container recreation and stays writable when the
// container user has no writable home directory.
const YTDLP_CACHE_DIR_NAME = '.yt-dlp-cache';

const CONFIG_WATCH_DOCS_URL = 'https://dialmasterorg.github.io/Youtarr/docs/troubleshooting/#config-file-watcher-limit';
const CONFIG_WATCH_LIMIT_SETTINGS = {
  EMFILE: 'fs.inotify.max_user_instances',
  ENOSPC: 'fs.inotify.max_user_watches',
};
const CONFIG_WATCH_SUGGESTED_LIMITS = {
  'fs.inotify.max_user_instances': 512,
  'fs.inotify.max_user_watches': 524288,
};

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
    this.atomicParsleyPath = '/usr/bin/AtomicParsley';

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

    // Schedules below the minimum interval were saved before the floor existed.
    // Thin them within their existing hours and days instead of leaving the task
    // unscheduled and every Settings save blocked.
    for (const key of Object.keys(SCHEDULES)) {
      if (violatesMinimumInterval(this.config[key])) {
        const replacement = normalizeToMinimumInterval(this.config[key]);
        logger.info(
          { key, previous: this.config[key], replacement },
          'Schedule ran more often than the minimum interval; changed on upgrade'
        );
        this.config[key] = replacement;
        legacyMigrationNeeded = true;
      }
    }

    // Migrate notification settings to new format
    if (this.migrateNotificationSettings()) {
      legacyMigrationNeeded = true;
    }

    if (this.normalizeStorageSizeFields()) {
      legacyMigrationNeeded = true;
    }

    if (this.normalizeLogLevelSetting()) {
      legacyMigrationNeeded = true;
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
      // mode 0o640 keeps plexApiKey and other secrets out of world-readable (umask is 0o002 → 0o664 default)
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), { mode: 0o640 });
      this.tightenConfigPermissions();
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

  /**
   * Get the default subfolder for downloads
   * Used for untracked channels and channels set to "use default"
   * @returns {string|null} - Subfolder name (without __ prefix) or null if not set
   */
  getDefaultSubfolder() {
    const value = this.config.defaultSubfolder;
    return value && value.trim() !== '' ? value.trim() : null;
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

  getYtdlpCacheDir() {
    return path.join(__dirname, '../../config', YTDLP_CACHE_DIR_NAME);
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
    fs.writeFileSync(this.configPath, configContent, { mode: 0o640 });
    this.tightenConfigPermissions();

    // Clear the flag after a short delay to account for fs.watch() firing
    setTimeout(() => {
      this.isSaving = false;
    }, 200);
  }

  // chmod fails with EPERM if the file is owned by a different UID (common on upgrades
  // from older Youtarr versions). Best-effort only — the content is already saved.
  tightenConfigPermissions() {
    try {
      fs.chmodSync(this.configPath, 0o640);
    } catch (error) {
      logger.warn(
        { err: error, configPath: this.configPath },
        'Could not tighten config.json permissions to 0640; file content is saved but mode may be permissive. Run `chmod 640` on the file manually if it contains secrets.'
      );
    }
  }

  watchConfig() {
    const onConfigFileEvent = (event) => {
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

            // Migrate notification settings to new format
            if (this.migrateNotificationSettings()) {
              legacyMigrationNeeded = true;
            }

            if (this.normalizeStorageSizeFields()) {
              legacyMigrationNeeded = true;
            }

            if (this.normalizeLogLevelSetting()) {
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
    };

    // Watching config.json only exists to pick up hand edits, so a host that
    // can't provide a watcher (inotify limits exhausted) must not stop startup.
    try {
      this.configWatcher = fs.watch(this.configPath, onConfigFileEvent);
      this.configWatcher.on('error', (error) => {
        this.logConfigWatchUnavailable(error);
        this.stopWatchingConfig();
      });
    } catch (error) {
      this.configWatcher = null;
      this.logConfigWatchUnavailable(error);
    }
  }

  logConfigWatchUnavailable(error) {
    const limitSetting = CONFIG_WATCH_LIMIT_SETTINGS[error && error.code];
    const hint = limitSetting
      ? `The host's inotify limit (${limitSetting}) is exhausted, usually by many containers running as the same user. Raise it on the host, e.g. \`sysctl -w ${limitSetting}=${CONFIG_WATCH_SUGGESTED_LIMITS[limitSetting]}\`.`
      : 'The file watcher could not be created.';
    logger.warn(
      { err: error, configPath: this.configPath, docs: CONFIG_WATCH_DOCS_URL },
      `Cannot watch config.json for changes; Youtarr will keep running, but hand edits to config.json will not be picked up until restart (changes saved from the web UI are unaffected). ${hint} See ${CONFIG_WATCH_DOCS_URL}`
    );
  }

  stopWatchingConfig() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
  }

  onConfigChange(callback) {
    this.on('change', callback);
  }

  // Cookie helper methods
  getCookiesPath() {
    if (!this.config.cookiesEnabled) {
      return null;
    }

    // At launch, yt-dlp validates a private copy of the external source.
    // Unusable external cookies are omitted without changing the upload workflow.
    const externalPath = getExternalCookiesPath();
    if (externalPath) return externalPath;

    if (!this.config.customCookiesUploaded) {
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
    const external = getExternalCookiesStatus();

    return {
      cookiesEnabled: this.config.cookiesEnabled,
      customCookiesUploaded: this.config.customCookiesUploaded,
      customFileExists: customExists,
      ...(external ? { external } : {})
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
   * Migrate notification settings from legacy formats to current format.
   * Handles:
   * - discordWebhookUrl -> appriseUrls array
   * - string[] appriseUrls -> object[] with name and richFormatting
   * - Missing richFormatting field on existing objects
   * @returns {boolean} True if any migration was performed
   */
  migrateNotificationSettings() {
    let migrated = false;

    // Migrate discordWebhookUrl to appriseUrls array with Apprise discord:// format
    if (this.config.discordWebhookUrl && this.config.discordWebhookUrl.trim().length > 0) {
      if (!Array.isArray(this.config.appriseUrls)) {
        this.config.appriseUrls = [];
      }
      const rawDiscordUrl = this.config.discordWebhookUrl.trim();
      
      // Convert https://discord.com/api/webhooks/ID/TOKEN to discord://ID/TOKEN
      let appriseDiscordUrl = rawDiscordUrl;
      const discordWebhookMatch = rawDiscordUrl.match(/https?:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)/);
      if (discordWebhookMatch) {
        const [, webhookId, webhookToken] = discordWebhookMatch;
        appriseDiscordUrl = `discord://${webhookId}/${webhookToken}`;
        logger.info('Converted Discord webhook URL to Apprise format');
      }
      
      const alreadyExists = this.config.appriseUrls.some(item =>
        (typeof item === 'string' && (item === rawDiscordUrl || item === appriseDiscordUrl)) ||
        (typeof item === 'object' && (item.url === rawDiscordUrl || item.url === appriseDiscordUrl))
      );
      if (!alreadyExists) {
        this.config.appriseUrls.push({ url: appriseDiscordUrl, name: 'Discord', richFormatting: true });
        logger.info('Migrated discordWebhookUrl to appriseUrls array');
      }
      migrated = true;
    }

    // Clean up old notification fields
    if (this.config.discordWebhookUrl !== undefined || this.config.notificationService !== undefined) {
      delete this.config.discordWebhookUrl;
      delete this.config.notificationService;
      migrated = true;
    }

    // Migrate string-based appriseUrls to object format
    if (Array.isArray(this.config.appriseUrls)) {
      let needsUrlMigration = false;
      this.config.appriseUrls = this.config.appriseUrls.map(item => {
        if (typeof item === 'string') {
          needsUrlMigration = true;
          return { url: item, name: getDefaultNameForUrl(item), richFormatting: true };
        }
        if (typeof item === 'object' && item.richFormatting === undefined) {
          needsUrlMigration = true;
          return { ...item, richFormatting: true };
        }
        return item;
      });
      if (needsUrlMigration) {
        logger.info('Migrated appriseUrls to object format with richFormatting');
        migrated = true;
      }
    }

    return migrated;
  }

  /**
   * Correct or clear hand-edited storage limit settings. The UI always sends
   * the full config and /updateconfig rejects malformed sizes, so a bad value
   * left in config.json would block every Settings save; the guard already
   * ignores it, so clearing it only makes the UI match what is enforced.
   * "500 gb" becomes "500GB"; anything still invalid (including 0) becomes ''.
   * @returns {boolean} True if any value changed
   */
  normalizeStorageSizeFields() {
    let changed = false;
    for (const key of STORAGE_SIZE_KEYS) {
      const value = this.config[key];
      if (value === undefined || value === null || value === '') continue;
      const cleaned = String(value).replace(/\s+/g, '').toUpperCase();
      const replacement = STORAGE_SIZE_PATTERN.test(cleaned) ? cleaned : '';
      if (replacement === value) continue;
      logger.warn(
        { key, previous: value, replacement },
        replacement ? 'Corrected the format of a storage limit setting' : 'Cleared an invalid storage limit setting'
      );
      this.config[key] = replacement;
      changed = true;
    }
    return changed;
  }

  /**
   * Correct a hand-edited log level ("DEBUG" becomes "debug") or clear an
   * unsupported one. The UI always sends the full config and /updateconfig
   * rejects unknown levels, so a bad value would block every Settings save.
   * @returns {boolean} True if the value changed
   */
  normalizeLogLevelSetting() {
    const value = this.config.logLevel;
    if (value === undefined || value === '') return false;
    const replacement = normalizeLevelSetting(value);
    if (replacement === value) return false;
    logger.warn(
      { key: 'logLevel', previous: value, replacement },
      replacement ? 'Corrected the format of the log level setting' : 'Cleared an invalid log level setting'
    );
    this.config.logLevel = replacement;
    return true;
  }

  /**
   * Convert storage threshold string (e.g., "1GB") to bytes
   * @param {string} threshold - Threshold string like "500MB", "1GB", "2TB"
   * @returns {number|null} - Threshold in bytes, or null if invalid/not set
   */
  convertStorageThresholdToBytes(threshold) {
    if (!threshold || threshold === null) {
      return null;
    }

    const units = {
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    // Match pattern like "500MB", "1GB" or "2TB"
    const match = threshold.toString().match(/^(\d+)(MB|GB|TB)$/);
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
