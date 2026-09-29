/* eslint-env jest */
jest.mock('node-cron', () => ({
  validate: jest.requireActual('node-cron').validate,
  schedule: jest.fn(),
  getTasks: jest.fn(),
}));
jest.mock('../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

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

    test('starts the work in the same tick as the history insert', async () => {
      let resolveStart;
      recorder.start.mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
      manager.updateTask({ id, expression, run });

      const outcome = await manager.runNow(id);
      // The history insert (recorder.start) has not resolved yet, but the
      // task's own work must already have been started.
      expect(run).toHaveBeenCalledTimes(1);

      resolveStart(handle);
      await outcome.completion;
    });

    test('finishes the history row when work rejects before the insert completes', async () => {
      let resolveStart;
      recorder.start.mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
      run.mockRejectedValue(new Error('exploded'));
      manager.updateTask({ id, expression, run });

      const outcome = await manager.runNow(id);
      resolveStart(handle);
      const record = await outcome.completion;

      expect(record).toMatchObject({ status: 'error', message: 'exploded' });
      expect(recorder.finish).toHaveBeenCalledWith(handle, expect.objectContaining({
        status: 'error', message: 'exploded',
      }));
    });

    describe('work that carries on after the task returns (finalRecord)', () => {
      const flush = () => new Promise((resolve) => setImmediate(resolve));
      let settle;
      let fail;

      beforeEach(() => {
        const finalRecord = new Promise((resolve, reject) => { settle = resolve; fail = reject; });
        run.mockResolvedValue({ status: 'success', message: 'Queued the sweep.', finalRecord });
      });

      test('leaves the history row open until the work ends, then records its result', async () => {
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        expect(recorder.finish).not.toHaveBeenCalled();

        settle({ status: 'error', outcome: 'partial', message: 'Downloaded 3 videos; 2 failed.', details: { failed: 2 } });
        await flush();

        expect(recorder.finish).toHaveBeenCalledTimes(1);
        expect(recorder.finish).toHaveBeenCalledWith(handle, {
          status: 'error', outcome: 'partial', message: 'Downloaded 3 videos; 2 failed.', details: { failed: 2 },
        });
      });

      test('does not count as running while the history row is open', async () => {
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        expect(manager.getStatus()[0].running).toBe(false);
        await expect(manager.getTaskSnapshot(id)).resolves.toMatchObject({ status: { running: false }, blocker: null });
      });

      test('never refuses a manual run while the history row is open', async () => {
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        const outcome = await manager.runNow(id);
        expect(outcome.started).toBe(true);
        await outcome.completion;
        expect(run).toHaveBeenCalledTimes(2);
      });

      test('runs the next scheduled occurrence instead of skipping it', async () => {
        manager.updateTask({ id, expression, run });
        const task = cron.schedule.mock.results[0].value;
        await task.callback();
        await task.callback();
        expect(run).toHaveBeenCalledTimes(2);
        expect(recorder.recordSkipped).not.toHaveBeenCalled();
      });

      test('closes the history row as failed when the work rejects', async () => {
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        fail(new Error('tracker exploded'));
        await flush();
        expect(recorder.finish).toHaveBeenCalledWith(handle, {
          status: 'error', outcome: null, message: 'tracker exploded', details: null,
        });
      });

      test('records when the work really ended, if the final record says', async () => {
        const finishedAt = new Date('2026-09-28T16:21:17.000Z');
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        settle({ status: 'success', message: 'No new videos.', finishedAt });
        await flush();
        expect(recorder.finish).toHaveBeenCalledWith(handle, expect.objectContaining({ finishedAt }));
      });

      test('ignores an end time that is not a valid date', async () => {
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        settle({ status: 'success', message: 'No new videos.', finishedAt: new Date('nonsense') });
        await flush();
        expect(recorder.finish.mock.calls[0][1]).not.toHaveProperty('finishedAt');
      });

      test('tells open pages when the history row closes', async () => {
        const messageEmitter = require('../messageEmitter');
        manager.updateTask({ id, expression, run });
        await cron.schedule.mock.results[0].value.callback();
        messageEmitter.emitMessage.mockClear();
        settle({ status: 'success', message: 'No new videos.' });
        await flush();
        expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'schedules', 'scheduledTaskStatus', { key: id });
      });
    });

    test('finishes the history row when run throws synchronously', async () => {
      const syncRun = () => { throw new Error('bad input'); };
      manager.updateTask({ id, expression, run: syncRun });

      const outcome = await manager.runNow(id);
      const record = await outcome.completion;

      expect(record).toMatchObject({ status: 'error', message: 'bad input' });
      expect(recorder.finish).toHaveBeenCalledWith(handle, expect.objectContaining({
        status: 'error', message: 'bad input',
      }));
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

  function makeRecorder() {
    return {
      start: jest.fn().mockResolvedValue({ id: 7, task_key: id }),
      finish: jest.fn().mockResolvedValue(undefined),
      recordSkipped: jest.fn().mockResolvedValue(undefined),
    };
  }

  describe('runNow', () => {
    test('runs a registered task with the manual trigger and records it', async () => {
      const recorder = makeRecorder();
      manager.setRunRecorder(recorder);
      run.mockResolvedValue({ status: 'success', outcome: 'completed', message: 'ok' });
      manager.updateTask({ id, expression, run });

      const outcome = await manager.runNow(id, { args: { jobData: { a: 1 } } });
      const record = await outcome.completion;

      expect(outcome.started).toBe(true);
      expect(run).toHaveBeenCalledWith({ trigger: 'manual', jobData: { a: 1 } });
      expect(recorder.start).toHaveBeenCalledWith({ taskKey: id, trigger: 'manual' });
      expect(record).toEqual({ status: 'success', outcome: 'completed', message: 'ok', details: null });
    });

    test('scheduled occurrences pass the scheduled trigger', async () => {
      manager.updateTask({ id, expression, run });
      await cron.schedule.mock.results[0].value.callback();
      expect(run).toHaveBeenCalledWith({ trigger: 'scheduled' });
    });

    test('reports not-registered for an unknown task', async () => {
      const outcome = await manager.runNow('nope');
      expect(outcome).toMatchObject({ started: false, reason: 'not-registered' });
    });

    test('a turned-off task is blocked unless enforceEnabled is false', async () => {
      manager.updateTask({ id, expression, enabled: false, run });

      expect(await manager.runNow(id)).toMatchObject({ started: false, reason: 'disabled' });
      const outcome = await manager.runNow(id, { enforceEnabled: false });
      await outcome.completion;
      expect(run).toHaveBeenCalledTimes(1);
    });

    test('a task registered with manualRunRequiresEnabled: false runs while turned off', async () => {
      manager.updateTask({ id, expression, enabled: false, run, manualRunRequiresEnabled: false });

      expect(await manager.getRunBlocker(id)).toBeNull();
      const outcome = await manager.runNow(id);
      expect(outcome.started).toBe(true);
      await outcome.completion;
      expect(run).toHaveBeenCalledTimes(1);
      // Turning the schedule off still stops the timer.
      expect(manager.getStatus()[0].active).toBe(false);
    });

    test('a task with an invalid schedule can still run now', async () => {
      manager.updateTask({ id, expression: 'invalid', run });
      const outcome = await manager.runNow(id);
      await outcome.completion;
      expect(run).toHaveBeenCalledTimes(1);
    });

    test('isRunning probe blocks runNow and is reported by getStatus', async () => {
      manager.updateTask({ id, expression, run, isRunning: () => true });
      expect(await manager.runNow(id)).toMatchObject({ started: false, reason: 'running' });
      expect(manager.getStatus()[0].running).toBe(true);
      expect(run).not.toHaveBeenCalled();
    });

    test('a throwing isRunning probe counts as not running', async () => {
      manager.updateTask({ id, expression, run, isRunning: () => { throw new Error('boom'); } });
      expect(manager.getStatus()[0].running).toBe(false);
    });

    test('concurrent runNow calls start one run', async () => {
      let finish;
      run.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      manager.updateTask({ id, expression, run, getRunBlocker: async () => null });

      const [first, second] = await Promise.all([manager.runNow(id), manager.runNow(id)]);

      expect([first.started, second.started].sort()).toEqual([false, true]);
      expect([first, second].find((o) => !o.started).reason).toBe('running');
      expect(run).toHaveBeenCalledTimes(1);
      finish();
    });

    test('returns the task blocker and falls back to allowed when it throws', async () => {
      const availableAt = new Date('2026-09-27T12:00:00Z');
      manager.updateTask({
        id, expression, run,
        getRunBlocker: jest.fn()
          .mockResolvedValueOnce({ reason: 'downloads-paused', message: 'Downloads are paused: full', availableAt })
          .mockRejectedValueOnce(new Error('check failed')),
      });

      expect(await manager.runNow(id)).toEqual({
        started: false, reason: 'downloads-paused', message: 'Downloads are paused: full', availableAt,
      });
      const outcome = await manager.runNow(id);
      expect(outcome.started).toBe(true);
      await outcome.completion;
    });

    test('passes fresh: true to the task blocker when starting a run', async () => {
      const getRunBlocker = jest.fn().mockResolvedValue(null);
      manager.updateTask({ id, expression, run, getRunBlocker });
      await (await manager.runNow(id)).completion;
      expect(getRunBlocker).toHaveBeenCalledWith({ fresh: true });
    });

    test('cooldown blocks a new manual run until it passes', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      manager.updateTask({ id, expression, run, manualCooldownMs: 60_000 });
      await (await manager.runNow(id)).completion;

      const blocked = await manager.runNow(id);
      expect(blocked).toMatchObject({ started: false, reason: 'cooldown' });
      expect(blocked.availableAt.getTime()).toBe(1_060_000);
      const bypass = await manager.runNow(id, { enforceCooldown: false });
      expect(bypass.started).toBe(true);
      await bypass.completion;

      // The bypass run restarted the clock at the same mocked time.
      now.mockReturnValue(1_060_001);
      expect((await manager.runNow(id)).started).toBe(true);
      now.mockRestore();
    });

    test('a skipped run does not start the manual-run cooldown', async () => {
      run.mockResolvedValue({ status: 'skipped', message: 'Refreshes are paused.' });
      manager.updateTask({ id, expression, run, manualCooldownMs: 60_000 });

      await (await manager.runNow(id)).completion;

      run.mockResolvedValue({ status: 'success', outcome: 'completed', message: 'ok' });
      const outcome = await manager.runNow(id);
      expect(outcome.started).toBe(true);
      await outcome.completion;
    });

    test('completion resolves with an error record when the run throws', async () => {
      run.mockRejectedValue(new Error('exploded'));
      manager.updateTask({ id, expression, run });
      const record = await (await manager.runNow(id)).completion;
      expect(record).toMatchObject({ status: 'error', message: 'exploded' });
    });
  });

  describe('status broadcast', () => {
    test('broadcasts when a run starts and when it finishes', async () => {
      const messageEmitter = require('../messageEmitter');
      manager.updateTask({ id, expression, run });
      await (await manager.runNow(id)).completion;
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(2);
      expect(messageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast', null, 'schedules', 'scheduledTaskStatus', { key: id }
      );
    });

    test('a failed broadcast does not affect the run', async () => {
      const messageEmitter = require('../messageEmitter');
      messageEmitter.emitMessage.mockImplementation(() => { throw new Error('no wss'); });
      manager.updateTask({ id, expression, run });
      const record = await (await manager.runNow(id)).completion;
      expect(run).toHaveBeenCalledTimes(1);
      expect(record.status).toBe('success');
      // The running flag is released, so the task can run again.
      expect(manager.getStatus()[0].running).toBe(false);
      expect((await manager.runNow(id)).started).toBe(true);
    });
  });

  describe('announceRun', () => {
    test('broadcasts when outside work starts and when it settles, passing its result through', async () => {
      const messageEmitter = require('../messageEmitter');
      let finish;
      const work = new Promise((resolve) => { finish = resolve; });

      const announced = manager.announceRun('channelVideoCountsFrequency', work);
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(1);
      finish('done');

      await expect(announced).resolves.toBe('done');
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(2);
      expect(messageEmitter.emitMessage).toHaveBeenLastCalledWith(
        'broadcast', null, 'schedules', 'scheduledTaskStatus', { key: 'channelVideoCountsFrequency' }
      );
    });

    test('still broadcasts the finish when the work rejects', async () => {
      const messageEmitter = require('../messageEmitter');
      await expect(manager.announceRun(id, Promise.reject(new Error('boom')))).rejects.toThrow('boom');
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTaskSnapshot', () => {
    test('reports an unregistered task with no status', async () => {
      expect(await manager.getTaskSnapshot('nope')).toMatchObject({
        status: null, blocker: { reason: 'not-registered' },
      });
    });

    test('a task that starts while its blocker is read is running in both halves', async () => {
      let started = false;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      manager.updateTask({
        id, expression, run,
        isRunning: () => started,
        getRunBlocker: async () => { await gate; return null; },
      });

      const pending = manager.getTaskSnapshot(id);
      started = true;
      release();
      const snapshot = await pending;

      expect(snapshot.status.running).toBe(true);
      expect(snapshot.blocker).toMatchObject({ reason: 'running' });
    });

    test('a task that finishes while its blocker is read is read again', async () => {
      const isRunning = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
      manager.updateTask({ id, expression, run, isRunning });

      const snapshot = await manager.getTaskSnapshot(id);

      expect(snapshot.status.running).toBe(false);
      expect(snapshot.blocker).toBeNull();
    });
  });
});
