/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');

const createConfigRoutes = require('../config');

function makeApp() {
  const app = express();
  app.use(express.json());
  // Attach a minimal logger BEFORE routes so req.log is available in handlers
  app.use((req, _res, next) => {
    req.log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    next();
  });
  const verifyToken = (req, _res, next) => next();
  const configModule = {
    _config: {
      passwordHash: 'hash',
      username: 'user',
      ytdlpLastChecked: null,
      ytdlpLastUpdated: null,
      ytdlpLastResult: null,
      rescanLastRun: null,
    },
    getConfig: jest.fn(function () { return this._config; }),
    updateConfig: jest.fn(function (next) { this._config = next; }),
    getCookiesStatus: jest.fn(),
    isElfhostedPlatform: jest.fn(() => false),
    writeCustomCookiesFile: jest.fn(),
    deleteCustomCookiesFile: jest.fn(),
    getStorageStatus: jest.fn(),
    getImagePath: jest.fn(),
  };
  const validateEnvAuthCredentials = () => false;
  app.use(createConfigRoutes({
    verifyToken,
    configModule,
    validateEnvAuthCredentials,
    isWslEnvironment: false,
  }));
  return { app, configModule };
}

describe('POST /updateconfig', () => {
  test('returns 200 when ytdlpCustomArgs is empty', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '' });
    expect(res.status).toBe(200);
  });

  test('returns 200 when ytdlpCustomArgs contains only allowed flags', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--no-mtime --concurrent-fragments 4' });
    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalled();
  });

  test('preserves managed rescanLastRun when saving settings', async () => {
    const { app, configModule } = makeApp();
    const rescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 4,
      videosMarkedMissing: 1,
      videosScanned: 20,
      filesFoundOnDisk: 19,
      errorMessage: null
    };
    configModule._config.rescanLastRun = rescanLastRun;

    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '', rescanLastRun: null });

    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ rescanLastRun })
    );
  });

  test('returns 400 with the offending flag when ytdlpCustomArgs contains a denylisted flag', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--exec "rm -rf /"' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('--exec');
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('returns 400 on unterminated-quote parse error', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--user-agent \'unterminated' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parse error/i);
  });

  test('returns 400 when ytdlpCustomArgs exceeds 2000 characters', async () => {
    const { app } = makeApp();
    const longArgs = '--no-mtime '.repeat(200); // ~2200 chars
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: longArgs });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  describe('ytdlpDownloadRateLimit validation', () => {
    test.each(['', '5M', '500K', '1.5M', '2G', '1500'])(
      'returns 200 for valid rate limit %s',
      async (value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app)
          .post('/updateconfig')
          .send({ ytdlpDownloadRateLimit: value });
        expect(res.status).toBe(200);
        expect(configModule.updateConfig).toHaveBeenCalled();
      }
    );

    test.each(['5MB', '5 M', 'fast', '5.M', '5M/s'])(
      'returns 400 for invalid rate limit %s',
      async (value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app)
          .post('/updateconfig')
          .send({ ytdlpDownloadRateLimit: value });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/rate limit/i);
        expect(configModule.updateConfig).not.toHaveBeenCalled();
      }
    );
  });
});
