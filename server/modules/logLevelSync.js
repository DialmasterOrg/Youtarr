const logger = require('../logger');
const configModule = require('./configModule');

/**
 * Keeps the logger's level in step with the logLevel setting ('' means use
 * LOG_LEVEL). Runs in the server and in the yt-dlp post-processor, which is a
 * separate process with its own logger.
 */
class LogLevelSync {
  apply(options = {}) {
    logger.applyLevelSetting(configModule.getConfig().logLevel, options);
  }

  subscribe() {
    configModule.onConfigChange(() => this.apply());
  }
}

module.exports = new LogLevelSync();
