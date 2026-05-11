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

  return res;
};

const createServerModule = ({
  authEnabled = 'true',
  passwordHash = 'hashed-password',
  session,
  skipInitialize = false,
  configOverrides = {},
  authPreset
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

        if (authPreset?.username) {
          process.env.AUTH_PRESET_USERNAME = authPreset.username;
        } else {
          delete process.env.AUTH_PRESET_USERNAME;
        }

        if (authPreset?.password) {
          process.env.AUTH_PRESET_PASSWORD = authPreset.password;
        } else {
          delete process.env.AUTH_PRESET_PASSWORD;
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
            findAll: jest.fn().mockResolvedValue([
              {
                id: 1,
                user_agent: 'Mozilla/5.0',
                ip_address: '127.0.0.1',
                createdAt: new Date(),
                last_used_at: new Date()
              }
            ])
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
          writeCustomCookiesFile: jest.fn().mockResolvedValue(),
          deleteCustomCookiesFile: jest.fn().mockResolvedValue(),
          getStorageStatus: jest.fn().mockResolvedValue({ total: 1, free: 1 }),
          isElfhostedPlatform: jest.fn(() => false),
          config: configState,
          stopWatchingConfig: jest.fn()
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

        const multerSingleMock = jest.fn(() => (req, res, next) => {
          if (req.path === '/cookies/upload' && req.body.simulateFile) {
            req.file = { buffer: Buffer.from('cookie-content') };
          }
          next();
        });
        const multerMock = Object.assign(jest.fn(() => ({ single: multerSingleMock })), {
          memoryStorage: jest.fn(() => ({})),
        });
        const pinoHttpMock = jest.fn(() => (req, res, next) => next());

        // Add required mocks for server initialization
        jest.doMock('../logger', () => loggerMock);
        jest.doMock('child_process', () => childProcessMock);
        jest.doMock('pino-http', () => pinoHttpMock);

        jest.doMock('../modules/channelModule', () => ({
          subscribe: jest.fn(),
          readChannels: jest.fn().mockResolvedValue([]),
          getChannelsPaginated: jest.fn().mockResolvedValue({
            channels: [],
            total: 0,
            page: 1,
            pageSize: 50,
            totalPages: 0,
            subFolders: []
          }),
          updateChannelsByDelta: jest.fn().mockResolvedValue()
        }));
        jest.doMock('../modules/plexModule', () => ({}));
        jest.doMock('../modules/downloadModule', () => ({}));
        jest.doMock('../modules/jobModule', () => ({
          getRunningJobs: jest.fn(() => []),
          getRunningJobsWithFreshVideos: jest.fn().mockResolvedValue([])
        }));
        jest.doMock('../modules/videosModule', () => ({}));
        jest.doMock('../modules/videoMetadataModule', () => ({
          getVideoMetadata: jest.fn().mockResolvedValue(null),
          getVideoStreamInfo: jest.fn().mockResolvedValue(null)
        }));
        jest.doMock('../modules/channelSettingsModule', () => ({
          getChannelSettings: jest.fn(),
          updateChannelSettings: jest.fn(),
          getAllSubFolders: jest.fn()
        }));
        jest.doMock('../modules/archiveModule', () => ({
          getAutoRemovalDryRun: jest.fn().mockResolvedValue({ videos: [], totalSize: 0 })
        }));
        jest.doMock('../modules/subscriptionImport', () => ({
          init: jest.fn(),
          ImportInProgressError: class ImportInProgressError extends Error {}
        }));
        jest.doMock('../modules/videoSearchModule', () => ({
          searchVideos: jest.fn().mockResolvedValue([]),
          ALLOWED_COUNTS: [10, 25, 50],
          SearchCanceledError: class SearchCanceledError extends Error {},
          SearchTimeoutError: class SearchTimeoutError extends Error {},
        }));
        jest.doMock('../modules/messageEmitter', () => ({
          emitMessage: jest.fn(),
          getLastMessages: jest.fn(() => [])
        }));
        jest.doMock('../models', () => ({
          Channel: { findAll: jest.fn().mockResolvedValue([]) }
        }));
        jest.doMock('../modules/videoDeletionModule', () => ({
          deleteVideos: jest.fn().mockResolvedValue({ deleted: [], failed: [] }),
          deleteVideosByYoutubeIds: jest.fn().mockResolvedValue({ deleted: [], failed: [] })
        }));
        jest.doMock('../modules/videoValidationModule', () => ({
          validateVideo: jest.fn().mockResolvedValue({ isValidUrl: true, metadata: {} })
        }));
        jest.doMock('../modules/notificationModule', () => ({
          sendTestNotification: jest.fn().mockResolvedValue({ success: true })
        }));
        // Mocked to avoid pulling fs-extra (via ytDlpRunner -> tempPathManager),
        // which the minimal `fs` stub above can't satisfy.
        jest.doMock('../modules/filenamePreview', () => ({
          previewTemplate: jest.fn(),
          validateTemplate: jest.fn().mockResolvedValue({ ok: true })
        }));
        jest.doMock('../models/channelvideo', () => ({
          update: jest.fn().mockResolvedValue([1])
        }));
        jest.doMock('../modules/webSocketServer.js', () => jest.fn());
        jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
        jest.doMock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));
        jest.doMock('https', () => ({ get: jest.fn() }));

        const setupTokenModuleMock = {
          setTokenPath: jest.fn(),
          reset: jest.fn(),
          getToken: jest.fn(() => 'mock-token-value'),
          ensureToken: jest.fn(),
          verify: jest.fn((provided) => provided === 'mock-token-value'),
          consume: jest.fn(),
          claimForSetup: jest.fn((provided) => provided === 'mock-token-value'),
          releaseSetupClaim: jest.fn(),
          clearStaleFile: jest.fn(),
          logBanner: jest.fn()
        };

        jest.doMock('../db', () => dbMock);
        jest.doMock('../modules/configModule', () => configModuleMock);
        jest.doMock('../modules/setupTokenModule', () => setupTokenModuleMock);
        jest.doMock('bcrypt', () => bcryptMock);
        jest.doMock('uuid', () => uuidMock);
        jest.doMock('fs', () => fsMock);
        jest.doMock('multer', () => multerMock);

        const serverModule = require('../server');

        state.app = serverModule.app;
        state.serverModule = serverModule;
        state.dbMock = dbMock;
        state.configModuleMock = configModuleMock;
        state.setupTokenModuleMock = setupTokenModuleMock;
        state.bcryptMock = bcryptMock;
        state.uuidMock = uuidMock;
        state.fsMock = fsMock;
        state.multerMock = multerMock;
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
  delete process.env.AUTH_PRESET_USERNAME;
  delete process.env.AUTH_PRESET_PASSWORD;
  delete process.env.TRUST_PROXY;
});

describe('auth preset bootstrap', () => {
  test('applies preset credentials when config is missing auth', async () => {
    const presetPassword = 'supersecret!';
    const { configModuleMock, bcryptMock } = await createServerModule({
      passwordHash: null,
      configOverrides: { username: null },
      authPreset: { username: 'admin', password: presetPassword }
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith(presetPassword, 10);
    expect(configModuleMock.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      username: 'admin',
      passwordHash: 'new-hashed-password'
    }));
  });

  test('ignores preset credentials when password is missing', async () => {
    const { configModuleMock, bcryptMock } = await createServerModule({
      passwordHash: null,
      configOverrides: { username: null },
      authPreset: { username: 'admin' }
    });

    expect(bcryptMock.hash).not.toHaveBeenCalled();
    expect(configModuleMock.updateConfig).not.toHaveBeenCalledWith(expect.objectContaining({ username: 'admin' }));
  });

  test('applies preset credentials when username is a single character', async () => {
    const presetPassword = 'supersecret!';
    const { configModuleMock, bcryptMock } = await createServerModule({
      passwordHash: null,
      configOverrides: { username: null },
      authPreset: { username: 'a', password: presetPassword }
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith(presetPassword, 10);
    expect(configModuleMock.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      username: 'a',
      passwordHash: 'new-hashed-password'
    }));
  });
});

describe('server routes - cookies', () => {
  describe('GET /api/cookies/status', () => {
    test('returns cookies status', async () => {
      const { app, configModuleMock } = await createServerModule();
      configModuleMock.getCookiesStatus.mockReturnValueOnce({
        cookiesEnabled: true,
        customCookiesUploaded: true,
        customFileExists: true
      });

      const handlers = findRouteHandlers(app, 'get', '/api/cookies/status');
      const statusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await statusHandler(req, res);

      expect(configModuleMock.getCookiesStatus).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        cookiesEnabled: true,
        customCookiesUploaded: true,
        customFileExists: true
      });
    });
  });

  describe('POST /api/cookies/upload', () => {
    test('uploads cookies file successfully', async () => {
      const { app, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/api/cookies/upload');
      const uploadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        file: { buffer: Buffer.from('# Netscape HTTP Cookie File\ntest.com\tFALSE\t/\tTRUE\t0\tname\tvalue') },
        body: { simulateFile: true }
      });
      const res = createMockResponse();

      await uploadHandler(req, res);

      expect(configModuleMock.writeCustomCookiesFile).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Cookie file uploaded successfully');
    });

    test('handles missing file', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/api/cookies/upload');
      const uploadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'No file uploaded' });
    });

    test('handles invalid cookie file format', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/api/cookies/upload');
      const uploadHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        file: { buffer: Buffer.from('Invalid cookie content') }
      });
      const res = createMockResponse();

      await uploadHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Invalid cookie file format');
    });
  });

  describe('DELETE /api/cookies', () => {
    test('deletes custom cookies file successfully', async () => {
      const { app, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/api/cookies');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(configModuleMock.deleteCustomCookiesFile).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        message: 'Custom cookie file deleted',
        cookieStatus: {
          cookiesEnabled: false,
          customCookiesUploaded: false,
          customFileExists: false
        }
      });
    });

    test('handles deletion error', async () => {
      const { app, configModuleMock } = await createServerModule();
      configModuleMock.deleteCustomCookiesFile.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const handlers = findRouteHandlers(app, 'delete', '/api/cookies');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to delete cookie file');
    });
  });
});

describe('server routes - session management', () => {
  describe('GET /auth/sessions', () => {
    test('returns active sessions for current user', async () => {
      const { app, dbMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/auth/sessions');
      const sessionsHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        username: 'tester'
      });
      const res = createMockResponse();

      await sessionsHandler(req, res);

      expect(dbMock.Session.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          username: 'tester',
          is_active: true
        })
      }));
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    test('deletes session successfully', async () => {
      const { app, dbMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'delete', '/auth/sessions/:id');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { id: '123' },
        username: 'tester'
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(dbMock.Session.update).toHaveBeenCalledWith(
        { is_active: false },
        {
          where: {
            id: '123',
            username: 'tester'
          }
        }
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    test('returns 404 for non-existent session', async () => {
      const { app, dbMock } = await createServerModule();
      dbMock.Session.update.mockResolvedValueOnce([0]);

      const handlers = findRouteHandlers(app, 'delete', '/auth/sessions/:id');
      const deleteHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        params: { id: '999' },
        username: 'tester'
      });
      const res = createMockResponse();

      await deleteHandler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Session not found' });
    });
  });

  describe('POST /auth/change-password', () => {
    test('changes password successfully', async () => {
      const { app, bcryptMock, configModuleMock } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/change-password');
      const changePasswordHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          currentPassword: 'old-password',
          newPassword: 'new-password-123'
        },
        username: 'tester'
      });
      const res = createMockResponse();

      await changePasswordHandler(req, res);

      expect(bcryptMock.compare).toHaveBeenCalledWith('old-password', 'hashed-password');
      expect(bcryptMock.hash).toHaveBeenCalledWith('new-password-123', 10);
      expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'new-hashed-password'
        })
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Password updated successfully'
      });
    });

    test('rejects incorrect current password', async () => {
      const { app, bcryptMock } = await createServerModule();
      bcryptMock.compare.mockResolvedValueOnce(false);

      const handlers = findRouteHandlers(app, 'post', '/auth/change-password');
      const changePasswordHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-123'
        }
      });
      const res = createMockResponse();

      await changePasswordHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Current password is incorrect' });
    });

    test('validates password length', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/change-password');
      const changePasswordHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          currentPassword: 'password',
          newPassword: 'short'
        }
      });
      const res = createMockResponse();

      await changePasswordHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'New password must be at least 8 characters long' });
    });

    test('rejects too long password', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/auth/change-password');
      const changePasswordHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          currentPassword: 'password',
          newPassword: 'a'.repeat(65)
        }
      });
      const res = createMockResponse();

      await changePasswordHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'New password is too long' });
    });
  });

  describe('GET /auth/validate', () => {
    test('validates token and returns username', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/auth/validate');
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
});

describe('server routes - setup', () => {
  describe('GET /setup/status', () => {
    test('returns requiresSetup=true with no isLocalhost field when unconfigured', async () => {
      const { app } = await createServerModule({ passwordHash: null });
      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: true,
        platformManaged: false,
        message: null
      });
      expect(res.body).not.toHaveProperty('isLocalhost');
    });

    test('returns requiresSetup=false when configured', async () => {
      const { app } = await createServerModule();
      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: false,
        platformManaged: false,
        message: null
      });
    });

    test('returns requiresSetup=true when username is missing even if passwordHash exists', async () => {
      const { app } = await createServerModule({
        passwordHash: 'existing-hash',
        configOverrides: { username: null }
      });
      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: true,
        platformManaged: false,
        message: null
      });
    });

    test('returns platformManaged=true when AUTH_ENABLED=false', async () => {
      const { app } = await createServerModule({ authEnabled: 'false' });
      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: false,
        platformManaged: true,
        message: 'Authentication is managed by the platform'
      });
    });
  });

  describe('POST /setup/create-auth', () => {
    test('rejects request with no token', async () => {
      const { app } = await createServerModule({ passwordHash: null });
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'admin', password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid setup token' });
    });

    test('rejects request with wrong token', async () => {
      const { app, setupTokenModuleMock } = await createServerModule({ passwordHash: null });
      setupTokenModuleMock.verify.mockReturnValueOnce(false);

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'wrong', username: 'admin', password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid setup token' });
    });

    test('accepts correct token, creates user, consumes token', async () => {
      const { app, bcryptMock, configModuleMock, dbMock, setupTokenModuleMock } =
        await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(setupTokenModuleMock.verify).toHaveBeenCalledWith('mock-token-value');
      expect(bcryptMock.hash).toHaveBeenCalledWith('password123', 10);
      expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser', passwordHash: 'new-hashed-password' })
      );
      expect(dbMock.Session.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser' })
      );
      expect(setupTokenModuleMock.claimForSetup).toHaveBeenCalledWith('mock-token-value');
      expect(setupTokenModuleMock.consume).toHaveBeenCalledTimes(1);
      expect(dbMock.Session.create.mock.invocationCallOrder[0]).toBeLessThan(
        setupTokenModuleMock.consume.mock.invocationCallOrder[0]
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        token: 'test-uuid-token',
        message: 'Setup complete! You can now access Youtarr normally.',
        username: 'newuser'
      });
    });

    test('reports partial setup success when session creation fails after credentials are saved', async () => {
      const { app, dbMock, setupTokenModuleMock } = await createServerModule({ passwordHash: null });
      dbMock.Session.create.mockRejectedValueOnce(new Error('database unavailable'));

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(setupTokenModuleMock.claimForSetup).toHaveBeenCalledWith('mock-token-value');
      expect(setupTokenModuleMock.consume).toHaveBeenCalledTimes(1);
      expect(setupTokenModuleMock.releaseSetupClaim).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({
        error: 'Setup saved your credentials but the session could not be created. Please log in with the credentials you just entered.'
      });
    });

    test('rolls back in-memory auth fields when config persistence fails', async () => {
      const { app, configModuleMock, setupTokenModuleMock } = await createServerModule({ passwordHash: null });
      configModuleMock.updateConfig.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const firstReq = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      const firstRes = createMockResponse();

      await handler(firstReq, firstRes);

      expect(firstRes.statusCode).toBe(500);
      expect(firstRes.body).toEqual({ error: 'Setup failed' });
      expect(configModuleMock.getConfig()).toEqual(
        expect.objectContaining({ username: null, passwordHash: null })
      );
      expect(setupTokenModuleMock.releaseSetupClaim).toHaveBeenCalledTimes(1);
      expect(setupTokenModuleMock.consume).not.toHaveBeenCalled();

      const secondReq = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      const secondRes = createMockResponse();

      await handler(secondReq, secondRes);

      expect(secondRes.statusCode).toBe(200);
      expect(configModuleMock.updateConfig).toHaveBeenCalledTimes(2);
    });

    test('rejects concurrent submit with valid token when setup is already in progress', async () => {
      const { app, setupTokenModuleMock } = await createServerModule({ passwordHash: null });
      setupTokenModuleMock.claimForSetup.mockReturnValueOnce(false);

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(setupTokenModuleMock.verify).toHaveBeenCalledWith('mock-token-value');
      expect(setupTokenModuleMock.claimForSetup).toHaveBeenCalledWith('mock-token-value');
      expect(setupTokenModuleMock.consume).not.toHaveBeenCalled();
      expect(setupTokenModuleMock.releaseSetupClaim).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid setup token' });
    });

    test('rejects when already configured', async () => {
      const { app } = await createServerModule();
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: 'newuser', password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Authentication already configured' });
    });

    test('returns invalid setup token for tokenless probes even when already configured', async () => {
      const { app } = await createServerModule();
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { username: 'newuser', password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid setup token' });
    });

    test('validates username is required', async () => {
      const { app } = await createServerModule({ passwordHash: null });
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: '', password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Username is required' });
    });

    test('validates username length after trimming whitespace', async () => {
      const { app, configModuleMock, dbMock } = await createServerModule({ passwordHash: null });
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: `admin${' '.repeat(28)}`, password: 'password123' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin' })
      );
      expect(dbMock.Session.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin' })
      );
    });

    test('validates password length', async () => {
      const { app } = await createServerModule({ passwordHash: null });
      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const handler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: { token: 'mock-token-value', username: 'admin', password: 'short' }
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Password must be at least 8 characters' });
    });
  });
});

describe('setup token wiring on initialize', () => {
  test('ensures a token when passwordHash is missing and AUTH_PRESET is not set', async () => {
    const { setupTokenModuleMock } = await createServerModule({ passwordHash: null });

    expect(setupTokenModuleMock.ensureToken).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.logBanner).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.clearStaleFile).not.toHaveBeenCalled();
  });

  test('clears stale token file when AUTH_PRESET applies', async () => {
    const { setupTokenModuleMock } = await createServerModule({
      passwordHash: null,
      authPreset: { username: 'admin', password: 'longenough' }
    });

    expect(setupTokenModuleMock.clearStaleFile).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.ensureToken).not.toHaveBeenCalled();
  });

  test('clears stale token file when passwordHash is already set (defensive cleanup)', async () => {
    const { setupTokenModuleMock } = await createServerModule({ passwordHash: 'existing-hash' });

    expect(setupTokenModuleMock.clearStaleFile).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.ensureToken).not.toHaveBeenCalled();
  });

  test('ensures a token when config is partially configured with passwordHash but no username', async () => {
    const { setupTokenModuleMock } = await createServerModule({
      passwordHash: 'existing-hash',
      configOverrides: { username: null }
    });

    expect(setupTokenModuleMock.ensureToken).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.logBanner).toHaveBeenCalledTimes(1);
    expect(setupTokenModuleMock.clearStaleFile).not.toHaveBeenCalled();
  });

  test('does nothing for the token when AUTH_ENABLED=false', async () => {
    const { setupTokenModuleMock } = await createServerModule({
      authEnabled: 'false',
      passwordHash: null
    });

    expect(setupTokenModuleMock.ensureToken).not.toHaveBeenCalled();
    expect(setupTokenModuleMock.clearStaleFile).not.toHaveBeenCalled();
    expect(setupTokenModuleMock.logBanner).not.toHaveBeenCalled();
  });
});

describe('server - WSL environment detection', () => {
  test('detects WSL environment based on environment variables', async () => {
    process.env.WSL_INTEROP = '/run/WSL/8_interop';
    const { serverModule } = await createServerModule({ skipInitialize: true });
    // Since isWslEnvironment is evaluated at module load time and is not exported,
    // we can't test it directly. This test is mainly to ensure no errors occur.
    expect(serverModule).toBeDefined();
    delete process.env.WSL_INTEROP;
  });

  test('handles non-WSL Linux environment', async () => {
    const { serverModule } = await createServerModule({ skipInitialize: true });
    expect(serverModule).toBeDefined();
  });
});
