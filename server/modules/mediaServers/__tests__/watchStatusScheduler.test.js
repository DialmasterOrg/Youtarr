jest.mock('node-cron', () => ({ schedule: jest.fn(), validate: jest.fn(() => true) }));
jest.mock('../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(), onConfigChange: jest.fn() }));
jest.mock('../watchStatusSync', () => ({ syncAll: jest.fn().mockResolvedValue({}) }));

describe('watchStatusScheduler', () => {
  let scheduler;
  let cron;
  let configModule;
  let watchStatusSync;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    cron = require('node-cron');
    cron.validate.mockReturnValue(true);
    configModule = require('../../configModule');
    watchStatusSync = require('../watchStatusSync');

    scheduler = require('../watchStatusScheduler');
  });

  test('schedules the sync when enabled', () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    expect(cron.schedule).toHaveBeenCalledWith('0 */4 * * *', expect.any(Function));
  });

  test('the scheduled callback runs syncAll with the scheduled trigger', () => {
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    const callback = cron.schedule.mock.calls[0][1];
    callback();
    expect(watchStatusSync.syncAll).toHaveBeenCalledWith('scheduled');
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
    expect(cron.schedule).toHaveBeenCalledWith('0 */4 * * *', expect.any(Function));
  });

  test('does not schedule an invalid cron expression', () => {
    cron.validate.mockReturnValue(false);
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: 'not-a-cron' });
    scheduler.scheduleTask();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('stops the previous task on reschedule', () => {
    const stop = jest.fn();
    cron.schedule.mockReturnValue({ stop });
    configModule.getConfig.mockReturnValue({ watchStatusSyncEnabled: true, watchStatusSyncFrequency: '0 */4 * * *' });
    scheduler.scheduleTask();
    scheduler.scheduleTask();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('subscribe registers a config-change listener', () => {
    scheduler.subscribe();
    expect(configModule.onConfigChange).toHaveBeenCalledWith(expect.any(Function));
  });
});
