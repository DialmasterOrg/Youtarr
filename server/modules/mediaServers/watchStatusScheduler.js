const scheduledTasks = require('../scheduledTaskManager');
const { getSchedule } = require('../scheduleConfig');
const configModule = require('../configModule');
const watchStatusSync = require('./watchStatusSync');
const watchStatusRunSummary = require('./watchStatusRunSummary');

class WatchStatusScheduler {
  scheduleTask() {
    const config = configModule.getConfig();
    scheduledTasks.updateTask({
      id: 'watchStatusSyncFrequency',
      expression: getSchedule(config, 'watchStatusSyncFrequency'),
      enabled: config.watchStatusSyncEnabled !== false,
      run: () => watchStatusSync.syncAll('scheduled').then(watchStatusRunSummary.toRunRecord),
    });
  }

  subscribe() {
    if (this.subscribed) return;
    configModule.onConfigChange(this.scheduleTask.bind(this));
    this.subscribed = true;
  }
}

module.exports = new WatchStatusScheduler();
