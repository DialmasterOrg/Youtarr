const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const EventEmitter = require('events');

class ConfigModule extends EventEmitter {
  constructor() {
    super();
    this.configPath = path.join(__dirname, '../../config/config.json');

    if (process.env.DATA_PATH && !fs.existsSync(this.configPath)) {
      console.log('Platform deployment detected (DATA_PATH is set). Auto-creating config.json...');
      this.createDefaultConfig();
    }

    this.config = JSON.parse(fs.readFileSync(this.configPath));

    if (this.isPlatformDeployment()) {
      this.ensurePlatformDirectories();
    }
    this.task = null;
    this.configWatcher = null;

    this.directoryPath = '';
    if (process.env.IN_DOCKER_CONTAINER) {
      // Allow custom data path via environment variable (for Elfhosted compatibility)
      // Falls back to default /usr/src/app/data for backward compatibility
      this.directoryPath = process.env.DATA_PATH || '/usr/src/app/data';
      this.ffmpegPath = '/usr/bin/ffmpeg';
    } else {
      this.ffmpegPath = this.config.devffmpegPath;
      this.directoryPath = this.config.devYoutubeOutputDirectory;
    }

    if (!this.config.channelFilesToDownload) {
      this.config.channelFilesToDownload = 3;
    }

    if (!this.config.preferredResolution) {
      this.config.preferredResolution = '1080';
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

    // Check if a UUID exists in the config
    if (!this.config.uuid) {
      // Generate a new UUID
      this.config.uuid = uuidv4();

      // Save the new UUID to the config file
      this.saveConfig();
    }

    this.watchConfig();
  }

  getConfig() {
    return this.config;
  }

  isPlatformDeployment() {
    return !!process.env.DATA_PATH;
  }

  ensurePlatformDirectories() {
    const imagePath = this.getImagePath();
    if (!fs.existsSync(imagePath)) {
      fs.mkdirSync(imagePath, { recursive: true });
      console.log(`Created platform images directory: ${imagePath}`);
    }

    // Jobs directory is created by jobModule, but we can ensure parent exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created platform config directory: ${configDir}`);
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
    this.saveConfig();
    // Emit a change event
    this.emit('change');
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  createDefaultConfig() {
    // Ensure the config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created config directory: ${configDir}`);
    }

    // Create default config for platform deployments
    const defaultConfig = {
      // Essential settings
      youtubeOutputDirectory: process.env.DATA_PATH,
      channelFilesToDownload: 3,
      preferredResolution: '1080',
      cronSchedule: '0 */6 * * *', // Every 6 hours

      // Plex settings - use PLEX_URL if provided
      plexApiKey: '',
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

    // Generate UUID for instance identification
    defaultConfig.uuid = uuidv4();

    // Write the config file
    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Auto-created config.json with default settings at: ${this.configPath}`);
  }

  watchConfig() {
    // Watch the config file for changes
    this.configWatcher = fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        // Load the new config file
        this.config = JSON.parse(fs.readFileSync(this.configPath));

        // Emit a change event
        this.emit('change');
      }
    });
  }

  stopWatchingConfig() {
    if (this.configWatcher) {
      this.configWatcher.close();
    }
  }

  onConfigChange(callback) {
    this.on('change', callback);
  }

  async getStorageStatus() {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFilePromise = util.promisify(execFile);
    
    try {
      // Use configurable data path (falls back to /usr/src/app/data for backward compatibility)
      const dataPath = process.env.DATA_PATH || '/usr/src/app/data';
      
      // Use execFile with array arguments to prevent shell injection
      // -B 1 forces output in bytes for accurate calculations
      const { stdout } = await execFilePromise('df', ['-B', '1', dataPath]);
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
      console.error('Error getting storage status:', error);
      return null;
    }
  }
}

module.exports = new ConfigModule();
