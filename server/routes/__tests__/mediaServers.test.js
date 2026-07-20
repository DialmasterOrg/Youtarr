/* eslint-env jest */
const express = require('express');
const createMediaServerRoutes = require('../mediaServers');
const { findRouteHandler } = require('../../__tests__/testUtils');
const BaseAdapter = require('../../modules/mediaServers/adapters/baseAdapter');

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
  constructor(config) { this.config = config; this.serverType = 'jellyfin'; }
  async testConnection() { return { ok: true, version: '10.8.0' }; }
  async listUsers() { return [{ id: 'u1', name: 'Alice' }]; }
}

class MockEmbyAdapter {
  constructor(config) { this.config = config; this.serverType = 'emby'; }
  async testConnection() { return { ok: true, version: '4.7.0' }; }
  async listUsers() { return [{ id: 'u2', name: 'Bob' }]; }
}

class MockPlexAdapter {
  constructor(config) { this.config = config; this.serverType = 'plex'; }
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
      BaseAdapter,
    },
    serverRegistry: {
      getEnabledAdapters: jest.fn().mockReturnValue([]),
    },
    watchStatusSync: {
      getStatus: jest.fn().mockReturnValue({ running: false, lastRun: null }),
      syncAll: jest.fn().mockResolvedValue({}),
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

  test('reports each enabled adapter by its serverType', async () => {
    const deps = buildDeps();
    deps.mediaServers.serverRegistry.getEnabledAdapters.mockReturnValue([
      new MockJellyfinAdapter({}),
      new MockPlexAdapter({}),
    ]);

    const handler = getHandler('get', '/api/mediaservers/status', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ plex: true, jellyfin: true, emby: false });
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

  test('maps an upstream 401 to a clear API-key error', async () => {
    const deps = buildDeps();
    deps.mediaServers.adapters.JellyfinAdapter = class {
      async listUsers() {
        throw Object.assign(new Error('Request failed with status code 401'), {
          isAxiosError: true,
          response: { status: 401 },
        });
      }
    };
    const handler = getHandler('post', '/api/mediaservers/jellyfin/users', deps);
    const res = createResponse();
    await handler({ body: {}, log: loggerMock }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringMatching(/rejected the API key/i),
    });
  });

  test('maps an unreachable server to a 502 with the connection message', async () => {
    const deps = buildDeps();
    deps.mediaServers.adapters.JellyfinAdapter = class {
      async listUsers() {
        throw Object.assign(new Error('connect ECONNREFUSED'), {
          isAxiosError: true,
          code: 'ECONNREFUSED',
        });
      }
    };
    const handler = getHandler('post', '/api/mediaservers/jellyfin/users', deps);
    const res = createResponse();
    await handler({ body: {}, log: loggerMock }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('connect ECONNREFUSED'),
    });
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

  test('maps an upstream 401 to a clear API-key error', async () => {
    const deps = buildDeps();
    deps.mediaServers.adapters.EmbyAdapter = class {
      async listUsers() {
        throw Object.assign(new Error('Request failed with status code 401'), {
          isAxiosError: true,
          response: { status: 401 },
        });
      }
    };
    const handler = getHandler('post', '/api/mediaservers/emby/users', deps);
    const res = createResponse();
    await handler({ body: {}, log: loggerMock }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringMatching(/rejected the API key/i),
    });
  });

  test('maps an unreachable server to a 502 with the connection message', async () => {
    const deps = buildDeps();
    deps.mediaServers.adapters.EmbyAdapter = class {
      async listUsers() {
        throw Object.assign(new Error('connect ECONNREFUSED'), {
          isAxiosError: true,
          code: 'ECONNREFUSED',
        });
      }
    };
    const handler = getHandler('post', '/api/mediaservers/emby/users', deps);
    const res = createResponse();
    await handler({ body: {}, log: loggerMock }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('connect ECONNREFUSED'),
    });
  });

  test('logs a token-free error description, never the raw axios error', async () => {
    const deps = buildDeps();
    deps.mediaServers.adapters.EmbyAdapter = class {
      async listUsers() {
        throw Object.assign(new Error('connect ECONNREFUSED'), {
          isAxiosError: true,
          code: 'ECONNREFUSED',
          config: { headers: { 'X-Emby-Token': 'SECRET' } },
        });
      }
    };
    const handler = getHandler('post', '/api/mediaservers/emby/users', deps);
    const res = createResponse();
    await handler({ body: {}, log: loggerMock }, res);

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.not.objectContaining({ err: expect.anything() }),
      'list users failed'
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: null, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
      'list users failed'
    );
  });
});

describe('GET /api/mediaservers/watch-status', () => {
  test('returns sync status', async () => {
    const deps = buildDeps();
    deps.mediaServers.watchStatusSync.getStatus.mockReturnValue({ running: false, lastRun: { trigger: 'manual' } });

    const handler = getHandler('get', '/api/mediaservers/watch-status', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ running: false, lastRun: { trigger: 'manual' } });
  });
});

describe('POST /api/mediaservers/watch-status/sync', () => {
  test('starts a sync', async () => {
    const deps = buildDeps();
    deps.mediaServers.watchStatusSync.getStatus.mockReturnValue({ running: false, lastRun: null });

    const handler = getHandler('post', '/api/mediaservers/watch-status/sync', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ started: true });
    expect(deps.mediaServers.watchStatusSync.syncAll).toHaveBeenCalledWith('manual');
  });

  test('returns 409 when already running', async () => {
    const deps = buildDeps();
    deps.mediaServers.watchStatusSync.getStatus.mockReturnValue({ running: true, lastRun: null });

    const handler = getHandler('post', '/api/mediaservers/watch-status/sync', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Watch status sync is already running' });
    expect(deps.mediaServers.watchStatusSync.syncAll).not.toHaveBeenCalled();
  });

  test('does not crash the request when syncAll rejects', async () => {
    const deps = buildDeps();
    deps.mediaServers.watchStatusSync.getStatus.mockReturnValue({ running: false, lastRun: null });
    deps.mediaServers.watchStatusSync.syncAll.mockRejectedValue(new Error('adapter exploded'));

    const handler = getHandler('post', '/api/mediaservers/watch-status/sync', deps);
    const req = { log: loggerMock };
    const res = createResponse();

    await handler(req, res);
    // Flush the fire-and-forget promise's microtask queue so its .catch runs
    // before the test asserts on it.
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ started: true });
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Manual watch status sync failed'
    );
  });
});
