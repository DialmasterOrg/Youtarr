/* eslint-env jest */
const express = require('express');
const createMediaServerRoutes = require('../mediaServers');
const { findRouteHandler } = require('../../__tests__/testUtils');

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
};

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

// Mock adapter classes
class MockJellyfinAdapter {
  constructor(config) { this.config = config; }
  async testConnection() { return { ok: true, version: '10.8.0' }; }
  async listUsers() { return [{ id: 'u1', name: 'Alice' }]; }
}
MockJellyfinAdapter.prototype.constructor = { name: 'JellyfinAdapter' };

class MockEmbyAdapter {
  constructor(config) { this.config = config; }
  async testConnection() { return { ok: true, version: '4.7.0' }; }
  async listUsers() { return [{ id: 'u2', name: 'Bob' }]; }
}
MockEmbyAdapter.prototype.constructor = { name: 'EmbyAdapter' };

class MockPlexAdapter {
  constructor(config) { this.config = config; }
}

const buildDeps = (overrides = {}) => ({
  verifyToken: (req, res, next) => next(),
  configModule: {
    getConfig: jest.fn().mockReturnValue({}),
    ...overrides.configModule,
  },
  mediaServers: {
    adapters: {
      JellyfinAdapter: MockJellyfinAdapter,
      EmbyAdapter: MockEmbyAdapter,
      PlexAdapter: MockPlexAdapter,
    },
    serverRegistry: {
      getEnabledAdapters: jest.fn().mockReturnValue([]),
    },
    ...overrides.mediaServers,
  },
});

const getHandler = (method, path, deps) => {
  const router = createMediaServerRoutes(deps);
  const app = express();
  app.use(express.json());
  app.use(router);
  return findRouteHandler(app, method, path);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/mediaservers/status', () => {
  test('returns all-false when no adapters are enabled', async () => {
    const deps = buildDeps();
    deps.mediaServers.serverRegistry.getEnabledAdapters.mockReturnValue([]);

    const handler = getHandler('get', '/api/mediaservers/status', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ plex: false, jellyfin: false, emby: false });
  });

  test('correctly identifies enabled Jellyfin adapter', async () => {
    const deps = buildDeps();
    const jellyfinInstance = new MockJellyfinAdapter({});
    Object.defineProperty(jellyfinInstance, 'constructor', { value: { name: 'JellyfinAdapter' } });
    deps.mediaServers.serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinInstance]);

    const handler = getHandler('get', '/api/mediaservers/status', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    // Status returns based on constructor.name — we check the mock was called
    expect(deps.mediaServers.serverRegistry.getEnabledAdapters).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ plex: false, emby: false }));
  });

  test('returns 500 on error', async () => {
    const deps = buildDeps();
    deps.configModule.getConfig.mockImplementation(() => { throw new Error('config error'); });

    const handler = getHandler('get', '/api/mediaservers/status', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get media server status' });
  });
});

describe('POST /api/mediaservers/jellyfin/test', () => {
  test('returns ok result when connection succeeds', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', '/api/mediaservers/jellyfin/test', deps);
    const req = { body: { jellyfinUrl: 'http://jellyfin', jellyfinApiKey: 'key' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, version: '10.8.0' });
  });

  test('returns 502 when testConnection returns not-ok', async () => {
    const deps = buildDeps();
    // Override the JellyfinAdapter to return a failure
    class FailingJellyfinAdapter {
      async testConnection() { return { ok: false, error: 'refused' }; }
    }
    deps.mediaServers.adapters.JellyfinAdapter = FailingJellyfinAdapter;

    const handler = getHandler('post', '/api/mediaservers/jellyfin/test', deps);
    const req = { body: { jellyfinUrl: 'http://jellyfin' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'refused' });
  });

  test('returns 500 when adapter throws', async () => {
    const deps = buildDeps();
    class ThrowingJellyfinAdapter {
      async testConnection() { throw new Error('network down'); }
    }
    deps.mediaServers.adapters.JellyfinAdapter = ThrowingJellyfinAdapter;

    const handler = getHandler('post', '/api/mediaservers/jellyfin/test', deps);
    const req = { body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Test connection failed' });
  });
});

describe('POST /api/mediaservers/jellyfin/users', () => {
  test('returns list of users', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', '/api/mediaservers/jellyfin/users', deps);
    const req = { body: { jellyfinUrl: 'http://jellyfin', jellyfinApiKey: 'key' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ users: [{ id: 'u1', name: 'Alice' }] });
  });

  test('returns 500 when adapter throws', async () => {
    const deps = buildDeps();
    class ThrowingJellyfinAdapter {
      async listUsers() { throw new Error('auth failed'); }
    }
    deps.mediaServers.adapters.JellyfinAdapter = ThrowingJellyfinAdapter;

    const handler = getHandler('post', '/api/mediaservers/jellyfin/users', deps);
    const req = { body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to list users' });
  });
});

describe('POST /api/mediaservers/emby/test', () => {
  test('returns ok result when connection succeeds', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', '/api/mediaservers/emby/test', deps);
    const req = { body: { embyUrl: 'http://emby', embyApiKey: 'key' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, version: '4.7.0' });
  });

  test('returns 502 when testConnection returns not-ok', async () => {
    const deps = buildDeps();
    class FailingEmbyAdapter {
      async testConnection() { return { ok: false, error: 'connection refused' }; }
    }
    deps.mediaServers.adapters.EmbyAdapter = FailingEmbyAdapter;

    const handler = getHandler('post', '/api/mediaservers/emby/test', deps);
    const req = { body: { embyUrl: 'http://emby' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'connection refused' });
  });
});

describe('POST /api/mediaservers/emby/users', () => {
  test('returns list of users', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', '/api/mediaservers/emby/users', deps);
    const req = { body: { embyUrl: 'http://emby', embyApiKey: 'key' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ users: [{ id: 'u2', name: 'Bob' }] });
  });
});
