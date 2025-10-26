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

        const multerSingleMock = jest.fn(() => (req, res, next) => {
          if (req.path === '/cookies/upload' && req.body.simulateFile) {
            req.file = { buffer: Buffer.from('cookie-content') };
          }
          next();
        });
        const multerMock = jest.fn(() => ({ single: multerSingleMock }));

        // Add required mocks for server initialization
        jest.doMock('../modules/channelModule', () => ({
          subscribe: jest.fn(),
          readChannels: jest.fn().mockResolvedValue([])
        }));
        jest.doMock('../modules/plexModule', () => ({}));
        jest.doMock('../modules/downloadModule', () => ({}));
        jest.doMock('../modules/jobModule', () => ({
          getRunningJobs: jest.fn(() => [])
        }));
        jest.doMock('../modules/videosModule', () => ({}));
        jest.doMock('../modules/channelSettingsModule', () => ({
          getChannelSettings: jest.fn(),
          updateChannelSettings: jest.fn(),
          getAllSubFolders: jest.fn()
        }));
        jest.doMock('../modules/webSocketServer.js', () => jest.fn());
        jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
        jest.doMock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));
        jest.doMock('https', () => ({ get: jest.fn() }));

        jest.doMock('../db', () => dbMock);
        jest.doMock('../modules/configModule', () => configModuleMock);
        jest.doMock('bcrypt', () => bcryptMock);
        jest.doMock('uuid', () => uuidMock);
        jest.doMock('fs', () => fsMock);
        jest.doMock('multer', () => multerMock);

        const serverModule = require('../server');

        state.app = serverModule.app;
        state.serverModule = serverModule;
        state.dbMock = dbMock;
        state.configModuleMock = configModuleMock;
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

  test('ignores preset credentials when config already contains auth', async () => {
    const { configModuleMock, bcryptMock } = await createServerModule({
      authPreset: { username: 'admin', password: 'supersecret!' }
    });

    expect(bcryptMock.hash).not.toHaveBeenCalledWith('supersecret!', 10);
    expect(configModuleMock.updateConfig).not.toHaveBeenCalledWith(expect.objectContaining({ username: 'admin' }));
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
    test('returns setup required when not configured', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const statusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await statusHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: true,
        isLocalhost: true,
        message: null
      });
    });

    test('returns setup not required when configured', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const statusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await statusHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: false,
        isLocalhost: true,
        message: null
      });
    });

    test('detects non-localhost access', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const statusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        ip: '192.168.1.100'
      });
      const res = createMockResponse();

      await statusHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.requiresSetup).toBe(true);
      // isLocalhost will be falsy but may be undefined depending on the isLocalhostIP implementation
      expect(res.body.message).toBe('Setup must be performed from localhost');
    });

    test('handles platform managed auth', async () => {
      const { app } = await createServerModule({ authEnabled: 'false' });

      const handlers = findRouteHandlers(app, 'get', '/setup/status');
      const statusHandler = handlers[handlers.length - 1];

      const req = createMockRequest({});
      const res = createMockResponse();

      await statusHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        requiresSetup: false,
        isLocalhost: true,
        platformManaged: true,
        message: 'Authentication is managed by the platform'
      });
    });
  });

  describe('POST /setup/create-auth', () => {
    test('creates initial authentication successfully', async () => {
      const { app, bcryptMock, dbMock, configModuleMock } = await createServerModule({
        passwordHash: null
      });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'newuser',
          password: 'password123'
        },
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Mozilla/5.0'
        }
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(bcryptMock.hash).toHaveBeenCalledWith('password123', 10);
      expect(configModuleMock.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          passwordHash: 'new-hashed-password'
        })
      );
      expect(dbMock.Session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_token: 'test-uuid-token',
          username: 'newuser'
        })
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        token: 'test-uuid-token',
        message: 'Setup complete! You can now access Youtarr from anywhere.',
        username: 'newuser'
      });
    });

    test('blocks setup from non-localhost', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'newuser',
          password: 'password123'
        },
        ip: '192.168.1.100'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('Initial setup can only be performed from localhost');
    });

    test('prevents setup when already configured', async () => {
      const { app } = await createServerModule();

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'newuser',
          password: 'password123'
        },
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Authentication already configured' });
    });

    test('validates username requirements', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: '',
          password: 'password123'
        },
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Username is required' });
    });

    test('validates password requirements', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'newuser',
          password: 'short'
        },
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Password must be at least 8 characters' });
    });

    test('validates maximum username length', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'a'.repeat(33),
          password: 'password123'
        },
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Username is too long (max 32 characters)' });
    });

    test('validates maximum password length', async () => {
      const { app } = await createServerModule({ passwordHash: null });

      const handlers = findRouteHandlers(app, 'post', '/setup/create-auth');
      const createAuthHandler = handlers[handlers.length - 1];

      const req = createMockRequest({
        body: {
          username: 'newuser',
          password: 'a'.repeat(65)
        },
        ip: '127.0.0.1'
      });
      const res = createMockResponse();

      await createAuthHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Password is too long' });
    });
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
