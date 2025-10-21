/* eslint-env jest */
const loggerMock = require('../__mocks__/logger');

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
  log: loggerMock,
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

  res.redirect = jest.fn((url) => {
    res.redirectUrl = url;
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
            session_token: 'valid-token',
            update: defaultSessionUpdate
          };
        } else {
          effectiveSession = null;
        }

        const dbMock = {
          initializeDatabase: jest.fn().mockResolvedValue(),
          Session: {
            findOne: jest.fn().mockImplementation(() => Promise.resolve(effectiveSession)),
            create: jest.fn().mockResolvedValue({
              id: 456,
              session_token: 'new-token'
            }),
            update: jest.fn().mockResolvedValue([1]),
            destroy: jest.fn().mockResolvedValue(1),
            findAll: jest.fn().mockResolvedValue([])
          },
          Channel: {
            findAll: jest.fn().mockResolvedValue([]),
            findByPk: jest.fn().mockResolvedValue(null)
          },
          Video: {
            findAll: jest.fn().mockResolvedValue([])
          },
          Job: {
            findAll: jest.fn().mockResolvedValue([])
          },
          Sequelize: {
            Op: {
              gt: Symbol('gt'),
              lt: Symbol('lt'),
              or: Symbol('or'),
              in: Symbol('in')
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
          plexIP: '192.168.1.100',
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
          getStorageStatus: jest.fn().mockResolvedValue({ total: 1, free: 1 }),
          isElfhostedPlatform: jest.fn(() => false),
          config: configState,
          stopWatchingConfig: jest.fn()
        };

        const channelModuleMock = {
          subscribe: jest.fn(),
          readChannels: jest.fn().mockResolvedValue([{ id: 'channel-1' }]),
          writeChannels: jest.fn().mockResolvedValue(),
          getChannelInfo: jest.fn().mockResolvedValue({
            id: 'channel-1',
            title: 'Test Channel',
            channel_id: 'UC123456'
          }),
          refreshChannelVideos: jest.fn().mockResolvedValue({ success: true })
        };

        const plexModuleMock = {
          getLibrariesWithParams: jest.fn().mockResolvedValue([
            { key: '1', title: 'Movies' },
            { key: '2', title: 'YouTube' }
          ]),
          getLibraries: jest.fn().mockResolvedValue([]),
          refreshLibrary: jest.fn().mockResolvedValue(),
          getAuthUrl: jest.fn().mockResolvedValue({
            url: 'https://app.plex.tv/auth',
            pin: '12345'
          }),
          checkPin: jest.fn().mockResolvedValue({
            authenticated: true,
            authToken: 'plex-token-123'
          })
        };

        const downloadModuleMock = {
          doSpecificDownloads: jest.fn(),
          doChannelDownloads: jest.fn()
        };

        const jobModuleMock = {
          getJob: jest.fn(),
          getRunningJobs: jest.fn(() => []),
          getAllJobs: jest.fn().mockResolvedValue([
            { id: 'job-1', type: 'Download', status: 'Completed' }
          ])
        };

        const videosModuleMock = {
          getVideos: jest.fn().mockResolvedValue([])
        };

        const httpsMock = {
          get: jest.fn((url, callback) => {
            const mockResp = {
              on: jest.fn((event, handler) => {
                if (event === 'data') {
                  handler('{"results":[{"name":"v1.0.0"},{"name":"latest"}]}');
                } else if (event === 'end') {
                  handler();
                }
              })
            };
            callback(mockResp);
            return { on: jest.fn() };
          })
        };

        const bcryptMock = {
          compare: jest.fn().mockResolvedValue(true),
          hash: jest.fn().mockResolvedValue('new-hashed-password')
        };

        // Add required mocks
        jest.doMock('../db', () => dbMock);
        jest.doMock('../modules/configModule', () => configModuleMock);
        jest.doMock('../modules/channelModule', () => channelModuleMock);
        jest.doMock('../modules/plexModule', () => plexModuleMock);
        jest.doMock('../modules/downloadModule', () => downloadModuleMock);
        jest.doMock('../modules/jobModule', () => jobModuleMock);
        jest.doMock('../modules/videosModule', () => videosModuleMock);
        jest.doMock('../modules/channelSettingsModule', () => ({
          getChannelSettings: jest.fn(),
          updateChannelSettings: jest.fn(),
          getAllSubFolders: jest.fn()
        }));
        jest.doMock('../modules/cronJobs', () => ({ initialize: jest.fn() }));
        jest.doMock('../modules/webSocketServer.js', () => jest.fn());
        jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
        jest.doMock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));
        jest.doMock('multer', () => jest.fn(() => ({ single: jest.fn(() => (req, res, next) => next()) })));
        jest.doMock('https', () => httpsMock);
        jest.doMock('bcrypt', () => bcryptMock);
        jest.doMock('uuid', () => ({ v4: jest.fn(() => 'test-uuid') }));
        jest.doMock('fs', () => ({ readFileSync: jest.fn(() => '') }));

        const serverModule = require('../server');

        state.app = serverModule.app;
        state.serverModule = serverModule;
        state.dbMock = dbMock;
        state.channelModuleMock = channelModuleMock;
        state.configModuleMock = configModuleMock;
        state.plexModuleMock = plexModuleMock;
        state.downloadModuleMock = downloadModuleMock;
        state.jobModuleMock = jobModuleMock;
        state.videosModuleMock = videosModuleMock;
        state.httpsMock = httpsMock;
        state.bcryptMock = bcryptMock;
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

describe('server routes - plex integration', () => {
  describe('GET /plex/auth-url', () => {
    test('returns Plex auth URL when auth is configured', async () => {
      const { app, plexModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/plex/auth-url');
      const authUrlHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await authUrlHandler(req, res);

      expect(plexModuleMock.getAuthUrl).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        url: 'https://app.plex.tv/auth',
        pin: '12345'
      });
    });

    test('returns error when auth not configured', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'get', '/plex/auth-url');
      const authUrlHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await authUrlHandler(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('Authentication not configured');
    });

    test('handles error from Plex module', async () => {
      const { app, plexModuleMock } = await createServerModule();
      plexModuleMock.getAuthUrl.mockRejectedValueOnce(new Error('Plex API error'));

      const handlers = findRouteHandlers(app, 'get', '/plex/auth-url');
      const authUrlHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await authUrlHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('GET /plex/check-pin/:pinId', () => {
    test('checks Plex PIN successfully', async () => {
      const { app, plexModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/plex/check-pin/:pinId');
      const checkPinHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { pinId: '12345' }
      });
      const res = createMockResponse();

      await checkPinHandler(req, res);

      expect(plexModuleMock.checkPin).toHaveBeenCalledWith('12345');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        authenticated: true,
        authToken: 'plex-token-123'
      });
    });

    test('handles unauthenticated PIN', async () => {
      const { app, plexModuleMock } = await createServerModule();
      plexModuleMock.checkPin.mockResolvedValueOnce({
        authenticated: false
      });

      const handlers = findRouteHandlers(app, 'get', '/plex/check-pin/:pinId');
      const checkPinHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { pinId: '12345' }
      });
      const res = createMockResponse();

      await checkPinHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ authenticated: false });
    });
  });

  describe('GET /refreshlibrary', () => {
    test('refreshes Plex library successfully', async () => {
      const { app, plexModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/refreshlibrary');
      const refreshHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await refreshHandler(req, res);

      expect(plexModuleMock.refreshLibrary).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Library refresh initiated'
      });
    });

    test('handles refresh error', async () => {
      const { app, plexModuleMock } = await createServerModule();
      plexModuleMock.refreshLibrary.mockRejectedValueOnce(new Error('Refresh failed'));

      const handlers = findRouteHandlers(app, 'get', '/refreshlibrary');
      const refreshHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await refreshHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: 'Failed to refresh library'
      });
    });
  });
});

describe('server routes - channel operations', () => {
  describe('GET /getchannelinfo/:channelId', () => {
    test('returns channel info successfully', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getchannelinfo/:channelId');
      const getInfoHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'UC123456' }
      });
      const res = createMockResponse();

      await getInfoHandler(req, res);

      expect(channelModuleMock.getChannelInfo).toHaveBeenCalledWith('UC123456', true);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        id: 'channel-1',
        title: 'Test Channel',
        channel_id: 'UC123456'
      });
    });
  });

  describe('POST /addchannelinfo', () => {
    test('adds channel successfully', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/addchannelinfo');
      const addChannelHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'https://youtube.com/channel/UC123456' }
      });
      const res = createMockResponse();

      await addChannelHandler(req, res);

      expect(channelModuleMock.getChannelInfo).toHaveBeenCalledWith(
        'https://youtube.com/channel/UC123456',
        false
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        channelInfo: {
          id: 'channel-1',
          title: 'Test Channel',
          channel_id: 'channel-1'  // The mock returns channel_id as 'channel-1'
        }
      });
    });

    test('handles missing URL', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/addchannelinfo');
      const addChannelHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();

      await addChannelHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'URL is missing in the request'
      });
    });

    test('handles channel not found error', async () => {
      const { app, channelModuleMock } = await createServerModule();
      const error = new Error('Channel not found');
      error.code = 'CHANNEL_NOT_FOUND';
      channelModuleMock.getChannelInfo.mockRejectedValueOnce(error);

      const handlers = findRouteHandlers(app, 'post', '/addchannelinfo');
      const addChannelHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'https://youtube.com/channel/invalid' }
      });
      const res = createMockResponse();

      await addChannelHandler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Channel not found');
    });

    test('handles cookies required error', async () => {
      const { app, channelModuleMock } = await createServerModule();
      const error = new Error('Cookies required');
      error.code = 'COOKIES_REQUIRED';
      channelModuleMock.getChannelInfo.mockRejectedValueOnce(error);

      const handlers = findRouteHandlers(app, 'post', '/addchannelinfo');
      const addChannelHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'https://youtube.com/channel/private' }
      });
      const res = createMockResponse();

      await addChannelHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Cookies required');
    });

    test('handles network error', async () => {
      const { app, channelModuleMock } = await createServerModule();
      const error = new Error('Network timeout');
      error.code = 'NETWORK_ERROR';
      channelModuleMock.getChannelInfo.mockRejectedValueOnce(error);

      const handlers = findRouteHandlers(app, 'post', '/addchannelinfo');
      const addChannelHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'https://youtube.com/channel/UC123456' }
      });
      const res = createMockResponse();

      await addChannelHandler(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.message).toContain('Unable to connect to YouTube');
    });
  });
});


describe('server routes - validateToken', () => {
  test('validates token successfully', async () => {
    const { app } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/validateToken');
    const validateHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      username: 'tester'
    });
    const res = createMockResponse();

    await validateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ valid: true, username: 'tester' });
  });
});

describe('server routes - auto-removal dry run', () => {
  test('performs dry run with boolean autoRemovalEnabled', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        deletedByAge: 0,
        deletedBySpace: 0,
        freedBytes: 0,
        errors: [],
        plan: {
          ageStrategy: { enabled: true, candidateCount: 5 },
          spaceStrategy: { enabled: false, candidateCount: 0 }
        },
        simulationTotals: { byAge: 5, bySpace: 0, total: 5, estimatedFreedBytes: 1024000 }
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: 30,
        autoRemovalFreeSpaceThreshold: '10GB'
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: 30,
        autoRemovalFreeSpaceThreshold: '10GB'
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dryRun).toBe(true);
  });

  test('performs dry run with string "true" autoRemovalEnabled', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        errors: []
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalEnabled: 'true'
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalEnabled: true
      }
    });
    expect(res.statusCode).toBe(200);
  });

  test('performs dry run with string "false" autoRemovalEnabled', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        errors: []
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalEnabled: 'false'
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalEnabled: false
      }
    });
    expect(res.statusCode).toBe(200);
  });

  test('performs dry run with numeric autoRemovalEnabled (truthy)', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        errors: []
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalEnabled: 1
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalEnabled: true
      }
    });
    expect(res.statusCode).toBe(200);
  });

  test('performs dry run with only threshold values', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        errors: []
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalVideoAgeThreshold: 60,
        autoRemovalFreeSpaceThreshold: '5GB'
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalVideoAgeThreshold: 60,
        autoRemovalFreeSpaceThreshold: '5GB'
      }
    });
    expect(res.statusCode).toBe(200);
  });

  test('performs dry run with empty body', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        totalDeleted: 0,
        errors: []
      })
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {}
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(videoDeletionModuleMock.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {}
    });
    expect(res.statusCode).toBe(200);
  });

  test('handles error during dry run', async () => {
    const { app } = await createServerModule();

    const videoDeletionModuleMock = {
      performAutomaticCleanup: jest.fn().mockRejectedValue(new Error('Cleanup failed'))
    };

    jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);

    const handlers = findRouteHandlers(app, 'post', '/api/auto-removal/dry-run');
    const dryRunHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      body: {
        autoRemovalEnabled: true
      }
    });
    const res = createMockResponse();

    await dryRunHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Cleanup failed');
  });
});

describe('server routes - getplexlibraries with test params', () => {
  test('tests Plex connection with provided parameters', async () => {
    const { app, plexModuleMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getplexlibraries');
    const getLibrariesHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      query: {
        testIP: '192.168.1.200',
        testApiKey: 'test-api-key',
        testPort: '32400'
      }
    });
    const res = createMockResponse();

    await getLibrariesHandler(req, res);

    expect(plexModuleMock.getLibrariesWithParams).toHaveBeenCalledWith(
      '192.168.1.200',
      'test-api-key',
      '32400'
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { key: '1', title: 'Movies' },
      { key: '2', title: 'YouTube' }
    ]);
  });

  test('auto-saves credentials on successful test', async () => {
    const { app, configModuleMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getplexlibraries');
    const getLibrariesHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      query: {
        testIP: '192.168.1.200',
        testApiKey: 'test-api-key',
        testPort: '32400'
      }
    });
    const res = createMockResponse();

    await getLibrariesHandler(req, res);

    expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        plexIP: '192.168.1.200',
        plexPort: '32400',
        plexApiKey: 'test-api-key'
      })
    );
  });

  test('cleans port number input', async () => {
    const { app, plexModuleMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getplexlibraries');
    const getLibrariesHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      query: {
        testIP: '192.168.1.200',
        testApiKey: 'test-api-key',
        testPort: ' :32400 ' // With extra characters
      }
    });
    const res = createMockResponse();

    await getLibrariesHandler(req, res);

    expect(plexModuleMock.getLibrariesWithParams).toHaveBeenCalledWith(
      '192.168.1.200',
      'test-api-key',
      '32400'
    );
  });

  test('returns empty array on error', async () => {
    const { app, plexModuleMock } = await createServerModule();
    plexModuleMock.getLibraries.mockRejectedValueOnce(new Error('Connection failed'));

    const handlers = findRouteHandlers(app, 'get', '/getplexlibraries');
    const getLibrariesHandler = handlers[handlers.length - 1];

    const req = createMockRequest({
      query: {}
    });
    const res = createMockResponse();

    await getLibrariesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});