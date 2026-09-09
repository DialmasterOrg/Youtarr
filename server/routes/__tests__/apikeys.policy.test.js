jest.mock('../../modules/apiKeyModule', () => ({
  createApiKey: jest.fn(),
  listApiKeys: jest.fn(),
  logApiKeyCreated: jest.fn(),
  updateApiKey: jest.fn(),
  regenerateApiKey: jest.fn(),
  serializeApiKey: jest.fn((key) => ({ id: key.id, name: key.name, key_prefix: key.key_prefix })),
}));
jest.mock('../../modules/apiKeyChannelGrantModule', () => ({
  getChannelGrants: jest.fn(),
  replaceChannelGrants: jest.fn(),
}));
jest.mock('../../db', () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: 'transaction' })),
  },
}));

const express = require('express');
const request = require('supertest');
const apiKeyModule = require('../../modules/apiKeyModule');
const grantModule = require('../../modules/apiKeyChannelGrantModule');
const createApiKeyRoutes = require('../apikeys');

function createApp(authType = 'session') {
  const app = express();
  app.use(express.json());
  app.use(createApiKeyRoutes({ verifyToken: (req, _res, next) => {
    req.authType = authType;
    next();
  } }));
  return app;
}

describe('PATCH /api/keys/:id policy management', () => {
  beforeEach(() => jest.clearAllMocks());

  test('is session-only', async () => {
    await request(createApp('api_key')).patch('/api/keys/1').send({ policy: { role: 'view' } })
      .expect(403, { error: 'API keys cannot manage other API keys' });
  });

  test('rejects an API-key header even when upstream auth is bypassed', async () => {
    await request(createApp())
      .get('/api/keys')
      .set('x-api-key', 'external-key')
      .expect(403, { error: 'API keys cannot manage other API keys' });
  });

  test('rejects invalid policy validation errors', async () => {
    apiKeyModule.updateApiKey.mockRejectedValue(new Error('Invalid API key role'));
    await request(createApp()).patch('/api/keys/1').send({ policy: { role: 'bogus' } })
      .expect(400, { error: 'Invalid API key role' });
  });

  test('uses the shared serializer so key_hash is absent from PATCH responses', async () => {
    apiKeyModule.updateApiKey.mockResolvedValue({ id: 1, name: 'Safe', key_prefix: '12345678', key_hash: 'never-send' });
    const response = await request(createApp()).patch('/api/keys/1').send({ policy: { role: 'view' } }).expect(200);
    expect(response.body.key).toEqual({ id: 1, name: 'Safe', key_prefix: '12345678' });
    expect(response.body.key).not.toHaveProperty('key_hash');
  });
});

describe('GET /api/keys management list', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns effective channel grant counts without exposing key hashes', async () => {
    apiKeyModule.listApiKeys.mockResolvedValue([{
      id: 1,
      name: 'External',
      key_prefix: '12345678',
      channel_grant_count: 0,
    }]);

    const response = await request(createApp()).get('/api/keys').expect(200);
    expect(response.body).toEqual({
      keys: [{
        id: 1,
        name: 'External',
        key_prefix: '12345678',
        channel_grant_count: 0,
      }],
    });
    expect(apiKeyModule.listApiKeys).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/keys/:id/regenerate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('is session-only', async () => {
    await request(createApp('api_key')).post('/api/keys/1/regenerate')
      .expect(403, { error: 'API keys cannot manage other API keys' });
  });

  test('replaces an active key and returns the one-time secret', async () => {
    apiKeyModule.regenerateApiKey.mockResolvedValue({
      id: 1,
      name: 'External',
      key: 'replacement-secret',
      prefix: 'replacem',
    });
    const response = await request(createApp()).post('/api/keys/1/regenerate').expect(200);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      id: 1,
      key: 'replacement-secret',
      prefix: 'replacem',
    }));
    expect(apiKeyModule.regenerateApiKey).toHaveBeenCalledWith(1);
  });

  test('rejects invalid IDs, non-empty bodies, and inactive keys', async () => {
    await request(createApp()).post('/api/keys/nope/regenerate').expect(400);
    await request(createApp()).post('/api/keys/1/regenerate').send({ surprise: true }).expect(400);
    apiKeyModule.regenerateApiKey.mockResolvedValue(null);
    await request(createApp()).post('/api/keys/1/regenerate')
      .expect(404, { error: 'Active API key not found' });
  });
});

describe('API key channel grant management', () => {
  beforeEach(() => jest.clearAllMocks());

  test('is session-only', async () => {
    await request(createApp('api_key')).get('/api/keys/1/channels').expect(403);
    await request(createApp('api_key')).put('/api/keys/1/channels').send({ channelIds: [] }).expect(403);
  });

  test('returns and replaces only sanitized channel database IDs', async () => {
    grantModule.getChannelGrants.mockResolvedValue({ keyId: 1, channelIds: [2, 4] });
    grantModule.replaceChannelGrants.mockResolvedValue({ keyId: 1, channelIds: [3, 5] });

    await request(createApp()).get('/api/keys/1/channels')
      .expect(200, { keyId: 1, channelIds: [2, 4] });
    await request(createApp()).put('/api/keys/1/channels').send({ channelIds: [5, 3] })
      .expect(200, { success: true, keyId: 1, channelIds: [3, 5] });
  });

  test('rejects invalid grant sets and legacy keys', async () => {
    grantModule.replaceChannelGrants.mockRejectedValue(
      new Error('Only active external API keys can receive channel grants')
    );
    await request(createApp()).put('/api/keys/1/channels').send({ channelIds: [2] })
      .expect(400, { error: 'Only active external API keys can receive channel grants' });
  });
});

describe('transactional external access management', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates an external key and its exact grants in one transaction', async () => {
    apiKeyModule.createApiKey.mockResolvedValue({
      id: 9,
      name: 'External Client',
      key: 'one-time-secret',
      prefix: '12345678',
    });
    grantModule.replaceChannelGrants.mockResolvedValue({
      keyId: 9,
      channelIds: [2, 4],
    });

    const response = await request(createApp()).post('/api/keys').send({
      name: 'External Client',
      policy: { role: 'request' },
      channelIds: [4, 2],
    }).expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      id: 9,
      key: 'one-time-secret',
    }));
    expect(apiKeyModule.createApiKey).toHaveBeenCalledWith(
      'External Client',
      { role: 'request' },
      { transaction: { id: 'transaction' }, logEvent: false }
    );
    expect(grantModule.replaceChannelGrants).toHaveBeenCalledWith(
      9,
      [4, 2],
      { transaction: { id: 'transaction' } }
    );
    expect(apiKeyModule.logApiKeyCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, prefix: '12345678' })
    );
  });

  test('still returns the one-time key if post-commit audit logging fails', async () => {
    apiKeyModule.createApiKey.mockResolvedValue({
      id: 9,
      name: 'External Client',
      key: 'one-time-secret',
      prefix: '12345678',
    });
    grantModule.replaceChannelGrants.mockResolvedValue({
      keyId: 9,
      channelIds: [],
    });
    apiKeyModule.logApiKeyCreated.mockImplementationOnce(() => {
      throw new Error('logger unavailable');
    });

    await request(createApp()).post('/api/keys').send({
      name: 'External Client',
      policy: { role: 'view' },
      channelIds: [],
    }).expect(200).expect((response) => {
      expect(response.body.key).toBe('one-time-secret');
    });
  });

  test('updates policy and grants through the atomic endpoint', async () => {
    apiKeyModule.updateApiKey.mockResolvedValue({
      id: 9,
      name: 'External Client',
      key_prefix: '12345678',
    });
    grantModule.replaceChannelGrants.mockResolvedValue({
      keyId: 9,
      channelIds: [3],
    });

    const response = await request(createApp())
      .put('/api/keys/9/external-access')
      .send({ policy: { role: 'delete' }, channelIds: [3] })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      key: { id: 9, name: 'External Client', key_prefix: '12345678' },
      channelIds: [3],
    });
    expect(apiKeyModule.updateApiKey).toHaveBeenCalledWith(
      9,
      { role: 'delete' },
      { transaction: { id: 'transaction' } }
    );
    expect(grantModule.replaceChannelGrants).toHaveBeenCalledWith(
      9,
      [3],
      { transaction: { id: 'transaction' } }
    );
  });
});
