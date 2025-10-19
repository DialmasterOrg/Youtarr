/* eslint-env jest */
const loggerMock = require('../__mocks__/logger');

const findRouteHandler = (app, method, routePath) => {
  const stack = app?._router?.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path === routePath && layer.route.methods[method]) {
      const routeStack = layer.route.stack;
      return routeStack[routeStack.length - 1].handle;
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
};

const createMockRequest = (overrides = {}) => ({
  params: {},
  query: {},
  headers: {},
  body: {},
  path: '',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  socket: { remoteAddress: '127.0.0.1' },
  log: loggerMock,
  ...overrides
});

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {}
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.send = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  return res;
};

const setupServer = async ({ authEnabled = 'false', passwordHash = null } = {}) => {
  jest.resetModules();
  jest.clearAllMocks();

  process.env.NODE_ENV = 'test';

  if (authEnabled === undefined) {
    delete process.env.AUTH_ENABLED;
  } else {
    process.env.AUTH_ENABLED = authEnabled;
  }

  const https = require('https');
  jest.spyOn(https, 'get').mockImplementation(() => {});

  const fakeConfig = {
    passwordHash,
    username: passwordHash ? 'tester' : null,
    dockerAutoCreated: false,
    plexUrl: 'http://plex:32400',
    plexPort: '32400'
  };

  const configModuleMock = {
    directoryPath: '/downloads',
    getConfig: jest.fn(() => fakeConfig),
    updateConfig: jest.fn((nextConfig) => Object.assign(fakeConfig, nextConfig)),
    getImagePath: jest.fn(() => '/images'),
    getCookiesStatus: jest.fn(() => ({ cookiesEnabled: false })),
    writeCustomCookiesFile: jest.fn(),
    deleteCustomCookiesFile: jest.fn(),
    getStorageStatus: jest.fn().mockResolvedValue({ total: 1, free: 1 }),
    isElfhostedPlatform: jest.fn(() => false),
    config: fakeConfig,
    stopWatchingConfig: jest.fn()
  };

  const plexModuleMock = {
    getLibrariesWithParams: jest.fn().mockResolvedValue([]),
    getLibraries: jest.fn().mockResolvedValue([]),
    refreshLibrary: jest.fn().mockResolvedValue(),
    getAuthUrl: jest.fn().mockResolvedValue({ url: 'https://plex.example/auth' }),
    checkPin: jest.fn().mockResolvedValue({ authenticated: true })
  };

  jest.doMock('../db', () => ({
    initializeDatabase: jest.fn().mockResolvedValue(),
    Session: {
      findOne: jest.fn().mockResolvedValue(null),
      destroy: jest.fn().mockResolvedValue(0)
    },
    Sequelize: { Op: { gt: Symbol('gt'), lt: Symbol('lt'), or: Symbol('or') } }
  }));

  jest.doMock('../modules/configModule', () => configModuleMock);
  jest.doMock('../modules/plexModule', () => plexModuleMock);
  jest.doMock('../modules/channelModule', () => ({
    subscribe: jest.fn(),
    readChannels: jest.fn().mockResolvedValue([]),
    writeChannels: jest.fn().mockResolvedValue(),
    getChannelInfo: jest.fn().mockResolvedValue({}),
    getChannelVideos: jest.fn().mockResolvedValue([])
  }));
  jest.doMock('../modules/downloadModule', () => ({
    doSpecificDownloads: jest.fn(),
    doChannelDownloads: jest.fn()
  }));
  jest.doMock('../modules/jobModule', () => ({
    getJob: jest.fn(),
    getRunningJobs: jest.fn(() => [])
  }));
  jest.doMock('../modules/videosModule', () => ({
    getVideos: jest.fn().mockResolvedValue([])
  }));
  jest.doMock('../modules/webSocketServer.js', () => jest.fn());

  jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
  jest.doMock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

  const serverModule = require('../server');
  await serverModule.initialize();

  return {
    app: serverModule.app,
    configModuleMock,
    plexModuleMock
  };
};

describe('Plex authentication routes', () => {
  afterEach(() => {
    delete process.env.AUTH_ENABLED;
    jest.restoreAllMocks();
  });

  test('bypasses password requirement when platform manages auth', async () => {
    const { app, plexModuleMock } = await setupServer({ authEnabled: 'false', passwordHash: null });

    const handler = findRouteHandler(app, 'get', '/plex/auth-url');
    const req = createMockRequest({ path: '/plex/auth-url' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ url: 'https://plex.example/auth' });
    expect(plexModuleMock.getAuthUrl).toHaveBeenCalledTimes(1);
  });

  test('blocks Plex auth when local auth not configured', async () => {
    const { app, plexModuleMock } = await setupServer({ authEnabled: 'true', passwordHash: null });

    const handler = findRouteHandler(app, 'get', '/plex/auth-url');
    const req = createMockRequest({ path: '/plex/auth-url' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Authentication not configured',
      requiresSetup: true,
      message: 'Please complete initial setup first'
    });
    expect(plexModuleMock.getAuthUrl).not.toHaveBeenCalled();
  });

  test('allows Plex PIN checks when platform manages auth', async () => {
    const { app, plexModuleMock } = await setupServer({ authEnabled: 'false', passwordHash: null });

    const handler = findRouteHandler(app, 'get', '/plex/check-pin/:pinId');
    const req = createMockRequest({
      path: '/plex/check-pin/sample',
      params: { pinId: 'sample' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ authenticated: true });
    expect(plexModuleMock.checkPin).toHaveBeenCalledWith('sample');
  });

  test('blocks Plex PIN checks when local auth required but missing', async () => {
    const { app, plexModuleMock } = await setupServer({ authEnabled: 'true', passwordHash: null });

    const handler = findRouteHandler(app, 'get', '/plex/check-pin/:pinId');
    const req = createMockRequest({
      path: '/plex/check-pin/sample',
      params: { pinId: 'sample' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Authentication not configured',
      requiresSetup: true,
      message: 'Please complete initial setup first'
    });
    expect(plexModuleMock.checkPin).not.toHaveBeenCalled();
  });

  test('auto-saves Plex API key without overwriting managed URL IP', async () => {
    const { app, configModuleMock, plexModuleMock } = await setupServer({ authEnabled: 'false', passwordHash: 'hash' });
    plexModuleMock.getLibrariesWithParams.mockResolvedValue([{ id: 'lib' }]);

    const handler = findRouteHandler(app, 'get', '/getplexlibraries');
    const req = createMockRequest({
      path: '/getplexlibraries',
      query: { testIP: '', testApiKey: 'fresh-token' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(plexModuleMock.getLibrariesWithParams).toHaveBeenCalledWith('', 'fresh-token', undefined);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 'lib' }]);

    expect(configModuleMock.updateConfig).toHaveBeenCalledTimes(1);
    const updatedConfig = configModuleMock.updateConfig.mock.calls[0][0];
    expect(updatedConfig.plexApiKey).toBe('fresh-token');
    expect(updatedConfig.plexIP).toBeUndefined();
    expect(updatedConfig.plexPort).toBe('32400');
  });

  test('auto-saves Plex IP when provided during test', async () => {
    const { app, configModuleMock, plexModuleMock } = await setupServer({ authEnabled: 'false', passwordHash: 'hash' });
    plexModuleMock.getLibrariesWithParams.mockResolvedValue([{ id: 'lib' }]);

    const handler = findRouteHandler(app, 'get', '/getplexlibraries');
    const req = createMockRequest({
      path: '/getplexlibraries',
      query: { testIP: '192.168.1.10', testApiKey: 'fresh-token', testPort: '23456' }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(plexModuleMock.getLibrariesWithParams).toHaveBeenCalledWith('192.168.1.10', 'fresh-token', '23456');
    expect(configModuleMock.updateConfig).toHaveBeenCalledTimes(1);
    const updatedConfig = configModuleMock.updateConfig.mock.calls[0][0];
    expect(updatedConfig.plexIP).toBe('192.168.1.10');
    expect(updatedConfig.plexApiKey).toBe('fresh-token');
    expect(updatedConfig.plexPort).toBe('23456');
  });
});
