/* eslint-env jest */
jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../modules/databaseHealthModule', () => ({ isDatabaseHealthy: jest.fn(() => true), getHealthStatus: jest.fn(() => ({})) }));
jest.mock('../../modules/ytdlpModule', () => ({
  normalizeChannel: jest.fn(() => 'stable'),
  getLatestVersion: jest.fn().mockResolvedValue('2026.09.19'),
  isUpdateAvailable: jest.fn(() => false),
  performUpdate: jest.fn(),
}));

const express = require('express');
const supertest = require('supertest');

// health.js builds its router at module load, so each app needs a fresh module.
function makeApp({ config = {}, isElfhosted = false } = {}) {
  jest.resetModules();
  const ytdlpModule = require('../../modules/ytdlpModule');
  const ytdlpUpdateRunSummary = require('../../modules/ytdlpUpdateRunSummary');
  const createHealthRoutes = require('../health');
  const scheduledTaskRuns = {
    getLatestRun: jest.fn().mockResolvedValue(null),
    record: jest.fn().mockResolvedValue(undefined),
  };
  const scheduledTaskManager = {
    runNow: jest.fn(),
  };
  const configModule = { getConfig: jest.fn(() => config), isElfhostedPlatform: jest.fn(() => isElfhosted) };
  const app = express();
  app.use(createHealthRoutes({
    getCachedYtDlpVersion: () => '2026.09.19',
    verifyToken: (req, res, next) => next(),
    configModule,
    scheduledTaskRuns,
    ytdlpUpdateRunSummary,
    scheduledTaskManager,
  }));
  return { app, ytdlpModule, scheduledTaskRuns, scheduledTaskManager };
}

describe('GET /api/ytdlp/latest-version update history', () => {
  test('includes the last check and install from recorded runs', async () => {
    const { app, scheduledTaskRuns } = makeApp();
    scheduledTaskRuns.getLatestRun.mockImplementation(async (taskKey, options = {}) => (
      options.outcome === 'updated'
        ? { startedAt: '2026-09-18T04:00:00.000Z', status: 'success', outcome: 'updated', message: 'Updated to 2026.09.18', details: { version: '2026.09.18' } }
        : { startedAt: '2026-09-20T04:00:00.000Z', status: 'success', outcome: 'up-to-date', message: 'Already up to date.', details: null }
    ));

    const res = await supertest(app).get('/api/ytdlp/latest-version');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      currentVersion: '2026.09.19',
      lastChecked: '2026-09-20T04:00:00.000Z',
      lastUpdated: '2026-09-18T04:00:00.000Z',
      lastResult: { status: 'up-to-date', message: 'Already up to date.' },
    }));
  });

  test('counts a deferred check as the last check so the status line can say it was skipped', async () => {
    const { app, scheduledTaskRuns } = makeApp();
    scheduledTaskRuns.getLatestRun.mockImplementation(async (taskKey, options = {}) => (
      Array.isArray(options.statuses) && options.statuses.includes('skipped')
        ? { startedAt: '2026-09-20T04:00:00.000Z', status: 'skipped', outcome: 'skipped', message: 'An update is already in progress', details: null }
        : null
    ));

    const res = await supertest(app).get('/api/ytdlp/latest-version');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      lastChecked: '2026-09-20T04:00:00.000Z',
      lastResult: { status: 'skipped', message: 'An update is already in progress' },
    }));
  });

  test('falls back to legacy config fields when nothing has been recorded', async () => {
    const { app } = makeApp({ config: { ytdlpLastChecked: '2026-04-25T04:00:00.000Z', ytdlpLastResult: { status: 'up-to-date' } } });
    const res = await supertest(app).get('/api/ytdlp/latest-version');
    expect(res.body).toEqual(expect.objectContaining({
      lastChecked: '2026-04-25T04:00:00.000Z',
      lastUpdated: null,
      lastResult: { status: 'up-to-date' },
    }));
  });
});

describe('POST /api/ytdlp/update', () => {
  test('starts the run and returns its result when the update succeeds', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockResolvedValue({
      started: true,
      completion: Promise.resolve({
        status: 'success',
        outcome: 'updated',
        message: 'Updated to 2026.09.20',
        details: { version: '2026.09.20' },
      }),
    });

    const res = await supertest(app).post('/api/ytdlp/update');

    expect(scheduledTaskManager.runNow).toHaveBeenCalledWith('ytdlpUpdateFrequency', {
      trigger: 'manual',
      enforceEnabled: false,
      enforceCooldown: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Updated to 2026.09.20', newVersion: '2026.09.20' });
  });

  test('starts the run and returns its message when the update fails', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockResolvedValue({
      started: true,
      completion: Promise.resolve({
        status: 'error',
        outcome: 'error',
        message: 'yt-dlp exited with code 1',
        details: null,
      }),
    });

    const res = await supertest(app).post('/api/ytdlp/update');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, message: 'yt-dlp exited with code 1' });
  });

  test('returns 409 when an update is already running', async () => {
    const { app, scheduledTaskManager } = makeApp();
    scheduledTaskManager.runNow.mockResolvedValue({
      started: false,
      reason: 'running',
      message: 'This task is already running.',
    });

    const res = await supertest(app).post('/api/ytdlp/update');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'An update is already in progress' });
  });

  test('returns 403 on Elfhosted without starting a run', async () => {
    const { app, scheduledTaskManager } = makeApp({ isElfhosted: true });

    const res = await supertest(app).post('/api/ytdlp/update');

    expect(res.status).toBe(403);
    expect(scheduledTaskManager.runNow).not.toHaveBeenCalled();
  });
});
