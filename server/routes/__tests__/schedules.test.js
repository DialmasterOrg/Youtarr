/* eslint-env jest */
jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const express = require('express');
const supertest = require('supertest');
const createSchedulesRoutes = require('../schedules');
const scheduleConfig = require('../../modules/scheduleConfig');

function makeApp({ statuses = [], latestRuns = {} } = {}) {
  const scheduledTaskManager = { getStatus: jest.fn(() => statuses) };
  const scheduledTaskRuns = { getLatestRuns: jest.fn().mockResolvedValue(latestRuns) };
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
    });
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
