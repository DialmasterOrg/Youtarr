const express = require('express');
const supertest = require('supertest');

jest.mock('../../modules/youtubeApi', () => ({
  client: { testKey: jest.fn() },
  YoutubeApiErrorCode: {
    KEY_INVALID: 'KEY_INVALID',
    KEY_RESTRICTED: 'KEY_RESTRICTED',
    API_NOT_ENABLED: 'API_NOT_ENABLED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN: 'UNKNOWN',
  },
}));

const youtubeApi = require('../../modules/youtubeApi');
const createYoutubeApiKeyRoutes = require('../youtubeApiKey');

let configModule;

function makeApp() {
  const app = express();
  app.use(express.json());
  const verifyToken = (req, _res, next) => next();
  configModule = {
    _config: { youtubeApiKey: '' },
    getConfig: jest.fn(function () { return this._config; }),
    updateConfig: jest.fn(function (next) { this._config = next; }),
  };
  app.use(createYoutubeApiKeyRoutes({ verifyToken, youtubeApi, configModule }));
  return app;
}

describe('POST /testYoutubeApiKey', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when key is missing or empty', async () => {
    const app = makeApp();

    const res1 = await supertest(app).post('/testYoutubeApiKey').send({});
    expect(res1.status).toBe(400);
    expect(res1.body.error).toMatch(/apiKey.*required/i);

    const res2 = await supertest(app).post('/testYoutubeApiKey').send({ apiKey: '' });
    expect(res2.status).toBe(400);
  });

  test('returns 200 { ok: true } on success', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: true });

    const res = await supertest(makeApp()).post('/testYoutubeApiKey').send({ apiKey: 'good' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(youtubeApi.client.testKey).toHaveBeenCalledWith('good');
  });

  test('auto-saves the key to config on successful validation', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: true });
    const app = makeApp();

    await supertest(app).post('/testYoutubeApiKey').send({ apiKey: 'valid-key-abc' });

    expect(configModule.updateConfig).toHaveBeenCalledTimes(1);
    expect(configModule._config.youtubeApiKey).toBe('valid-key-abc');
  });

  test('does NOT save the key when validation fails', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: false, code: 'KEY_INVALID' });
    const app = makeApp();

    await supertest(app).post('/testYoutubeApiKey').send({ apiKey: 'bad-key' });

    expect(configModule.updateConfig).not.toHaveBeenCalled();
    expect(configModule._config.youtubeApiKey).toBe('');
  });

  test('returns 200 { ok: false, code, reason } with a human message on failure', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: false, code: 'KEY_INVALID' });

    const res = await supertest(makeApp()).post('/testYoutubeApiKey').send({ apiKey: 'bad' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: false, code: 'KEY_INVALID' });
    expect(res.body.reason).toMatch(/invalid/i);
  });

  test('maps QUOTA_EXCEEDED code to a quota-specific reason', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: false, code: 'QUOTA_EXCEEDED' });

    const res = await supertest(makeApp()).post('/testYoutubeApiKey').send({ apiKey: 'ok-but-burnt' });

    expect(res.body.reason).toMatch(/quota/i);
  });

  test('maps API_NOT_ENABLED to an actionable reason', async () => {
    youtubeApi.client.testKey.mockResolvedValueOnce({ ok: false, code: 'API_NOT_ENABLED' });
    const res = await supertest(makeApp()).post('/testYoutubeApiKey').send({ apiKey: 'x' });
    expect(res.body.reason).toMatch(/not enabled|enable/i);
  });

  test('returns 500 { error } when the client throws unexpectedly', async () => {
    youtubeApi.client.testKey.mockRejectedValueOnce(new Error('boom'));
    const res = await supertest(makeApp()).post('/testYoutubeApiKey').send({ apiKey: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });
});
