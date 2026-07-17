const cron = require('node-cron');
const logger = require('../../logger');
const configModule = require('../configModule');
const watchStatusSync = require('./watchStatusSync');

// Belt-and-braces defaults matching config.example.json. The template merge
// normally backfills missing keys on startup, but a stale user-mounted
// config.example.json can lack them; treat "missing" as the defaults the UI
// shows (enabled, every 4 hours) so backend and frontend agree.
const DEFAULT_SYNC_FREQUENCY = '0 */4 * * *';

class WatchStatusScheduler {
  scheduleTask() {
    const config = configModule.getConfig();
    const frequency = config.watchStatusSyncFrequency || DEFAULT_SYNC_FREQUENCY;

    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    if (config.watchStatusSyncEnabled === false) {
      logger.info('Watch status sync disabled');
      return;
    }
    if (!cron.validate(frequency)) {
      logger.warn({ frequency }, 'Invalid watch status sync frequency; not scheduling');
      return;
    }

    this.task = cron.schedule(frequency, () => {
      // syncAll captures per-server failures itself; this catch covers
      // unexpected rejections (e.g. a DB outage) so nothing escapes the cron tick.
      watchStatusSync.syncAll('scheduled').catch((err) => {
        logger.error({ err }, 'Scheduled watch status sync failed');
      });
    });
    logger.info({ frequency }, 'Watch status sync scheduled');
  }

  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }
}

module.exports = new WatchStatusScheduler();
