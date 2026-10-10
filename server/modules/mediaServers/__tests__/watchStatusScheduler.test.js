jest.mock('node-cron', () => ({ schedule: jest.fn(), validate: jest.fn(() => true), getTasks: jest.fn(() => new Map()) }));
jest.mock('../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(), onConfigChange: jest.fn() }));
jest.mock('../watchStatusSync', () => ({
  syncAll: jest.fn().mockResolvedValue({}),
  getStatus: jest.fn(() => ({ running: false })),
}));
jest.mock('../../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn(() => [{}]) }));

describe('watchStatusScheduler', () => {
  let scheduler;
  let cron;
  let configModule;
  let watchStatusSync;
  let serverRegistry;
  let scheduledTaskManager;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    cron = require('node-cron');
    cron.validate.mockReturnValue(true);
    cron.schedule.mockImplementation(() => ({ start: jest.fn(), stop: jest.fn() }));
    configModule = require('../../configModule');
    watchStatusSync = require('../watchStatusSync');
    watchStatusSync.getStatus.mockReturnValue({ running: false });
    serverRegistry = require('../serverRegistry');
    serverRegistry.getEnabledAdapters.mockReturnValue([{}]);

    scheduledTaskManager = require('../../scheduledTaskManager');
    scheduler = require('../watchStatusScheduler');
  });

  test('schedules the sync when enabled', () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    expect(cron.schedule).toHaveBeenCalledWith('0 */4 * * *', expect.any(Function), expect.objectContaining({ scheduled: false }));
  });

  test('the scheduled callback runs syncAll with the scheduled trigger', () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    const callback = cron.schedule.mock.calls[0][1];
    callback();
    expect(watchStatusSync.syncAll).toHaveBeenCalledWith('scheduled');
  });

  test('the scheduled callback resolves to a run record describing the sync', async () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    watchStatusSync.syncAll.mockResolvedValue({
      servers: { plex: { changed: 1 } },
      totals: { changed: 1 },
    });
    scheduler.scheduleTask();
    await expect(cron.schedule.mock.calls[0][1]()).resolves.toEqual(expect.objectContaining({
      status: 'success', outcome: 'completed', message: 'Synced 1 server; 1 video had a watch status change.',
    }));
  });

  test('a sync that was already running is recorded as skipped, not success', async () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    watchStatusSync.syncAll.mockResolvedValue({ skipped: 'already running', trigger: 'scheduled' });
    scheduler.scheduleTask();
    await expect(cron.schedule.mock.calls[0][1]()).resolves.toEqual(expect.objectContaining({ status: 'skipped' }));
  });

  test('does not schedule when disabled', () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: false, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('treats missing config keys as enabled with the default frequency', () => {
    // A stale user-mounted config.example.json can leave the new keys
    // unmerged; the scheduler must match the UI's defaults, not go dark.
    configModule.getConfig.mockReturnValue({});
    scheduler.scheduleTask();
    expect(cron.schedule).toHaveBeenCalledWith('0 */4 * * *', expect.any(Function), expect.objectContaining({ scheduled: false }));
  });

  test('does not schedule an invalid cron expression', () => {
    cron.validate.mockReturnValue(false);
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: 'not-a-cron' });
    scheduler.scheduleTask();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('stops the previous task on reschedule', () => {
    const stop = jest.fn();
    cron.schedule.mockReturnValue({ stop, start: jest.fn() });
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    configModule.getConfig.mockReturnValue({ watchStatusSyncFrequency: '0 12 * * *' });
    scheduler.scheduleTask();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('subscribe registers a config-change listener', () => {
    scheduler.subscribe();
    expect(configModule.onConfigChange).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('run now, through the manager', () => {
    beforeEach(() => {
      configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
      scheduler.scheduleTask();
    });

    test('a manual run calls syncAll with the manual trigger', async () => {
      const outcome = await scheduledTaskManager.runNow('watchStatusSyncFrequency', { trigger: 'manual' });
      await outcome.completion;
      expect(watchStatusSync.syncAll).toHaveBeenCalledWith('manual');
    });

    test('getStatus reports the task as running while watchStatusSync reports running', () => {
      watchStatusSync.getStatus.mockReturnValue({ running: true });
      const status = scheduledTaskManager.getStatus().find((task) => task.id === 'watchStatusSyncFrequency');
      expect(status.running).toBe(true);
    });

    test('getRunBlocker resolves a no-media-server blocker when nothing is connected', async () => {
      serverRegistry.getEnabledAdapters.mockReturnValue([]);
      const blocker = await scheduledTaskManager.getRunBlocker('watchStatusSyncFrequency');
      expect(blocker).toEqual(expect.objectContaining({
        reason: 'no-media-server', message: 'No media server is connected for watch status.',
      }));
    });

    test('getRunBlocker resolves null when a media server is connected', async () => {
      serverRegistry.getEnabledAdapters.mockReturnValue([{}]);
      const blocker = await scheduledTaskManager.getRunBlocker('watchStatusSyncFrequency');
      expect(blocker).toBeNull();
    });

    test('a manual run has already called syncAll before the history insert resolves', async () => {
      let resolveStart;
      scheduledTaskManager.setRunRecorder({
        start: jest.fn(() => new Promise((resolve) => { resolveStart = resolve; })),
        finish: jest.fn().mockResolvedValue(undefined),
        recordSkipped: jest.fn().mockResolvedValue(undefined),
      });

      const outcome = await scheduledTaskManager.runNow('watchStatusSyncFrequency', { trigger: 'manual' });
      expect(watchStatusSync.syncAll).toHaveBeenCalledWith('manual');

      resolveStart({ id: 1 });
      await outcome.completion;
      scheduledTaskManager.setRunRecorder(null);
    });
  });

  describe('run now while the sync is turned off', () => {
    beforeEach(() => {
      configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: false, watchStatusSyncFrequency: '0 */4 * * *' });
      scheduler.scheduleTask();
    });

    test('getRunBlocker resolves disabled', async () => {
      const blocker = await scheduledTaskManager.getRunBlocker('watchStatusSyncFrequency');
      expect(blocker).toEqual(expect.objectContaining({ reason: 'disabled' }));
    });

    test('a manual run still starts with enforceEnabled false', async () => {
      const outcome = await scheduledTaskManager.runNow('watchStatusSyncFrequency', {
        trigger: 'manual', enforceEnabled: false, enforceCooldown: false,
      });
      expect(outcome.started).toBe(true);
      await outcome.completion;
      expect(watchStatusSync.syncAll).toHaveBeenCalledWith('manual');
    });
  });
});
