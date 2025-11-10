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

    // Override temp download settings for Elfhosted platform
    if (this.isElfhostedPlatform()) {
      this.config.useTmpForDownloads = true;
      this.config.tmpFilePath = '/app/config/temp_downloads';
    }

    let configModified = false;

    if (!this.config.channelFilesToDownload) {
      this.config.channelFilesToDownload = 3;
    }

    if (!this.config.preferredResolution) {
      this.config.preferredResolution = '1080';
    }

    if (!this.config.videoCodec) {
      this.config.videoCodec = 'default';
      configModified = true;
    }

    if (this.config.plexPort === undefined || this.config.plexPort === null || this.config.plexPort === '') {
      this.config.plexPort = '32400';
      configModified = true;
    } else if (typeof this.config.plexPort !== 'string') {
      this.config.plexPort = String(this.config.plexPort);
      configModified = true;
    }

    // Initialize channel auto-download settings if not present
    if (this.config.channelAutoDownload === undefined) {
      this.config.channelAutoDownload = false;
      configModified = true;
    }

    if (!this.config.channelDownloadFrequency) {
      // Check if cronSchedule exists (backward compatibility for misconfigured files)
      if (this.config.cronSchedule) {
        this.config.channelDownloadFrequency = this.config.cronSchedule;
        delete this.config.cronSchedule; // Remove the incorrect field
        configModified = true;
      } else {
        this.config.channelDownloadFrequency = '0 */6 * * *'; // Default: every 6 hours
        configModified = true;
      }
    }

    // Initialize Sponsorblock settings if not present
    if (this.config.sponsorblockEnabled === undefined) {
      this.config.sponsorblockEnabled = false;
    }

    if (!this.config.sponsorblockAction) {
      this.config.sponsorblockAction = 'remove'; // 'remove' or 'mark'
    }

    if (!this.config.sponsorblockCategories) {
      this.config.sponsorblockCategories = {
        sponsor: true,
        intro: false,
        outro: false,
        selfpromo: true,
        preview: false,
        filler: false,
        interaction: false,
        music_offtopic: false
      };
    }

    // sponsorblockApiUrl is optional, defaults to empty string (uses default API)
    if (this.config.sponsorblockApiUrl === undefined) {
      this.config.sponsorblockApiUrl = '';
    }

    // Initialize download performance settings if not present
    if (this.config.downloadSocketTimeoutSeconds === undefined) {
      this.config.downloadSocketTimeoutSeconds = 30;
    }

    if (!this.config.downloadThrottledRate) {
      this.config.downloadThrottledRate = '100K';
    }

    if (this.config.downloadRetryCount === undefined) {
      this.config.downloadRetryCount = 2;
    }

    if (this.config.enableStallDetection === undefined) {
      this.config.enableStallDetection = true;
    }

    if (this.config.stallDetectionWindowSeconds === undefined) {
      this.config.stallDetectionWindowSeconds = 30;
    }

    if (!this.config.stallDetectionRateThreshold) {
      this.config.stallDetectionRateThreshold = this.config.downloadThrottledRate || '100K';
    }

    // Initialize cookie configuration if not present
    if (this.config.cookiesEnabled === undefined) {
      this.config.cookiesEnabled = false;
    }

    if (this.config.customCookiesUploaded === undefined) {
      this.config.customCookiesUploaded = false;
    }

    if (this.config.writeChannelPosters === undefined) {
      this.config.writeChannelPosters = true;
      configModified = true;
    }

    if (this.config.writeVideoNfoFiles === undefined) {
      this.config.writeVideoNfoFiles = true;
      configModified = true;
    }

    // Initialize notification settings if not present
    if (this.config.notificationsEnabled === undefined) {
      this.config.notificationsEnabled = false;
      configModified = true;
    }

    if (!this.config.notificationService) {
      this.config.notificationService = 'discord';
      configModified = true;
    }

    if (this.config.discordWebhookUrl === undefined) {
      this.config.discordWebhookUrl = '';
      configModified = true;
    }

    // Initialize automatic video removal settings if not present
    if (this.config.autoRemovalEnabled === undefined) {
      this.config.autoRemovalEnabled = false;
      configModified = true;
    }

    if (this.config.autoRemovalFreeSpaceThreshold === undefined) {
      this.config.autoRemovalFreeSpaceThreshold = null;
      configModified = true;
    }

    if (this.config.autoRemovalVideoAgeThreshold === undefined) {
      this.config.autoRemovalVideoAgeThreshold = null;
      configModified = true;
    }

    // Initialize temp download settings if not present
    if (this.config.useTmpForDownloads === undefined) {
      this.config.useTmpForDownloads = false;
      configModified = true;
    }

    if (!this.config.tmpFilePath) {
      this.config.tmpFilePath = '/tmp/youtarr-downloads';
      configModified = true;
    }

    // Initialize subtitle settings if not present
    if (this.config.subtitlesEnabled === undefined) {
      this.config.subtitlesEnabled = false;
      configModified = true;
    }

    if (!this.config.subtitleLanguage) {
      this.config.subtitleLanguage = 'en';
      configModified = true;
    }

    // Check if a UUID exists in the config
    if (!this.config.uuid) {
      // Generate a new UUID
      this.config.uuid = uuidv4();
      configModified = true;
    }

    // Save config if any defaults were added
    if (configModified) {
      this.saveConfig();
    }

    // Apply migrations after loading and initializing defaults
    this.config = this.migrateConfig(this.config);

    this.watchConfig();
  }

  ensureConfigExists() {
    // If config already exists, nothing to do
    if (fs.existsSync(this.configPath)) {
      return;
    }

    // Handle platform deployments with DATA_PATH
    if (process.env.DATA_PATH) {
      logger.info('Platform deployment detected (DATA_PATH is set). Auto-creating config.json...');
      this.createDefaultConfig();
      return;
    }

    // Handle Docker deployments without DATA_PATH
    logger.info('Auto-creating config.json (docker default without DATA_PATH)');

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let defaultConfig;

    // Try to load from config.example.json first
    try {
      const examplePath = path.join(configDir, 'config.example.json');
      const exampleContent = fs.readFileSync(examplePath, 'utf8');
      const exampleConfig = JSON.parse(exampleContent);

      // Remove comment-only keys
      delete exampleConfig['//comment'];

      // Use example as base
      defaultConfig = exampleConfig;
    } catch (error) {
      logger.info('Could not load config.example.json, using inline defaults');

      // Fallback to minimal defaults if example file unavailable
      defaultConfig = {
        channelFilesToDownload: 3,
        preferredResolution: '1080',
        videoCodec: 'default',
        channelAutoDownload: false,
        channelDownloadFrequency: '0 */6 * * *',
        plexApiKey: '',
        plexPort: '32400',
        plexLibrarySection: '',
        youtubeApiKey: '',
        sponsorblockEnabled: false,
        sponsorblockAction: 'remove',
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: false,
          music_offtopic: false
        },
        sponsorblockApiUrl: '',
        downloadSocketTimeoutSeconds: 30,
        downloadThrottledRate: '100K',
        downloadRetryCount: 2,
        enableStallDetection: true,
        stallDetectionWindowSeconds: 30,
        stallDetectionRateThreshold: '100K',
        cookiesEnabled: false,
        customCookiesUploaded: false,
        writeChannelPosters: true,
        writeVideoNfoFiles: true,
        notificationsEnabled: false,
        notificationService: 'discord',
        discordWebhookUrl: '',
        useTmpForDownloads: false,
        tmpFilePath: '/tmp/youtarr-downloads',
        subtitlesEnabled: false,
        subtitleLanguage: 'en'
      };
    }

    // Generate UUID
    defaultConfig.uuid = uuidv4();

    // Write the config file
    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
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

  createDefaultConfig() {
    // Ensure the config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info({ path: configDir }, 'Created config directory');
    }

    // Create default config for platform deployments
    const defaultConfig = {
      channelFilesToDownload: 3,
      preferredResolution: '1080',
      videoCodec: 'default',

      // Channel auto-download settings
      channelAutoDownload: false,
      channelDownloadFrequency: '0 */6 * * *', // Default: every 6 hours

      // Plex settings - use PLEX_URL if provided
      plexApiKey: '',
      plexPort: '32400',
      plexLibrarySection: ''
    };

    // Add Plex URL if provided by platform
    if (process.env.PLEX_URL) {
      defaultConfig.plexUrl = process.env.PLEX_URL;
    }

    // YouTube API - optional, for browsing channels
    defaultConfig.youtubeApiKey = '';

    // SponsorBlock settings - disabled by default
    defaultConfig.sponsorblockEnabled = false;
    defaultConfig.sponsorblockAction = 'remove';
    defaultConfig.sponsorblockCategories = {
      sponsor: true,
      intro: false,
      outro: false,
      selfpromo: true,
      preview: false,
      filler: false,
      interaction: false,
      music_offtopic: false
    };
    defaultConfig.sponsorblockApiUrl = '';

    // Download performance settings - defaults for new installs
    defaultConfig.downloadSocketTimeoutSeconds = 30;
    defaultConfig.downloadThrottledRate = '100K';
    defaultConfig.downloadRetryCount = 2;
    defaultConfig.enableStallDetection = true;
    defaultConfig.stallDetectionWindowSeconds = 30;
    defaultConfig.stallDetectionRateThreshold = '100K';

    // Cookie configuration - disabled by default
    defaultConfig.cookiesEnabled = false;
    defaultConfig.customCookiesUploaded = false;

    // Media server compatibility features enabled by default
    defaultConfig.writeChannelPosters = true;
    defaultConfig.writeVideoNfoFiles = true;

    // Notification settings - disabled by default
    defaultConfig.notificationsEnabled = false;
    defaultConfig.notificationService = 'discord';
    defaultConfig.discordWebhookUrl = '';

    // Temp download settings - disabled by default
    defaultConfig.useTmpForDownloads = false;
    defaultConfig.tmpFilePath = '/tmp/youtarr-downloads';

    // Subtitle settings - disabled by default
    defaultConfig.subtitlesEnabled = false;
    defaultConfig.subtitleLanguage = 'en';

    // Generate UUID for instance identification
    defaultConfig.uuid = uuidv4();

    // Write the config file
    defaultConfig.plexPort = '32400';

    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    logger.info({ configPath: this.configPath }, 'Auto-created config.json with default settings');
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

            // Migrate cronSchedule to channelDownloadFrequency if needed
            if (!this.config.channelDownloadFrequency && this.config.cronSchedule) {
              this.config.channelDownloadFrequency = this.config.cronSchedule;
              delete this.config.cronSchedule;
              // Save the corrected config
              this.saveConfig();
            }

            // Apply configuration migrations to ensure new defaults exist
            const migratedConfig = this.migrateConfig(this.config);
            const needsMigrationSave = JSON.stringify(migratedConfig) !== JSON.stringify(this.config);
            this.config = migratedConfig;

            if (needsMigrationSave) {
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

  migrateConfig(config) {
    // Migration function to add new fields to existing configs
    const migrations = {
      '1.23.0': (cfg) => {
        const migrated = { ...cfg };

        // Add download performance settings if they don't exist
        if (migrated.downloadSocketTimeoutSeconds === undefined) {
          migrated.downloadSocketTimeoutSeconds = 30;
        }
        if (!migrated.downloadThrottledRate) {
          migrated.downloadThrottledRate = '100K';
        }
        if (migrated.downloadRetryCount === undefined) {
          migrated.downloadRetryCount = 2;
        }
        if (migrated.enableStallDetection === undefined) {
          migrated.enableStallDetection = true;
        }
        if (migrated.stallDetectionWindowSeconds === undefined) {
          migrated.stallDetectionWindowSeconds = 30;
        }
        if (!migrated.stallDetectionRateThreshold) {
          migrated.stallDetectionRateThreshold = migrated.downloadThrottledRate || '100K';
        }

        return migrated;
      },
      '1.24.0': (cfg) => {
        const migrated = { ...cfg };

        // Add cookie configuration if it doesn't exist
        if (migrated.cookiesEnabled === undefined) {
          migrated.cookiesEnabled = false;
        }
        if (migrated.customCookiesUploaded === undefined) {
          migrated.customCookiesUploaded = false;
        }

        return migrated;
      },
      '1.25.0': (cfg) => {
        const migrated = { ...cfg };

        if (migrated.writeChannelPosters === undefined) {
          migrated.writeChannelPosters = true;
        }

        if (migrated.writeVideoNfoFiles === undefined) {
          migrated.writeVideoNfoFiles = true;
        }

        return migrated;
      },
      '1.26.0': (cfg) => {
        const migrated = { ...cfg };

        if (migrated.plexPort === undefined || migrated.plexPort === null || migrated.plexPort === '') {
          migrated.plexPort = '32400';
        } else if (typeof migrated.plexPort !== 'string') {
          migrated.plexPort = String(migrated.plexPort);
        }

        return migrated;
      },
      '1.35.0': (cfg) => {
        const migrated = { ...cfg };

        // Add notification settings
        if (migrated.notificationsEnabled === undefined) {
          migrated.notificationsEnabled = false;
        }
        if (!migrated.notificationService) {
          migrated.notificationService = 'discord';
        }
        if (migrated.discordWebhookUrl === undefined) {
          migrated.discordWebhookUrl = '';
        }

        return migrated;
      },
      '1.36.0': (cfg) => {
        const migrated = { ...cfg };

        // Add automatic video removal settings
        if (migrated.autoRemovalEnabled === undefined) {
          migrated.autoRemovalEnabled = false;
        }
        if (migrated.autoRemovalFreeSpaceThreshold === undefined) {
          migrated.autoRemovalFreeSpaceThreshold = null;
        }
        if (migrated.autoRemovalVideoAgeThreshold === undefined) {
          migrated.autoRemovalVideoAgeThreshold = null;
        }
        return migrated;
      },
      '1.38.0': (cfg) => {
        const migrated = { ...cfg };

        // Add video codec preference setting
        if (!migrated.videoCodec) {
          migrated.videoCodec = 'default';
        }

        return migrated;
      },
      '1.42.0': (cfg) => {
        const migrated = { ...cfg };

        // Add temp download settings
        if (migrated.useTmpForDownloads === undefined) {
          migrated.useTmpForDownloads = false;
        }
        if (!migrated.tmpFilePath) {
          migrated.tmpFilePath = '/tmp/youtarr-downloads';
        }

        return migrated;
      },
      '1.43.0': (cfg) => {
        const migrated = { ...cfg };

        // Add subtitle settings
        if (migrated.subtitlesEnabled === undefined) {
          migrated.subtitlesEnabled = false;
        }
        if (!migrated.subtitleLanguage) {
          migrated.subtitleLanguage = 'en';
        }

        return migrated;
      }
    };

    let migrated = { ...config };
    Object.values(migrations).forEach(migration => {
      migrated = migration(migrated);
    });

    return migrated;
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
