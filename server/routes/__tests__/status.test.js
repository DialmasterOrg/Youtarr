/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const createStatusRoutes = require('../status');

const SUMMARY = {
  version: '1.93.0',
  ytDlp: { version: '2026.11.16' },
  library: { channels: 1, videos: 2, storageBytes: 3 },
  downloads: { paused: false, activeJob: null, queuedJobs: 0, videosDownloading: 0, videosQueued: 0 },
  lastRun: null,
  recentDownloads: [],
};

function makeApp({ authType = 'session', apiKeyId, getSummary = jest.fn().mockResolvedValue(SUMMARY) } = {}) {
  const log = { error: jest.fn() };
  const app = express();
  app.use((req, _res, next) => {
    req.log = log;
    next();
  });
  app.use(createStatusRoutes({
    verifyToken: (req, _res, next) => {
      req.authType = authType;
      req.apiKeyId = apiKeyId;
      next();
    },
    statusSummaryModule: { getSummary },
    getCachedYtDlpVersion: () => '2026.11.16',
    serverVersion: '1.93.0',
  }));
  return { app, getSummary, log };
}

describe('GET /api/status/summary', () => {
  test('returns the summary built from the running versions', async () => {
    const { app, getSummary } = makeApp();

    const res = await supertest(app).get('/api/status/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(SUMMARY);
    expect(getSummary).toHaveBeenCalledWith({ version: '1.93.0', ytDlpVersion: '2026.11.16' });
  });

  test('answers 500 with an error body when the summary cannot be built', async () => {
    const failure = new Error('database unavailable');
    const { app, log } = makeApp({ getSummary: jest.fn().mockRejectedValue(failure) });

    const res = await supertest(app).get('/api/status/summary');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to build status summary' });
    expect(log.error).toHaveBeenCalledWith({ err: failure }, 'Failed to build status summary');
  });

  test('rate-limits status API keys per key', async () => {
    const { app } = makeApp({ authType: 'api_key', apiKeyId: 7 });

    const res = await supertest(app).get('/api/status/summary');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('60');
  });

  test('does not rate-limit a browser session', async () => {
    const { app } = makeApp({ authType: 'session' });

    const res = await supertest(app).get('/api/status/summary');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});
