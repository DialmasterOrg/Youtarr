const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const EventEmitter = require('events');

class ConfigModule extends EventEmitter {
  constructor() {
    super();
    this.configPath = path.join(__dirname, '../../config/config.json');
    this.config = JSON.parse(fs.readFileSync(this.configPath));
    this.task = null;

    this.directoryPath = '';
    if (process.env.IN_DOCKER_CONTAINER) {
      this.directoryPath = "/usr/src/app/data";
      this.ffmpegPath = '/usr/bin/ffmpeg';
    } else {
      this.ffmpegPath = this.config.devffmpegPath;
      this.directoryPath = this.config.devYoutubeOutputDirectory;
    }

    if (!this.config.channelFilesToDownload) {
      this.config.channelFilesToDownload = 3;
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

  updateConfig(newConfig) {
    this.config = newConfig;
    this.saveConfig();
    // Emit a change event
    this.emit('change');
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  watchConfig() {
    // Watch the config file for changes
    fs.watch(this.configPath, (event, filename) => {
      if (event === 'change') {
        // Load the new config file
        this.config = JSON.parse(fs.readFileSync(this.configPath));

        // Emit a change event
        this.emit('change');
      }
    });
  }

  onConfigChange(callback) {
    this.on('change', callback);
  }
}

module.exports = new ConfigModule();
