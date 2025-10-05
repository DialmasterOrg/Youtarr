/* eslint-env jest */

const findRouteHandlers = (app, method, routePath) => {
  const stack = app?._router?.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path === routePath && layer.route.methods[method]) {
      return layer.route.stack.map((routeLayer) => routeLayer.handle);
    }
  }
  throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
};

const createMockRequest = (overrides = {}) => ({
  method: 'GET',
  params: {},
  query: {},
  body: {},
  headers: {},
  path: overrides.path || '/',
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  socket: { remoteAddress: '127.0.0.1' },
  ...overrides
});

const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    finished: false
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload) => {
    res.body = payload;
    res.finished = true;
    return res;
  });

  res.send = jest.fn((payload) => {
    res.body = payload;
    res.finished = true;
    return res;
  });

  return res;
};

const createServerModule = ({
  authEnabled = 'true',
  passwordHash = 'hashed-password',
  session,
  skipInitialize = false,
  configOverrides = {}
} = {}) => {
  jest.resetModules();
  jest.clearAllMocks();

  const state = {};

  return new Promise((resolve, reject) => {
    jest.isolateModules(() => {
      try {
        process.env.NODE_ENV = 'test';
        if (authEnabled === undefined) {
          delete process.env.AUTH_ENABLED;
        } else {
          process.env.AUTH_ENABLED = authEnabled;
        }

        const defaultSessionUpdate = jest.fn().mockResolvedValue();
        let effectiveSession;

        if (session !== undefined) {
          effectiveSession = session;
          if (effectiveSession && !effectiveSession.update) {
            effectiveSession.update = defaultSessionUpdate;
          }
        } else if (passwordHash) {
          effectiveSession = {
            id: 123,
            username: 'tester',
            update: defaultSessionUpdate
          };
        } else {
          effectiveSession = null;
        }

        const dbMock = {
          initializeDatabase: jest.fn().mockResolvedValue(),
          Session: {
            findOne: jest.fn().mockImplementation(() => Promise.resolve(effectiveSession)),
            create: jest.fn().mockResolvedValue(),
            update: jest.fn().mockResolvedValue([1]),
            destroy: jest.fn().mockResolvedValue(0),
            findAll: jest.fn().mockResolvedValue([])
          },
          Sequelize: {
            Op: {
              gt: Symbol('gt'),
              lt: Symbol('lt'),
              or: Symbol('or')
            }
          }
        };

        const configState = {
          passwordHash: passwordHash || null,
          username: passwordHash ? 'tester' : null,
          dockerAutoCreated: false,
          plexUrl: 'http://plex.local',
          plexPort: '32400',
          plexApiKey: 'token',
          ...configOverrides
        };

        const configModuleMock = {
          directoryPath: '/downloads',
          getConfig: jest.fn(() => configState),
          updateConfig: jest.fn((patch) => Object.assign(configState, patch)),
          getImagePath: jest.fn(() => '/images'),
          getCookiesStatus: jest.fn(() => ({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false
          })),
          writeCustomCookiesFile: jest.fn(),
          deleteCustomCookiesFile: jest.fn(),
          getStorageStatus: jest.fn().mockResolvedValue({ total: 1, free: 1 }),
          config: configState,
          stopWatchingConfig: jest.fn()
        };

        const channelModuleMock = {
          subscribe: jest.fn(),
          readChannels: jest.fn().mockResolvedValue([{ id: 'channel-1' }]),
          writeChannels: jest.fn().mockResolvedValue(),
          getChannelInfo: jest.fn().mockResolvedValue({ id: 'channel-1', title: 'Channel' })
        };

        const plexModuleMock = {
          getLibrariesWithParams: jest.fn().mockResolvedValue([]),
          getLibraries: jest.fn().mockResolvedValue([]),
          refreshLibrary: jest.fn().mockResolvedValue(),
          getAuthUrl: jest.fn().mockResolvedValue({ url: 'https://plex.example/auth' }),
          checkPin: jest.fn().mockResolvedValue({ authenticated: true })
        };

        const downloadModuleMock = {
          doSpecificDownloads: jest.fn(),
          doChannelDownloads: jest.fn()
        };

        const jobModuleMock = {
          getJob: jest.fn(),
          getRunningJobs: jest.fn(() => [])
        };

        const videosModuleMock = {
          getVideos: jest.fn().mockResolvedValue([]),
          getVideosPaginated: jest.fn().mockResolvedValue({
            videos: [],
            total: 0,
            page: 1,
            totalPages: 0
          }),
          backfillVideoMetadata: jest.fn().mockResolvedValue()
        };

        const videoValidationModuleMock = {
          validateVideo: jest.fn().mockResolvedValue({ isValidUrl: true })
        };

        const cronMock = { schedule: jest.fn() };
        const rateLimitMiddleware = jest.fn(() => (req, res, next) => next());
        const multerSingleMock = jest.fn(() => (req, res, next) => next());
        const multerMock = jest.fn(() => ({ single: multerSingleMock }));

        jest.doMock('../db', () => dbMock);
        jest.doMock('../modules/configModule', () => configModuleMock);
        jest.doMock('../modules/channelModule', () => channelModuleMock);
        jest.doMock('../modules/plexModule', () => plexModuleMock);
        jest.doMock('../modules/downloadModule', () => downloadModuleMock);
        jest.doMock('../modules/jobModule', () => jobModuleMock);
        jest.doMock('../modules/videosModule', () => videosModuleMock);
        jest.doMock('../modules/videoValidationModule', () => videoValidationModuleMock);
        jest.doMock('../modules/webSocketServer.js', () => jest.fn());
        jest.doMock('node-cron', () => cronMock);
        jest.doMock('express-rate-limit', () => rateLimitMiddleware);
        jest.doMock('multer', () => multerMock);
        jest.doMock('https', () => ({ get: jest.fn(() => ({ on: jest.fn() })) }));

        const serverModule = require('../server');

        state.app = serverModule.app;
        state.serverModule = serverModule;
        state.dbMock = dbMock;
        state.channelModuleMock = channelModuleMock;
        state.cronMock = cronMock;
        state.configModuleMock = configModuleMock;
        state.plexModuleMock = plexModuleMock;
        state.rateLimitMiddleware = rateLimitMiddleware;
        state.sessionUpdateMock = effectiveSession?.update || defaultSessionUpdate;

        const finalize = () => resolve(state);

        if (skipInitialize) {
          finalize();
        } else {
          serverModule.initialize().then(finalize).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
};

afterEach(() => {
  delete process.env.AUTH_ENABLED;
});

describe('isLocalhostIP', () => {
  test.each([
    ['127.0.0.1', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    ['localhost', true],
    ['192.168.1.10', false],
    [null, false]
  ])('returns %s for %s', async (input, expected) => {
    const { serverModule } = await createServerModule({ skipInitialize: true });
    expect(serverModule.isLocalhostIP(input)).toBe(expected);
  });
});

describe('server initialization', () => {
  test('initializes database and exposes health route', async () => {
    const { app, dbMock, channelModuleMock } = await createServerModule();

    expect(dbMock.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(channelModuleMock.subscribe).toHaveBeenCalledTimes(1);

    const [healthHandler] = findRouteHandlers(app, 'get', '/api/health');
    const req = createMockRequest({ path: '/api/health' });
    const res = createMockResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'healthy' });
  });

  test('blocks protected routes when authentication is not configured', async () => {
    const { app, dbMock, channelModuleMock } = await createServerModule({ passwordHash: null });

    const [verifyToken] = findRouteHandlers(app, 'get', '/getchannels');
    const req = createMockRequest({ path: '/getchannels' });
    const res = createMockResponse();

    await verifyToken(req, res, jest.fn());

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Authentication not configured',
      requiresSetup: true,
      message: 'Please complete initial setup first'
    });
    expect(dbMock.Session.findOne).not.toHaveBeenCalled();
    expect(channelModuleMock.readChannels).not.toHaveBeenCalled();
  });

  test('allows access to protected routes with a valid session token', async () => {
    const { app, dbMock, channelModuleMock, sessionUpdateMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getchannels');
    const verifyToken = handlers[0];
    const getChannelsHandler = handlers[1];

    const req = createMockRequest({
      path: '/getchannels',
      headers: { 'x-access-token': 'valid-token' }
    });
    const res = createMockResponse();

    await new Promise((resolve, reject) => {
      verifyToken(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await getChannelsHandler(req, res);
    expect(channelModuleMock.readChannels).toHaveBeenCalledTimes(1);
    await channelModuleMock.readChannels.mock.results[0].value;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 'channel-1' }]);

    expect(dbMock.Session.findOne).toHaveBeenCalledTimes(1);
    const query = dbMock.Session.findOne.mock.calls[0][0];
    expect(query.where.session_token).toBe('valid-token');
    expect(query.where.is_active).toBe(true);
    const gtSymbol = dbMock.Sequelize.Op.gt;
    expect(query.where.expires_at[gtSymbol]).toBeInstanceOf(Date);

    expect(sessionUpdateMock).toHaveBeenCalledTimes(1);
  });

  test('rejects requests with an invalid or expired token', async () => {
    const { app, dbMock, channelModuleMock } = await createServerModule({ session: null });

    const [verifyToken] = findRouteHandlers(app, 'get', '/getchannels');
    const req = createMockRequest({
      path: '/getchannels',
      headers: { 'x-access-token': 'invalid-token' }
    });
    const res = createMockResponse();

    await verifyToken(req, res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
    expect(dbMock.Session.findOne).toHaveBeenCalledTimes(1);
    expect(channelModuleMock.readChannels).not.toHaveBeenCalled();
  });

  test('schedules nightly session cleanup and video metadata backfill with node-cron', async () => {
    const { cronMock, dbMock } = await createServerModule();

    // Two cron jobs should be scheduled: session cleanup and video metadata backfill
    expect(cronMock.schedule).toHaveBeenCalledTimes(2);

    // Check session cleanup schedule (first call)
    const [sessionExpression, cleanupTask] = cronMock.schedule.mock.calls[0];
    expect(sessionExpression).toBe('0 3 * * *');

    await cleanupTask();

    expect(dbMock.Session.destroy).toHaveBeenCalledTimes(1);
    const destroyArgs = dbMock.Session.destroy.mock.calls[0][0];
    const orSymbol = dbMock.Sequelize.Op.or;
    expect(destroyArgs.where[orSymbol]).toBeDefined();

    // Check video metadata backfill schedule (second call)
    const [videoExpression] = cronMock.schedule.mock.calls[1];
    expect(videoExpression).toBe('30 3 * * *');
  });

  test('configures login rate limiter with custom key generator', async () => {
    const { rateLimitMiddleware } = await createServerModule();

    const loginCall = rateLimitMiddleware.mock.calls.find(([options]) => options.max === 5);
    expect(loginCall).toBeDefined();

    const loginOptions = loginCall[0];
    expect(loginOptions.windowMs).toBe(15 * 60 * 1000);
    expect(loginOptions.skipSuccessfulRequests).toBe(true);

    const key = loginOptions.keyGenerator({ ip: '1.2.3.4', body: { username: 'alice' } });
    expect(key).toBe('1.2.3.4:alice');

    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    loginOptions.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many failed login attempts. Please wait 15 minutes before trying again.'
    });
  });

  test('handles paginated /getVideos endpoint with query parameters', async () => {
    const { app } = await createServerModule();
    const videosModuleMock = require('../modules/videosModule');

    const handlers = findRouteHandlers(app, 'get', '/getVideos');
    const verifyToken = handlers[0];
    const getVideosHandler = handlers[1];

    const req = createMockRequest({
      path: '/getVideos',
      headers: { 'x-access-token': 'valid-token' },
      query: {
        page: '2',
        limit: '20',
        search: 'test video',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        sortBy: 'title',
        sortOrder: 'asc',
        channelFilter: 'channel123'
      }
    });
    const res = createMockResponse();

    await new Promise((resolve, reject) => {
      verifyToken(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await getVideosHandler(req, res);

    expect(videosModuleMock.getVideosPaginated).toHaveBeenCalledTimes(1);
    expect(videosModuleMock.getVideosPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: 'test video',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      sortBy: 'title',
      sortOrder: 'asc',
      channelFilter: 'channel123'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      videos: [],
      total: 0,
      page: 1,
      totalPages: 0
    });
  });

  test('handles /getVideos endpoint with default parameters', async () => {
    const { app } = await createServerModule();
    const videosModuleMock = require('../modules/videosModule');

    // Reset the mock before this test
    videosModuleMock.getVideosPaginated.mockClear();

    const handlers = findRouteHandlers(app, 'get', '/getVideos');
    const verifyToken = handlers[0];
    const getVideosHandler = handlers[1];

    const req = createMockRequest({
      path: '/getVideos',
      headers: { 'x-access-token': 'valid-token' },
      query: {}
    });
    const res = createMockResponse();

    await new Promise((resolve, reject) => {
      verifyToken(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await getVideosHandler(req, res);

    expect(videosModuleMock.getVideosPaginated).toHaveBeenCalledTimes(1);
    expect(videosModuleMock.getVideosPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 12,
      search: '',
      dateFrom: null,
      dateTo: null,
      sortBy: 'added',
      sortOrder: 'desc',
      channelFilter: ''
    });

    expect(res.statusCode).toBe(200);
  });

  test('handles /getVideos endpoint errors gracefully', async () => {
    const { app } = await createServerModule();
    const videosModuleMock = require('../modules/videosModule');

    // Reset and set up mock to reject
    videosModuleMock.getVideosPaginated.mockClear();
    videosModuleMock.getVideosPaginated.mockRejectedValueOnce(new Error('Database error'));

    const handlers = findRouteHandlers(app, 'get', '/getVideos');
    const verifyToken = handlers[0];
    const getVideosHandler = handlers[1];

    const req = createMockRequest({
      path: '/getVideos',
      headers: { 'x-access-token': 'valid-token' },
      query: {}
    });
    const res = createMockResponse();

    await new Promise((resolve, reject) => {
      verifyToken(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await getVideosHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Database error' });
  });
});
