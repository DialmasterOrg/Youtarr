/* eslint-env jest */
const loggerMock = require('../__mocks__/logger');
const { findRouteHandlers } = require('./testUtils');

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
          reinitializeDatabase: jest.fn().mockResolvedValue({
            connected: true,
            schemaValid: true,
            errors: []
          }),
          sequelize: {
            authenticate: jest.fn().mockResolvedValue(true)
          },
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
            destroy: jest.fn().mockResolvedValue(1)
          },
          Video: {
            findAll: jest.fn().mockResolvedValue([]),
            destroy: jest.fn().mockResolvedValue(1)
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
          youtubeOutputDirectory: '/downloads',
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
          getStorageStatus: jest.fn().mockResolvedValue({
            total: 100000000000,
            free: 50000000000,
            used: 50000000000,
            percentUsed: 50
          }),
          isElfhostedPlatform: jest.fn(() => false),
          config: configState,
          stopWatchingConfig: jest.fn()
        };

        const channelModuleMock = {
          subscribe: jest.fn(),
          readChannels: jest.fn().mockResolvedValue([{ id: 'channel-1' }]),
          getChannelsPaginated: jest.fn().mockResolvedValue({
            channels: [{ id: 'channel-1' }],
            total: 1,
            page: 1,
            pageSize: 50,
            totalPages: 1,
            subFolders: []
          }),
          updateChannelsByDelta: jest.fn().mockResolvedValue(),
          writeChannels: jest.fn().mockResolvedValue(),
          getChannelInfo: jest.fn().mockResolvedValue({ id: 'channel-1', title: 'Channel' }),
          getChannelVideos: jest.fn().mockResolvedValue({
            videos: [{ id: 'video-1', title: 'Video 1' }],
            videoFail: false
          }),
          fetchAllChannelVideos: jest.fn().mockResolvedValue({
            success: true,
            message: 'Fetching videos in progress',
            videos: [{ id: 'video-1', title: 'Video 1' }]
          }),
          deleteChannel: jest.fn().mockResolvedValue({ success: true }),
          getChannelAvailableTabs: jest.fn().mockResolvedValue({ availableTabs: ['videos', 'shorts', 'streams']}),
          updateAutoDownloadForTab: jest.fn().mockResolvedValue()
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
          getJob: jest.fn((jobId) => {
            if (jobId === 'existing-job') {
              return { id: jobId, status: 'In Progress' };
            }
            return null;
          }),
          getRunningJobs: jest.fn(() => [])
        };

        const videosModuleMock = {
          getVideos: jest.fn().mockResolvedValue([
            { id: 'video-1', title: 'Video 1' },
            { id: 'video-2', title: 'Video 2' }
          ]),
          getVideosPaginated: jest.fn().mockResolvedValue({
            videos: [
              { id: 'video-1', title: 'Video 1' },
              { id: 'video-2', title: 'Video 2' }
            ],
            pagination: {
              page: 1,
              limit: 12,
              total: 2,
              totalPages: 1
            }
          }),
          deleteVideos: jest.fn().mockResolvedValue({ deletedCount: 2 }),
          backfillVideoMetadata: jest.fn().mockResolvedValue({ processed: 0, errors: 0 })
        };

        const videoDeletionModuleMock = {
          deleteVideos: jest.fn().mockResolvedValue({
            success: true,
            deleted: [1, 2],
            failed: []
          }),
          deleteVideosByYoutubeIds: jest.fn().mockResolvedValue({
            success: true,
            deleted: ['vid1', 'vid2'],
            failed: []
          })
        };

        const videoValidationModuleMock = {
          validateVideo: jest.fn().mockResolvedValue({
            isValidUrl: true,
            metadata: { title: 'Test Video' }
          })
        };

        const channelSettingsModuleMock = {
          getChannelSettings: jest.fn().mockResolvedValue({
            sub_folder: null,
            video_quality: null
          }),
          updateChannelSettings: jest.fn().mockResolvedValue({
            success: true,
            folderMoved: false
          }),
          getAllSubFolders: jest.fn().mockResolvedValue([])
        };

        const bcryptMock = {
          compare: jest.fn().mockResolvedValue(true),
          hash: jest.fn().mockResolvedValue('new-hashed-password')
        };

        const uuidMock = {
          v4: jest.fn(() => 'test-uuid-token')
        };

        const fsMock = {
          readFileSync: jest.fn(() => ''),
          unlink: jest.fn((path, cb) => cb(null))
        };

        const childProcessMock = {
          execSync: jest.fn(() => '2025.09.23')
        };
        const pinoHttpMock = jest.fn(() => (req, res, next) => next());

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

        const cronMock = { schedule: jest.fn() };
        const rateLimitMiddleware = jest.fn(() => (req, res, next) => next());
        // Mock ipKeyGenerator to normalize IPv6 addresses
        rateLimitMiddleware.ipKeyGenerator = jest.fn((ip) => ip);
        const multerSingleMock = jest.fn(() => (req, res, next) => {
          if (req.path === '/cookies/upload' && req.body.simulateFile) {
            req.file = { buffer: Buffer.from('cookie-content') };
          }
          next();
        });
        const multerMock = jest.fn(() => ({ single: multerSingleMock }));

        jest.doMock('../logger', () => loggerMock);
        jest.doMock('../db', () => dbMock);
        jest.doMock('../modules/configModule', () => configModuleMock);
        jest.doMock('../modules/channelModule', () => channelModuleMock);
        jest.doMock('../modules/plexModule', () => plexModuleMock);
        jest.doMock('../modules/downloadModule', () => downloadModuleMock);
        jest.doMock('../modules/jobModule', () => jobModuleMock);
        jest.doMock('../modules/videosModule', () => videosModuleMock);
        jest.doMock('../modules/videoDeletionModule', () => videoDeletionModuleMock);
        jest.doMock('../modules/videoValidationModule', () => videoValidationModuleMock);
        jest.doMock('../modules/channelSettingsModule', () => channelSettingsModuleMock);
        jest.doMock('../modules/archiveModule', () => ({
          getAutoRemovalDryRun: jest.fn().mockResolvedValue({ videos: [], totalSize: 0 })
        }));
        jest.doMock('../modules/notificationModule', () => ({
          sendTestNotification: jest.fn().mockResolvedValue({ success: true })
        }));
        jest.doMock('../models/channelvideo', () => ({
          update: jest.fn().mockResolvedValue([1])
        }));
        jest.doMock('../modules/webSocketServer.js', () => jest.fn());
        jest.doMock('node-cron', () => cronMock);
        jest.doMock('express-rate-limit', () => Object.assign(rateLimitMiddleware, { ipKeyGenerator: rateLimitMiddleware.ipKeyGenerator }));
        jest.doMock('multer', () => multerMock);
        jest.doMock('https', () => httpsMock);
        jest.doMock('bcrypt', () => bcryptMock);
        jest.doMock('uuid', () => uuidMock);
        jest.doMock('fs', () => fsMock);
        jest.doMock('child_process', () => childProcessMock);
        jest.doMock('pino-http', () => pinoHttpMock);

        const serverModule = require('../server');

        state.app = serverModule.app;
        state.serverModule = serverModule;
        state.dbMock = dbMock;
        state.channelModuleMock = channelModuleMock;
        state.cronMock = cronMock;
        state.configModuleMock = configModuleMock;
        state.plexModuleMock = plexModuleMock;
        state.downloadModuleMock = downloadModuleMock;
        state.jobModuleMock = jobModuleMock;
        state.videosModuleMock = videosModuleMock;
        state.videoDeletionModuleMock = videoDeletionModuleMock;
        state.videoValidationModuleMock = videoValidationModuleMock;
        state.channelSettingsModuleMock = channelSettingsModuleMock;
        state.bcryptMock = bcryptMock;
        state.uuidMock = uuidMock;
        state.httpsMock = httpsMock;
        state.fsMock = fsMock;
        state.childProcessMock = childProcessMock;
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

describe('server routes - authentication', () => {
  describe('POST /auth/login', () => {
    test('successful login with valid credentials', async () => {
      const { app, bcryptMock, dbMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/login');
      const loginHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'tester', password: 'password123' }
      });
      const res = createMockResponse();

      await loginHandler(req, res);

      expect(bcryptMock.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(dbMock.Session.create).toHaveBeenCalledWith(expect.objectContaining({
        session_token: 'test-uuid-token',
        username: 'tester'
      }));
      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.username).toBe('tester');
      expect(res.body.expires).toBeTruthy();
    });

    test('login fails with invalid password', async () => {
      const { app, bcryptMock } = await createServerModule();
      bcryptMock.compare.mockResolvedValueOnce(false);

      const handlers = findRouteHandlers(app, 'post', '/auth/login');
      const loginHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'tester', password: 'wrong-password' }
      });
      const res = createMockResponse();

      await loginHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    test('login fails with missing username', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/login');
      const loginHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { password: 'password123' }
      });
      const res = createMockResponse();

      await loginHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid username' });
    });

    test('login fails with long username', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/login');
      const loginHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'a'.repeat(40), password: 'password123' }
      });
      const res = createMockResponse();

      await loginHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid username' });
    });

    test('login fails when auth not configured', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/auth/login');
      const loginHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'user', password: 'pass' }
      });
      const res = createMockResponse();

      await loginHandler(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('Authentication not configured');
    });
  });

  describe('POST /auth/logout', () => {
    test('successful logout with valid token', async () => {
      const { app, dbMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/logout');
      const logoutHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        headers: { 'x-access-token': 'valid-token' },
        sessionId: 123
      });
      const res = createMockResponse();

      // Simulate middleware setting sessionId
      const verifyToken = handlers[0];
      await verifyToken(req, res, () => {});

      await logoutHandler(req, res);

      expect(dbMock.Session.update).toHaveBeenCalledWith(
        { is_active: false },
        { where: { session_token: 'valid-token' } }
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    test('logout without token fails', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/logout');
      const verifyToken = handlers[0];

      const req = createMockRequest({});
      const res = createMockResponse();

      await verifyToken(req, res, () => {});

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'No token provided' });
    });
  });
});

describe('server routes - configuration', () => {
  describe('GET /getconfig', () => {
    test('returns config without sensitive data', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getconfig');
      const getConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        username: 'tester'
      });
      const res = createMockResponse();

      await getConfigHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.username).toBeUndefined();
      expect(res.body.isPlatformManaged).toBeDefined();
      expect(res.body.deploymentEnvironment).toBeDefined();
    });

    test('includes useTmpForDownloads in isPlatformManaged when not elfhosted', async () => {
      const { app, configModuleMock } = await createServerModule();
      configModuleMock.isElfhostedPlatform.mockReturnValue(false);

      const handlers = findRouteHandlers(app, 'get', '/getconfig');
      const getConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        username: 'tester'
      });
      const res = createMockResponse();

      await getConfigHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.isPlatformManaged).toBeDefined();
      expect(res.body.isPlatformManaged.useTmpForDownloads).toBe(false);
    });

    test('includes useTmpForDownloads in isPlatformManaged when elfhosted', async () => {
      const { app, configModuleMock } = await createServerModule();
      configModuleMock.isElfhostedPlatform.mockReturnValue(true);

      const handlers = findRouteHandlers(app, 'get', '/getconfig');
      const getConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        username: 'tester'
      });
      const res = createMockResponse();

      await getConfigHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.isPlatformManaged).toBeDefined();
      expect(res.body.isPlatformManaged.useTmpForDownloads).toBe(true);
    });
  });

  describe('POST /updateconfig', () => {
    test('updates config successfully', async () => {
      const { app, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updateconfig');
      const updateConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          plexYoutubeLibraryId: '22',
          plexApiKey: 'new-key'
        }
      });
      const res = createMockResponse();

      await updateConfigHandler(req, res);

      expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          plexYoutubeLibraryId: '22',
          plexApiKey: 'new-key'
        })
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('accepts update even with different data types', async () => {
      const { app, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updateconfig');
      const updateConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          plexYoutubeLibraryId: 25 // Will be accepted as is
        }
      });
      const res = createMockResponse();

      await updateConfigHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(configModuleMock.updateConfig).toHaveBeenCalled();
    });

    test('prevents updating sensitive fields', async () => {
      const { app, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updateconfig');
      const updateConfigHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          passwordHash: 'malicious-hash',
          username: 'hacker'
        }
      });
      const res = createMockResponse();

      await updateConfigHandler(req, res);

      expect(configModuleMock.updateConfig).toHaveBeenCalled();
      const updateCall = configModuleMock.updateConfig.mock.calls[0][0];
      // The route preserves existing passwordHash and username
      expect(updateCall.passwordHash).toBe('hashed-password');
      expect(updateCall.username).toBe('tester');
    });
  });
});

describe('server routes - channels', () => {
  describe('GET /api/channels/:channelId/tabs', () => {
    test('returns available tabs for a channel', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/api/channels/:channelId/tabs');
      const getTabsHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' }
      });
      const res = createMockResponse();

      await getTabsHandler(req, res);

      expect(channelModuleMock.getChannelAvailableTabs).toHaveBeenCalledWith('channel-1');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        availableTabs: ['videos', 'shorts', 'streams'],
      });
    });

    test('handles error when getting available tabs', async () => {
      const { app, channelModuleMock } = await createServerModule();
      channelModuleMock.getChannelAvailableTabs.mockRejectedValueOnce(new Error('Failed to fetch tabs'));

      const handlers = findRouteHandlers(app, 'get', '/api/channels/:channelId/tabs');
      const getTabsHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' }
      });
      const res = createMockResponse();

      await getTabsHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        error: 'Failed to get available tabs',
        message: 'Failed to fetch tabs'
      });
    });
  });

  describe('PATCH /api/channels/:channelId/tabs/:tabType/auto-download', () => {
    test('updates auto-download setting successfully', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'patch', '/api/channels/:channelId/tabs/:tabType/auto-download');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1', tabType: 'shorts' },
        body: { enabled: true }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.updateAutoDownloadForTab).toHaveBeenCalledWith('channel-1', 'shorts', true);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    test('validates enabled parameter is boolean', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'patch', '/api/channels/:channelId/tabs/:tabType/auto-download');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1', tabType: 'shorts' },
        body: { enabled: 'yes' }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad request',
        message: 'enabled must be a boolean value'
      });
    });

    test('handles missing enabled parameter', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'patch', '/api/channels/:channelId/tabs/:tabType/auto-download');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1', tabType: 'shorts' },
        body: {}
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Bad request',
        message: 'enabled must be a boolean value'
      });
    });

    test('handles error during update', async () => {
      const { app, channelModuleMock } = await createServerModule();
      channelModuleMock.updateAutoDownloadForTab.mockRejectedValueOnce(new Error('Database error'));

      const handlers = findRouteHandlers(app, 'patch', '/api/channels/:channelId/tabs/:tabType/auto-download');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1', tabType: 'shorts' },
        body: { enabled: false }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        error: 'Failed to update auto download setting',
        message: 'Database error'
      });
    });
  });

  describe('GET /getchannelvideos/:channelId', () => {
    test('returns channel videos successfully with default parameters', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getchannelvideos/:channelId');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {}
      });
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(channelModuleMock.getChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        1,    // default page
        50,   // default pageSize
        false, // default hideDownloaded
        '',   // default searchQuery
        'date', // default sortBy
        'desc', // default sortOrder
        'videos' // default tabType
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        videos: [{ id: 'video-1', title: 'Video 1' }],
        videoFail: false
      });
    });

    test('handles array format from channel module', async () => {
      const { app, channelModuleMock } = await createServerModule();
      channelModuleMock.getChannelVideos.mockResolvedValueOnce([
        { id: 'video-1', title: 'Video 1' }
      ]);

      const handlers = findRouteHandlers(app, 'get', '/getchannelvideos/:channelId');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {}
      });
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        videos: [{ id: 'video-1', title: 'Video 1' }],
        videoFail: false
      });
    });

    test('passes pagination and filter parameters to channel module', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getchannelvideos/:channelId');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {
          page: '2',
          pageSize: '25',
          hideDownloaded: 'true',
          searchQuery: 'test search',
          sortBy: 'title',
          sortOrder: 'asc'
        }
      });
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(channelModuleMock.getChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        2,
        25,
        true,
        'test search',
        'title',
        'asc',
        'videos' // default tabType
      );
      expect(res.statusCode).toBe(200);
    });

    test('passes tabType parameter to channel module when provided', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getchannelvideos/:channelId');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {
          page: '1',
          pageSize: '50',
          hideDownloaded: 'false',
          searchQuery: '',
          sortBy: 'date',
          sortOrder: 'desc',
          tabType: 'shorts'
        }
      });
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(channelModuleMock.getChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        1,
        50,
        false,
        '',
        'date',
        'desc',
        'shorts'
      );
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /fetchallchannelvideos/:channelId', () => {
    test('fetches all channel videos successfully with default parameters', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/fetchallchannelvideos/:channelId');
      const fetchHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {}
      });
      const res = createMockResponse();

      await fetchHandler(req, res);

      expect(channelModuleMock.fetchAllChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        1,    // default page
        50,   // default pageSize
        false, // default hideDownloaded
        'videos' // default tabType
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Fetching videos in progress',
        videos: [{ id: 'video-1', title: 'Video 1' }]
      });
    });

    test('passes pagination parameters when provided', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/fetchallchannelvideos/:channelId');
      const fetchHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {
          page: '3',
          pageSize: '100',
          hideDownloaded: 'true'
        }
      });
      const res = createMockResponse();

      await fetchHandler(req, res);

      expect(channelModuleMock.fetchAllChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        3,
        100,
        true,
        'videos' // default tabType
      );
      expect(res.statusCode).toBe(200);
    });

    test('passes tabType parameter when provided', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/fetchallchannelvideos/:channelId');
      const fetchHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {
          page: '1',
          pageSize: '50',
          hideDownloaded: 'false',
          tabType: 'streams'
        }
      });
      const res = createMockResponse();

      await fetchHandler(req, res);

      expect(channelModuleMock.fetchAllChannelVideos).toHaveBeenCalledWith(
        'channel-1',
        1,
        50,
        false,
        'streams'
      );
      expect(res.statusCode).toBe(200);
    });

    test('handles concurrency error with 409 status', async () => {
      const { app, channelModuleMock } = await createServerModule();
      const concurrencyError = new Error('A fetch operation is already in progress for this channel');
      channelModuleMock.fetchAllChannelVideos.mockRejectedValueOnce(concurrencyError);

      const handlers = findRouteHandlers(app, 'post', '/fetchallchannelvideos/:channelId');
      const fetchHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {}
      });
      const res = createMockResponse();

      await fetchHandler(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({
        success: false,
        error: 'FETCH_IN_PROGRESS',
        message: 'A fetch operation is already in progress for this channel'
      });
    });

    test('handles general error with 500 status', async () => {
      const { app, channelModuleMock } = await createServerModule();
      const generalError = new Error('Database connection failed');
      channelModuleMock.fetchAllChannelVideos.mockRejectedValueOnce(generalError);

      const handlers = findRouteHandlers(app, 'post', '/fetchallchannelvideos/:channelId');
      const fetchHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { channelId: 'channel-1' },
        query: {}
      });
      const res = createMockResponse();

      await fetchHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: 'Failed to fetch all channel videos',
        message: 'Database connection failed'
      });
    });
  });

  describe('POST /updatechannels', () => {
    test('updates channels successfully', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updatechannels');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: [{ id: 'channel-1', enabled: true }]
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.writeChannels).toHaveBeenCalledWith([{ id: 'channel-1', enabled: true }]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('applies delta updates when add/remove arrays provided', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updatechannels');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { add: ['https://youtube.com/@new'], remove: ['https://youtube.com/@old'] }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.updateChannelsByDelta).toHaveBeenCalledWith({
        enableUrls: ['https://youtube.com/@new'],
        disableUrls: ['https://youtube.com/@old']
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('accepts objects with url and channel_id for add array', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updatechannels');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          add: [
            { url: 'https://youtube.com/@channel1', channel_id: 'UC123' },
            { url: 'https://youtube.com/@channel2', channel_id: 'UC456' }
          ],
          remove: []
        }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.updateChannelsByDelta).toHaveBeenCalledWith({
        enableUrls: [
          { url: 'https://youtube.com/@channel1', channel_id: 'UC123' },
          { url: 'https://youtube.com/@channel2', channel_id: 'UC456' }
        ],
        disableUrls: []
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('returns 400 when delta payload has no changes', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updatechannels');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { add: [], remove: [] }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.updateChannelsByDelta).not.toHaveBeenCalled();
      expect(channelModuleMock.writeChannels).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'No channel changes provided'
      });
    });

    test('returns 400 for invalid payload type', async () => {
      const { app, channelModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/updatechannels');
      const updateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { invalid: true }
      });
      const res = createMockResponse();

      await updateHandler(req, res);

      expect(channelModuleMock.updateChannelsByDelta).not.toHaveBeenCalled();
      expect(channelModuleMock.writeChannels).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Invalid payload for channel update'
      });
    });
  });
});

describe('server routes - videos', () => {
  describe('GET /getVideos', () => {
    test('returns videos with default pagination', async () => {
      const { app, videosModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getVideos');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await getVideosHandler(req, res);

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
      expect(res.body).toEqual({
        videos: [
          { id: 'video-1', title: 'Video 1' },
          { id: 'video-2', title: 'Video 2' }
        ],
        pagination: {
          page: 1,
          limit: 12,
          total: 2,
          totalPages: 1
        }
      });
    });

    test('accepts pagination and filter parameters', async () => {
      const { app, videosModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/getVideos');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        query: {
          page: '2',
          limit: '24',
          search: 'test video',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          sortBy: 'title',
          sortOrder: 'asc',
          channelFilter: 'channel123'
        }
      });
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(videosModuleMock.getVideosPaginated).toHaveBeenCalledWith({
        page: 2,
        limit: 24,
        search: 'test video',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        sortBy: 'title',
        sortOrder: 'asc',
        channelFilter: 'channel123'
      });
      expect(res.statusCode).toBe(200);
    });

    test('handles error when fetching videos', async () => {
      const { app, videosModuleMock } = await createServerModule();
      videosModuleMock.getVideosPaginated.mockRejectedValueOnce(new Error('Database error'));

      const handlers = findRouteHandlers(app, 'get', '/getVideos');
      const getVideosHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await getVideosHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Database error' });
    });
  });


  describe('POST /api/checkYoutubeVideoURL', () => {
    test('validates YouTube URL successfully', async () => {
      const { app, videoValidationModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/api/checkYoutubeVideoURL');
      const validateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'https://youtube.com/watch?v=test' }
      });
      const res = createMockResponse();

      await validateHandler(req, res);

      expect(videoValidationModuleMock.validateVideo).toHaveBeenCalledWith('https://youtube.com/watch?v=test');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        isValidUrl: true,
        metadata: { title: 'Test Video' }
      });
    });

    test('handles missing URL', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/api/checkYoutubeVideoURL');
      const validateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();

      await validateHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        isValidUrl: false,
        error: 'URL is required'
      });
    });

    test('handles validation error', async () => {
      const { app, videoValidationModuleMock } = await createServerModule();
      videoValidationModuleMock.validateVideo.mockRejectedValueOnce(new Error('Validation failed'));

      const handlers = findRouteHandlers(app, 'post', '/api/checkYoutubeVideoURL');
      const validateHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { url: 'invalid-url' }
      });
      const res = createMockResponse();

      await validateHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        isValidUrl: false,
        error: 'Internal server error'
      });
    });
  });

  describe('DELETE /api/videos', () => {
    test('deletes videos by database IDs successfully', async () => {
      const { app, videoDeletionModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { videoIds: [1, 2, 3] }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(videoDeletionModuleMock.deleteVideos).toHaveBeenCalledWith([1, 2, 3]);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        deleted: [1, 2],
        failed: []
      });
    });

    test('deletes videos by YouTube IDs successfully', async () => {
      const { app, videoDeletionModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { youtubeIds: ['vid1', 'vid2'] }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(videoDeletionModuleMock.deleteVideosByYoutubeIds).toHaveBeenCalledWith(['vid1', 'vid2']);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        deleted: ['vid1', 'vid2'],
        failed: []
      });
    });

    test('prefers youtubeIds over videoIds when both provided', async () => {
      const { app, videoDeletionModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          videoIds: [1, 2],
          youtubeIds: ['vid1', 'vid2']
        }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(videoDeletionModuleMock.deleteVideosByYoutubeIds).toHaveBeenCalledWith(['vid1', 'vid2']);
      expect(videoDeletionModuleMock.deleteVideos).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    test('returns 400 when videoIds is not an array', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { videoIds: 'not-an-array' }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'videoIds or youtubeIds array is required'
      });
    });

    test('returns 400 when youtubeIds is not an array', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { youtubeIds: 123 }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'videoIds or youtubeIds array is required'
      });
    });

    test('returns 400 when videoIds array is empty', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { videoIds: [] }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'videoIds or youtubeIds array is required'
      });
    });

    test('returns 400 when youtubeIds array is empty', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { youtubeIds: [] }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'videoIds or youtubeIds array is required'
      });
    });

    test('returns 400 when neither videoIds nor youtubeIds provided', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'videoIds or youtubeIds array is required'
      });
    });

    test('returns 500 when deletion module throws error', async () => {
      const { app, videoDeletionModuleMock } = await createServerModule();
      videoDeletionModuleMock.deleteVideos.mockRejectedValueOnce(new Error('Database error'));

      const handlers = findRouteHandlers(app, 'delete', '/api/videos');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { videoIds: [1, 2] }
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });
});

describe('server routes - jobs', () => {
  describe('GET /jobstatus/:jobId', () => {
    test('returns job status for existing job', async () => {
      const { app, jobModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/jobstatus/:jobId');
      const jobStatusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { jobId: 'existing-job' }
      });
      const res = createMockResponse();

      await jobStatusHandler(req, res);

      expect(jobModuleMock.getJob).toHaveBeenCalledWith('existing-job');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ id: 'existing-job', status: 'In Progress' });
    });

    test('returns 404 for non-existent job', async () => {
      const { app, jobModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/jobstatus/:jobId');
      const jobStatusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { jobId: 'non-existent-job' }
      });
      const res = createMockResponse();

      await jobStatusHandler(req, res);

      expect(jobModuleMock.getJob).toHaveBeenCalledWith('non-existent-job');
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Job not found' });
    });
  });

  describe('GET /runningjobs', () => {
    test('returns list of running jobs', async () => {
      const { app, jobModuleMock } = await createServerModule();
      jobModuleMock.getRunningJobs.mockReturnValueOnce([
        { id: 'job-1', status: 'In Progress' },
        { id: 'job-2', status: 'In Progress' }
      ]);

      const handlers = findRouteHandlers(app, 'get', '/runningjobs');
      const runningJobsHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await runningJobsHandler(req, res);

      expect(jobModuleMock.getRunningJobs).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([
        { id: 'job-1', status: 'In Progress' },
        { id: 'job-2', status: 'In Progress' }
      ]);
    });
  });
});

describe('server routes - downloads', () => {
  describe('POST /triggerspecificdownloads', () => {
    test('triggers specific downloads successfully', async () => {
      const { app, downloadModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/triggerspecificdownloads');
      const downloadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          urls: ['https://youtube.com/watch?v=1'],
          overrideSettings: { resolution: '1080' }
        }
      });
      const res = createMockResponse();

      await downloadHandler(req, res);

      expect(downloadModuleMock.doSpecificDownloads).toHaveBeenCalledWith(req);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('rejects invalid resolution in override settings', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/triggerspecificdownloads');
      const downloadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          urls: ['https://youtube.com/watch?v=1'],
          overrideSettings: { resolution: '4K' } // Invalid
        }
      });
      const res = createMockResponse();

      await downloadHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Invalid resolution');
    });
  });

  describe('POST /triggerchanneldownloads', () => {
    test('triggers channel downloads when no job is running', async () => {
      const { app, downloadModuleMock, jobModuleMock } = await createServerModule();
      jobModuleMock.getRunningJobs.mockReturnValueOnce([]);

      const handlers = findRouteHandlers(app, 'post', '/triggerchanneldownloads');
      const downloadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { overrideSettings: { resolution: '720', videoCount: 5 } }
      });
      const res = createMockResponse();

      await downloadHandler(req, res);

      expect(downloadModuleMock.doChannelDownloads).toHaveBeenCalledWith({
        overrideSettings: { resolution: '720', videoCount: 5 }
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'success' });
    });

    test('prevents duplicate channel download jobs', async () => {
      const { app, jobModuleMock } = await createServerModule();
      jobModuleMock.getRunningJobs.mockReturnValueOnce([
        { jobType: 'Channel Downloads', status: 'In Progress' }
      ]);

      const handlers = findRouteHandlers(app, 'post', '/triggerchanneldownloads');
      const downloadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();

      await downloadHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Job Already Running' });
    });

    test('validates video count in override settings', async () => {
      const { app, jobModuleMock } = await createServerModule();
      jobModuleMock.getRunningJobs.mockReturnValueOnce([]);

      const handlers = findRouteHandlers(app, 'post', '/triggerchanneldownloads');
      const downloadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { overrideSettings: { videoCount: 'invalid' } }
      });
      const res = createMockResponse();

      await downloadHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Invalid video count');
    });
  });
});

describe('server routes - storage', () => {
  test('GET /storage-status returns storage information', async () => {
    const { app, configModuleMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/storage-status');
    const storageHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();

    await storageHandler(req, res);

    expect(configModuleMock.getStorageStatus).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      total: 100000000000,
      free: 50000000000,
      used: 50000000000,
      percentUsed: 50
    });
  });

  test('GET /storage-status handles error', async () => {
    const { app, configModuleMock } = await createServerModule();
    configModuleMock.getStorageStatus.mockResolvedValueOnce(null);

    const handlers = findRouteHandlers(app, 'get', '/storage-status');
    const storageHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();

    await storageHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Could not retrieve storage status' });
  });
});

describe('server routes - version', () => {
  test('GET /getCurrentReleaseVersion returns Docker Hub version', async () => {
    const { app } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getCurrentReleaseVersion');
    const versionHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();

    await versionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ version: 'v1.0.0', ytDlpVersion: '2025.09.23' });
  });

  test('GET /getCurrentReleaseVersion reuses cached yt-dlp version', async () => {
    const { app, childProcessMock } = await createServerModule();

    const handlers = findRouteHandlers(app, 'get', '/getCurrentReleaseVersion');
    const versionHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();
    const resSecond = createMockResponse();

    await versionHandler(req, res);
    await versionHandler(req, resSecond);

    expect(childProcessMock.execSync).toHaveBeenCalledTimes(1);
  });

  test('GET /getCurrentReleaseVersion handles error', async () => {
    const { app, httpsMock } = await createServerModule();
    httpsMock.get.mockImplementationOnce(() => {
      return {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
        })
      };
    });

    const handlers = findRouteHandlers(app, 'get', '/getCurrentReleaseVersion');
    const versionHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();

    await versionHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  test('GET /getCurrentReleaseVersion filters out dev tags', async () => {
    const { app, httpsMock } = await createServerModule();

    // Mock response with dev tags that should be filtered out
    httpsMock.get.mockImplementationOnce((url, callback) => {
      const mockResp = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            // dev-latest and dev-rc tags should be filtered, leaving only stable version tags
            handler('{"results":[{"name":"dev-latest"},{"name":"dev-rc.abc1234"},{"name":"v1.2.0"},{"name":"v1.1.0"},{"name":"latest"}]}');
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResp);
      return { on: jest.fn() };
    });

    const handlers = findRouteHandlers(app, 'get', '/getCurrentReleaseVersion');
    const versionHandler = handlers[handlers.length - 1];

    const req = createMockRequest({});
    const res = createMockResponse();

    await versionHandler(req, res);

    expect(res.statusCode).toBe(200);
    // Should not return dev tags - version should not start with 'dev'
    expect(res.body.version).not.toMatch(/^dev/);
    // Should not return 'latest' tag
    expect(res.body.version).not.toBe('latest');
  });
});
