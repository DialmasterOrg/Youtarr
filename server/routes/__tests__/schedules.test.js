/* eslint-env jest */
jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const express = require('express');
const supertest = require('supertest');
const createSchedulesRoutes = require('../schedules');
const scheduleConfig = require('../../modules/scheduleConfig');

function makeApp({ statuses = [], latestRuns = {}, finishedRuns = {}, blockers = {} } = {}) {
  const statusByKey = new Map(statuses.map((status) => [status.id, status]));
  const scheduledTaskManager = {
    getTaskSnapshot: jest.fn(async (key) => ({
      status: statusByKey.get(key) ?? null,
      blocker: blockers[key] ?? (statusByKey.has(key) ? null : { reason: 'not-registered', message: 'x', availableAt: null }),
    })),
    runNow: jest.fn(),
  };
  const scheduledTaskRuns = {
    getLatestRuns: jest.fn().mockResolvedValue(latestRuns),
    getLatestFinishedRuns: jest.fn().mockResolvedValue(finishedRuns),
  };
  const app = express();
  app.use(createSchedulesRoutes({
    verifyToken: (req, res, next) => next(),
    scheduledTaskManager,
    scheduledTaskRuns,
    scheduleConfig,
  }));
  return { app, scheduledTaskManager, scheduledTaskRuns };
}

describe('GET /api/schedules', () => {
  test('reports every configured schedule with its live state and last run', async () => {
    const lastRun = {
      id: 1, taskKey: 'autoRemovalFrequency', trigger: 'scheduled', status: 'success',
      outcome: 'completed', message: 'Deleted 2 videos', details: null,
      startedAt: '2026-09-20T02:00:00.000Z', finishedAt: '2026-09-20T02:01:00.000Z',
    };
    const { app } = makeApp({
      statuses: [{
        id: 'autoRemovalFrequency', enabled: true, active: true, expression: '0 2 * * *',
        error: null, running: false, nextRunAt: new Date('2026-09-21T02:00:00.000Z'),
      }],
      latestRuns: { autoRemovalFrequency: lastRun },
      finishedRuns: { autoRemovalFrequency: lastRun },
    });

    const res = await supertest(app).get('/api/schedules');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(Object.keys(scheduleConfig.SCHEDULES).length);
    expect(res.body.tasks.find((task) => task.key === 'autoRemovalFrequency')).toEqual({
      key: 'autoRemovalFrequency',
      label: 'Automatic video cleanup',
      enabled: true,
      active: true,
      expression: '0 2 * * *',
      error: null,
      running: false,
      nextRunAt: '2026-09-21T02:00:00.000Z',
      lastRun,
      lastFinishedRun: lastRun,
      runNow: { available: true, reason: null, message: null, availableAt: null },
    });
  });

  test('reports the newest finished run separately when the latest run was skipped', async () => {
    const skipped = {
      id: 2, taskKey: 'videoRescanFrequency', trigger: 'scheduled', status: 'skipped', outcome: null,
      message: 'The previous run was still in progress.', details: null,
      startedAt: '2026-09-20T03:00:00.000Z', finishedAt: '2026-09-20T03:00:00.000Z',
    };
    const finished = {
      ...skipped, id: 1, status: 'success', outcome: 'completed', message: 'Scanned 10 videos.',
      startedAt: '2026-09-20T02:00:00.000Z', finishedAt: '2026-09-20T02:05:00.000Z',
    };
    const { app } = makeApp({
      latestRuns: { videoRescanFrequency: skipped },
      finishedRuns: { videoRescanFrequency: finished },
    });

    const res = await supertest(app).get('/api/schedules');

    const rescan = res.body.tasks.find((task) => task.key === 'videoRescanFrequency');
    expect(rescan.lastRun).toEqual(skipped);
    expect(rescan.lastFinishedRun).toEqual(finished);
  });

  test('reports no finished run for a task that has never finished one', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/api/schedules');
    expect(res.body.tasks.every((task) => task.lastFinishedRun === null)).toBe(true);
  });

  test('reports tasks the scheduler has not registered as inactive', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/api/schedules');
    expect(res.body.tasks.find((task) => task.key === 'sessionCleanupFrequency')).toEqual(
      expect.objectContaining({
        label: 'Session cleanup', enabled: false, active: false, expression: null,
        error: null, running: false, nextRunAt: null, lastRun: null,
      })
    );
  });

  test('returns 500 when the status cannot be read', async () => {
    const { app, scheduledTaskRuns } = makeApp();
    scheduledTaskRuns.getLatestRuns.mockRejectedValue(new Error('db down'));
    const res = await supertest(app).get('/api/schedules');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to read schedule status' });
  });
});

describe('GET /api/schedules runNow', () => {
  test('reports why a task cannot run now', async () => {
    const { app } = makeApp({
      statuses: [{ id: 'channelDownloadFrequency', enabled: true, active: true, expression: '0 * * * *', error: null, running: false, nextRunAt: null }],
      blockers: {
        channelDownloadFrequency: { reason: 'cooldown', message: 'This task ran recently.', availableAt: new Date('2026-09-27T12:15:00.000Z') },
      },
    });

    const res = await supertest(app).get('/api/schedules');

    expect(res.body.tasks.find((task) => task.key === 'channelDownloadFrequency').runNow).toEqual({
      available: false, reason: 'cooldown', message: 'This task ran recently.', availableAt: '2026-09-27T12:15:00.000Z',
    });
  });

  test('reads snapshots after history, so running and availability come from the same read', async () => {
    const { app, scheduledTaskManager, scheduledTaskRuns } = makeApp({
      statuses: [{ id: 'sessionCleanupFrequency', enabled: true, active: true, expression: '0 3 * * *', error: null, running: true, nextRunAt: null }],
      blockers: { sessionCleanupFrequency: { reason: 'running', message: 'This task is already running.', availableAt: null } },
    });
    const order = [];
    scheduledTaskRuns.getLatestRuns.mockImplementation(async () => { order.push('history'); return {}; });
    const snapshot = scheduledTaskManager.getTaskSnapshot.getMockImplementation();
    scheduledTaskManager.getTaskSnapshot.mockImplementation(async (key) => { order.push('snapshot'); return snapshot(key); });

    const res = await supertest(app).get('/api/schedules');
    const task = res.body.tasks.find((entry) => entry.key === 'sessionCleanupFrequency');

    expect(order[0]).toBe('history');
    expect(order.slice(1).every((step) => step === 'snapshot')).toBe(true);
    expect(task.running).toBe(true);
    expect(task.runNow.reason).toBe('running');
  });

  test('includes the server clock', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-27T12:00:00.000Z'));
    const { app } = makeApp();
    const res = await supertest(app).get('/api/schedules');
    jest.useRealTimers();
    expect(res.body.serverTime).toBe('2026-09-27T12:00:00.000Z');
  });
});

describe('POST /api/schedules/:key/run', () => {
  test('starts the task with the manual trigger', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockResolvedValue({ started: true, completion: Promise.resolve({ status: 'success' }) });

    const res = await supertest(app).post('/api/schedules/sessionCleanupFrequency/run');

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ started: true });
    expect(scheduledTaskManager.runNow).toHaveBeenCalledWith('sessionCleanupFrequency', { trigger: 'manual' });
  });

  test('rejects an unknown task key', async () => {
    const { app, scheduledTaskManager } = makeApp();
    const res = await supertest(app).post('/api/schedules/notATask/run');
    expect(res.status).toBe(404);
    expect(scheduledTaskManager.runNow).not.toHaveBeenCalled();
  });

  test('rejects inherited object keys', async () => {
    const { app } = makeApp();
    const res = await supertest(app).post('/api/schedules/constructor/run');
    expect(res.status).toBe(404);
  });

  test('answers 409 with the reason when the task cannot run', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockResolvedValue({ started: false, reason: 'disabled', message: 'This task is turned off.', availableAt: null });

    const res = await supertest(app).post('/api/schedules/channelDownloadFrequency/run');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This task is turned off.', reason: 'disabled', availableAt: null });
  });

  test('answers 500 when starting throws', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockRejectedValue(new Error('boom'));
    const res = await supertest(app).post('/api/schedules/sessionCleanupFrequency/run');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to start the task' });
  });
});
