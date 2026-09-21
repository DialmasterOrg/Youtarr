/* eslint-env jest */
jest.mock('node-cron', () => ({
  validate: jest.requireActual('node-cron').validate,
  schedule: jest.fn(),
  getTasks: jest.fn(),
}));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe('scheduledTaskManager', () => {
  let manager;
  let cron;
  let registry;
  let run;
  const id = 'autoRemovalFrequency';
  const expression = '0 2 * * *';

  beforeEach(() => {
    jest.resetModules();
    cron = require('node-cron');
    registry = new Map();
    cron.getTasks.mockReturnValue(registry);
    cron.schedule.mockImplementation((pattern, callback, options) => {
      const task = { start: jest.fn(), stop: jest.fn(), callback };
      registry.set(options.name, task);
      return task;
    });
    manager = require('../scheduledTaskManager');
    run = jest.fn().mockResolvedValue(undefined);
  });

  test('starts a timer without executing work and ignores unchanged settings', () => {
    manager.updateTask({ id, expression, run });
    manager.updateTask({ id, expression, run });
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule.mock.results[0].value.start).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  test('invalid edits retain the old timer, and disabling still stops it', () => {
    manager.updateTask({ id, expression, run });
    const original = cron.schedule.mock.results[0].value;
    manager.updateTask({ id, expression: 'invalid', run });
    expect(original.stop).not.toHaveBeenCalled();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    manager.updateTask({ id, expression: 'invalid', enabled: false, run });
    expect(original.stop).toHaveBeenCalledTimes(1);
    manager.updateTask({ id, expression: '0 18 * * *', run });
    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });

  test('invalid startup schedules do not register timers', () => {
    manager.updateTask({ id, expression: null, run });
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('replaces timers without accumulating named tasks', () => {
    manager.updateTask({ id, expression, run });
    const original = cron.schedule.mock.results[0].value;
    manager.updateTask({ id, expression: '0 18 * * *', run });
    expect(original.stop).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(1);
    expect(cron.schedule.mock.results[1].value.start).toHaveBeenCalledTimes(1);
  });

  test('a running task remains protected across rescheduling', async () => {
    let finish;
    run.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    manager.updateTask({ id, expression, run });
    const pending = cron.schedule.mock.results[0].value.callback();
    manager.updateTask({ id, expression: '*/15 * * * *', run });
    const replacement = cron.schedule.mock.results[1].value;
    await replacement.callback();
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    run.mockResolvedValue(undefined);
    await replacement.callback();
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('a rejected callback does not block future runs', async () => {
    run.mockRejectedValueOnce(new Error('disk unavailable'));
    manager.updateTask({ id, expression, run });
    const task = cron.schedule.mock.results[0].value;
    await task.callback();
    await task.callback();
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('failed activation restores the previous working timer', () => {
    manager.updateTask({ id, expression, run });
    const original = cron.schedule.mock.results[0].value;
    const replacement = { start: jest.fn(() => { throw new Error('activation failed'); }), stop: jest.fn() };
    cron.schedule.mockReturnValueOnce(replacement);
    manager.updateTask({ id, expression: '0 18 * * *', run });
    expect(replacement.stop).toHaveBeenCalled();
    expect(original.start).toHaveBeenCalledTimes(2);
    expect(registry.get(`youtarr:${id}`)).toBe(original);
    manager.updateTask({ id, expression, run });
    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });

  test('an edit below the minimum interval retains the old timer', () => {
    manager.updateTask({ id, expression, run });
    manager.updateTask({ id, expression: '*/5 * * * *', run });
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule.mock.results[0].value.stop).not.toHaveBeenCalled();
  });

  test('stopAll prevents future invocations without cancelling active work', async () => {
    manager.updateTask({ id, expression, run });
    const task = cron.schedule.mock.results[0].value;
    manager.stopAll();
    await task.callback();
    expect(task.stop).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  describe('run recording', () => {
    let recorder;
    const handle = { id: 7 };

    beforeEach(() => {
      recorder = {
        start: jest.fn().mockResolvedValue(handle),
        finish: jest.fn().mockResolvedValue(undefined),
        recordSkipped: jest.fn().mockResolvedValue(undefined),
      };
      manager.setRunRecorder(recorder);
    });

    test('records a successful run with the summary the task returns', async () => {
      run.mockResolvedValue({ outcome: 'completed', message: 'Deleted 2 videos', details: { deleted: 2 } });
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(recorder.start).toHaveBeenCalledWith({ taskKey: id, trigger: 'scheduled' });
      expect(recorder.finish).toHaveBeenCalledWith(handle, {
        status: 'success', outcome: 'completed', message: 'Deleted 2 videos', details: { deleted: 2 },
      });
    });

    test('records a thrown error as a failed run', async () => {
      run.mockRejectedValue(new Error('disk unavailable'));
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(recorder.finish).toHaveBeenCalledWith(handle, {
        status: 'error', outcome: null, message: 'disk unavailable', details: null,
      });
    });

    test('records a failure the task reports without throwing', async () => {
      run.mockResolvedValue({ status: 'error', outcome: 'error', message: 'Update failed' });
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(recorder.finish).toHaveBeenCalledWith(handle, expect.objectContaining({
        status: 'error', outcome: 'error', message: 'Update failed',
      }));
    });

    test('records a skip the task reports instead of calling it a success', async () => {
      run.mockResolvedValue({ status: 'skipped', message: 'Skipped: a sync was already running.' });
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(recorder.finish).toHaveBeenCalledWith(handle, {
        status: 'skipped', outcome: null, message: 'Skipped: a sync was already running.', details: null,
      });
    });

    test('treats a task that resolves with nothing as a success', async () => {
      run.mockResolvedValue(undefined);
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(recorder.finish).toHaveBeenCalledWith(handle, expect.objectContaining({ status: 'success' }));
    });

    test('records a skipped occurrence while the previous run is still active', async () => {
      let finish;
      run.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      manager.updateTask({ id, expression, run });
      const task = cron.schedule.mock.results[0].value;
      const pending = task.callback();
      await task.callback();
      expect(recorder.recordSkipped).toHaveBeenCalledWith(id);
      expect(recorder.start).toHaveBeenCalledTimes(1);
      finish();
      await pending;
    });

    test('still runs the task when recording fails', async () => {
      recorder.start.mockRejectedValue(new Error('db down'));
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    test('reports an armed task with its next run', () => {
      manager.updateTask({ id, expression, run });
      const [status] = manager.getStatus();
      expect(status).toEqual(expect.objectContaining({
        id, enabled: true, active: true, expression, error: null, running: false,
      }));
      expect(status.nextRunAt).toBeInstanceOf(Date);
    });

    test('reports a disabled task as inactive without an error', () => {
      manager.updateTask({ id, expression: 'invalid', enabled: false, run });
      expect(manager.getStatus()[0]).toEqual(expect.objectContaining({
        enabled: false, active: false, expression: null, error: null, nextRunAt: null,
      }));
    });

    test('reports a rejected edit while keeping the previous timer active', () => {
      manager.updateTask({ id, expression, run });
      manager.updateTask({ id, expression: '*/5 * * * *', run });
      expect(manager.getStatus()[0]).toEqual(expect.objectContaining({
        active: true, expression, error: expect.stringMatching(/15 minutes/),
      }));
    });

    test('reports an unscheduled task when the startup expression is invalid', () => {
      manager.updateTask({ id, expression: 'invalid', run });
      expect(manager.getStatus()[0]).toEqual(expect.objectContaining({
        enabled: true, active: false, expression: null, error: expect.stringMatching(/valid cron/), nextRunAt: null,
      }));
    });

    test('reports a task while it is running', async () => {
      let finish;
      run.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      manager.updateTask({ id, expression, run });
      const pending = cron.schedule.mock.results[0].value.callback();
      expect(manager.getStatus()[0].running).toBe(true);
      await new Promise((resolve) => setImmediate(resolve));
      finish();
      await pending;
      expect(manager.getStatus()[0].running).toBe(false);
    });
  });
});
