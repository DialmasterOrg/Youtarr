/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const createArrBridgeSettingsRoutes = require('../arrBridgeSettings');

const KEY = 'k'.repeat(64);
const SONARR_KEY = '5p1ke0000000000000000000000000ab';
const STATUS = {
  enabled: true,
  stagingRoot: '/data/.arr-staging',
  stagingClientPath: '/data/.arr-staging',
  connections: {
    sonarr: { url: 'http://sonarr:8989', keySet: true },
    radarr: { url: null, keySet: false },
  },
};
const SAVED = { ok: true, appName: 'Sonarr', version: '4.0.20.3014', connection: { url: 'http://sonarr:8989', keySet: true } };
const GRAB = { id: 'g1', releaseTitle: 'Beyblade.S01E29.1080p.WEB-DL-X', state: 'ready' };

const GRAB_PAGE = { grabs: [GRAB], total: 21, page: 2, pageSize: 20 };

const SEARCH = { id: 1, shape: 'episode', outcome: 'nothing', asked: { text: 'Beyblade' }, stages: [] };
const SEARCH_PAGE = { searches: [SEARCH], total: 21, page: 3, pageSize: 10 };

function makeApp({ settings = {}, verifyToken, limiter, listRecentGrabs, listRecentSearches } = {}) {
  const arrBridge = {
    settings: {
      isApp: (app) => app === 'sonarr' || app === 'radarr',
      getStatus: jest.fn(() => STATUS),
      getOrCreateKey: jest.fn(() => KEY),
      regenerateKey: jest.fn(() => 'n'.repeat(64)),
      saveConnection: jest.fn().mockResolvedValue(SAVED),
      testStoredConnection: jest.fn().mockResolvedValue({ ok: true, appName: 'Sonarr', version: '4.0.20.3014' }),
      removeConnection: jest.fn(() => ({ url: null, keySet: false })),
      checkSharedFolder: jest.fn().mockResolvedValue({ ok: true, visible: true, path: '/data/.arr-staging' }),
      ...settings,
    },
    listRecentGrabs: listRecentGrabs || jest.fn().mockResolvedValue(GRAB_PAGE),
    listRecentSearches: listRecentSearches || jest.fn().mockResolvedValue(SEARCH_PAGE),
  };
  const log = { error: jest.fn(), info: jest.fn() };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = log;
    next();
  });
  app.use(createArrBridgeSettingsRoutes({
    verifyToken: verifyToken || ((_req, _res, next) => next()),
    arrBridgeConnectionLimiter: limiter || ((_req, _res, next) => next()),
    arrBridge,
  }));
  return { app, arrBridge, log };
}

const refuseSession = (_req, res) => res.status(403).json({ error: 'No token provided' });
const logged = (log) => JSON.stringify([log.error.mock.calls, log.info.mock.calls]);

describe('the Sonarr/Radarr bridge settings routes', () => {
  test.each([
    ['get', '/api/arr-bridge/status'],
    ['get', '/api/arr-bridge/key'],
    ['post', '/api/arr-bridge/key/regenerate'],
    ['put', '/api/arr-bridge/connections/sonarr'],
    ['post', '/api/arr-bridge/connections/sonarr/test'],
    ['delete', '/api/arr-bridge/connections/sonarr'],
    ['get', '/api/arr-bridge/connections/sonarr/shared-folder'],
    ['get', '/api/arr-bridge/grabs'],
    ['get', '/api/arr-bridge/searches'],
  ])('%s %s needs a session', async (method, path) => {
    const { app, arrBridge } = makeApp({ verifyToken: refuseSession });

    const res = await supertest(app)[method](path).send({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });

    expect(res.status).toBe(403);
    for (const call of Object.values(arrBridge.settings)) {
      if (jest.isMockFunction(call)) expect(call).not.toHaveBeenCalled();
    }
    expect(arrBridge.listRecentGrabs).not.toHaveBeenCalled();
    expect(arrBridge.listRecentSearches).not.toHaveBeenCalled();
  });

  test('reads the status', async () => {
    const { app } = makeApp();

    const res = await supertest(app).get('/api/arr-bridge/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(STATUS);
  });

  test('reads the key, creating it on first request', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).get('/api/arr-bridge/key');

    expect(res.body).toEqual({ key: KEY });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(arrBridge.settings.getOrCreateKey).toHaveBeenCalledTimes(1);
  });

  test('replaces the key', async () => {
    const { app } = makeApp();

    const res = await supertest(app).post('/api/arr-bridge/key/regenerate');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ key: 'n'.repeat(64) });
  });

  describe('PUT /api/arr-bridge/connections/:app', () => {
    test('passes only the address and the key on, and answers with the saved connection', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).put('/api/arr-bridge/connections/sonarr')
        .send({ url: 'http://sonarr:8989', apiKey: SONARR_KEY, useStoredKey: true, app: 'radarr' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(SAVED);
      expect(arrBridge.settings.saveConnection).toHaveBeenCalledWith('sonarr', {
        url: 'http://sonarr:8989', apiKey: SONARR_KEY,
      });
    });

    test('answers 400 for input the module refuses', async () => {
      const { app } = makeApp({ settings: { saveConnection: jest.fn().mockResolvedValue({ error: 'Enter the API key' }) } });

      const res = await supertest(app).put('/api/arr-bridge/connections/sonarr').send({ url: 'http://sonarr:8989' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Enter the API key' });
    });

    test('answers 200 with the reason when the app does not answer', async () => {
      const refused = { ok: false, reason: 'unauthorized', message: 'Sonarr rejected the API key.' };
      const { app } = makeApp({ settings: { saveConnection: jest.fn().mockResolvedValue(refused) } });

      const res = await supertest(app).put('/api/arr-bridge/connections/sonarr')
        .send({ url: 'http://sonarr:8989', apiKey: 'wrong' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(refused);
    });

    test('a failure answers 500 and logs nothing of the request', async () => {
      const { app, log } = makeApp({ settings: { saveConnection: jest.fn().mockRejectedValue(new Error('disk full')) } });

      const res = await supertest(app).put('/api/arr-bridge/connections/sonarr')
        .send({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not save the connection' });
      expect(logged(log)).not.toContain(SONARR_KEY);
    });

    test('runs behind the connection limiter', async () => {
      const limiter = jest.fn((_req, res) => res.status(429).json({ error: 'Too many attempts' }));
      const { app, arrBridge } = makeApp({ limiter });

      const res = await supertest(app).put('/api/arr-bridge/connections/sonarr')
        .send({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });

      expect(res.status).toBe(429);
      expect(arrBridge.settings.saveConnection).not.toHaveBeenCalled();
    });
  });

  // A request without a session must not use up the allowance of a
  // signed-in user behind the same address.
  test.each([
    ['put', '/api/arr-bridge/connections/sonarr'],
    ['post', '/api/arr-bridge/connections/sonarr/test'],
    ['get', '/api/arr-bridge/connections/sonarr/shared-folder'],
  ])('%s %s checks the session before it counts against the limiter', async (method, path) => {
    const limiter = jest.fn((_req, _res, next) => next());
    const { app } = makeApp({ verifyToken: refuseSession, limiter });

    const res = await supertest(app)[method](path).send({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });

    expect(res.status).toBe(403);
    expect(limiter).not.toHaveBeenCalled();
  });

  describe('POST /api/arr-bridge/connections/:app/test', () => {
    // The stored key may only go to the stored address.
    test('tests the stored connection and ignores anything in the body', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).post('/api/arr-bridge/connections/sonarr/test')
        .send({ url: 'http://elsewhere.example:8989', apiKey: 'x' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, appName: 'Sonarr', version: '4.0.20.3014' });
      expect(arrBridge.settings.testStoredConnection).toHaveBeenCalledWith('sonarr');
      expect(arrBridge.settings.testStoredConnection.mock.calls[0]).toHaveLength(1);
      expect(arrBridge.settings.saveConnection).not.toHaveBeenCalled();
    });

    test('runs behind the connection limiter', async () => {
      const limiter = jest.fn((_req, res) => res.status(429).json({ error: 'Too many attempts' }));
      const { app, arrBridge } = makeApp({ limiter });

      const res = await supertest(app).post('/api/arr-bridge/connections/radarr/test');

      expect(res.status).toBe(429);
      expect(arrBridge.settings.testStoredConnection).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/arr-bridge/connections/:app/shared-folder', () => {
    test('says whether the app sees the staging folder', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).get('/api/arr-bridge/connections/radarr/shared-folder');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, visible: true, path: '/data/.arr-staging' });
      expect(arrBridge.settings.checkSharedFolder).toHaveBeenCalledWith('radarr');
    });

    test('runs behind the connection limiter', async () => {
      const limiter = jest.fn((_req, res) => res.status(429).json({ error: 'Too many attempts' }));
      const { app, arrBridge } = makeApp({ limiter });

      const res = await supertest(app).get('/api/arr-bridge/connections/sonarr/shared-folder');

      expect(res.status).toBe(429);
      expect(arrBridge.settings.checkSharedFolder).not.toHaveBeenCalled();
    });

    test('an unknown app is not asked', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).get('/api/arr-bridge/connections/prowlarr/shared-folder');

      expect(res.status).toBe(404);
      expect(arrBridge.settings.checkSharedFolder).not.toHaveBeenCalled();
    });

    test('a failure is logged and answered without details', async () => {
      const { app, log } = makeApp({ settings: { checkSharedFolder: jest.fn().mockRejectedValue(new Error('boom')) } });

      const res = await supertest(app).get('/api/arr-bridge/connections/sonarr/shared-folder');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not check the folder' });
      expect(log.error).toHaveBeenCalled();
    });
  });

  test('removes a connection', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).delete('/api/arr-bridge/connections/radarr');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connection: { url: null, keySet: false } });
    expect(arrBridge.settings.removeConnection).toHaveBeenCalledWith('radarr');
  });

  test.each([
    ['put', '/api/arr-bridge/connections/prowlarr'],
    ['post', '/api/arr-bridge/connections/prowlarr/test'],
    ['delete', '/api/arr-bridge/connections/__proto__'],
  ])('%s %s is an unknown app', async (method, path) => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app)[method](path).send({ url: 'http://x:1', apiKey: 'k' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Unknown app' });
    expect(arrBridge.settings.saveConnection).not.toHaveBeenCalled();
    expect(arrBridge.settings.testStoredConnection).not.toHaveBeenCalled();
    expect(arrBridge.settings.removeConnection).not.toHaveBeenCalled();
  });

  describe('GET /api/arr-bridge/grabs', () => {
    test('lists a page of the recent grabs', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).get('/api/arr-bridge/grabs?page=2&pageSize=20&q=beyblade');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(GRAB_PAGE);
      expect(arrBridge.listRecentGrabs).toHaveBeenCalledWith({ page: '2', pageSize: '20', q: 'beyblade' });
    });

    test('a repeated parameter reads as none', async () => {
      const { app, arrBridge } = makeApp();

      await supertest(app).get('/api/arr-bridge/grabs?page=5&page=9&q=a&q=b');

      expect(arrBridge.listRecentGrabs).toHaveBeenCalledWith({ page: undefined, pageSize: undefined, q: undefined });
    });

    test('a failure answers 500', async () => {
      const { app, log } = makeApp({ listRecentGrabs: jest.fn().mockRejectedValue(new Error('db down')) });

      const res = await supertest(app).get('/api/arr-bridge/grabs');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not read the grabs' });
      expect(log.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/arr-bridge/searches', () => {
    test('lists a page of the recent searches', async () => {
      const { app, arrBridge } = makeApp();

      const res = await supertest(app).get('/api/arr-bridge/searches?page=3&q=bluey');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(SEARCH_PAGE);
      expect(arrBridge.listRecentSearches).toHaveBeenCalledWith({ page: '3', pageSize: undefined, q: 'bluey' });
    });

    test('a failure answers 500', async () => {
      const { app, log } = makeApp({ listRecentSearches: jest.fn().mockRejectedValue(new Error('db down')) });

      const res = await supertest(app).get('/api/arr-bridge/searches');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not read the searches' });
      expect(log.error).toHaveBeenCalledTimes(1);
    });
  });

  test('a failure reading the key answers 500', async () => {
    const { app } = makeApp({
      settings: {
        getOrCreateKey: jest.fn(() => {
          throw new Error('read-only config');
        }),
      },
    });

    const res = await supertest(app).get('/api/arr-bridge/key');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Could not read the key' });
  });
});
