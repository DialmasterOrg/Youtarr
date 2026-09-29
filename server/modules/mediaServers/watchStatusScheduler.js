const scheduledTasks = require('../scheduledTaskManager');
const { getSchedule } = require('../scheduleConfig');
const configModule = require('../configModule');
const watchStatusSync = require('./watchStatusSync');
const watchStatusRunSummary = require('./watchStatusRunSummary');
const serverRegistry = require('./serverRegistry');

class WatchStatusScheduler {
  scheduleTask() {
    const config = configModule.getConfig();
    scheduledTasks.updateTask({
      id: 'watchStatusSyncFrequency',
      expression: getSchedule(config, 'watchStatusSyncFrequency'),
      enabled: config.watchStatusSyncEnabled !== false,
      run: ({ trigger = 'scheduled' } = {}) => watchStatusSync.syncAll(trigger).then(watchStatusRunSummary.toRunRecord),
      isRunning: () => watchStatusSync.getStatus().running,
      getRunBlocker: async () => (serverRegistry.getEnabledAdapters(configModule.getConfig()).length === 0
        ? { reason: 'no-media-server', message: 'No media server is connected for watch status.' }
        : null),
    });
  }

  subscribe() {
    if (this.subscribed) return;
    configModule.onConfigChange(this.scheduleTask.bind(this));
    this.subscribed = true;
  }
}

module.exports = new WatchStatusScheduler();
