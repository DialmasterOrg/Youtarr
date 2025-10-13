/* eslint-env jest */

describe('logger.js', () => {
  let mockPino;
  let mockPinoInstance;
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    jest.resetModules();
    jest.clearAllMocks();

    // Mock pino instance
    mockPinoInstance = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn()
      }))
    };

    // Mock pino constructor
    mockPino = jest.fn(() => mockPinoInstance);
    mockPino.stdSerializers = {
      req: jest.fn(),
      res: jest.fn(),
      err: jest.fn()
    };

    jest.doMock('pino', () => mockPino);

    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Pino initialization', () => {
    it('should create logger with default log level (info) when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;

      require('../logger');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info'
        })
      );
    });

    it('should use LOG_LEVEL environment variable when set', () => {
      process.env.LOG_LEVEL = 'debug';

      require('../logger');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });
  });

  describe('Sensitive data redaction', () => {
    it('should configure redaction for password fields', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.redact.paths).toContain('password');
      expect(config.redact.paths).toContain('passwordHash');
      expect(config.redact.paths).toContain('req.body.password');
      expect(config.redact.paths).toContain('req.body.currentPassword');
      expect(config.redact.paths).toContain('req.body.newPassword');
    });

    it('should configure redaction for token and API key fields', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.redact.paths).toContain('token');
      expect(config.redact.paths).toContain('authToken');
      expect(config.redact.paths).toContain('plexAuthToken');
      expect(config.redact.paths).toContain('session_token');
      expect(config.redact.paths).toContain('plexApiKey');
      expect(config.redact.paths).toContain('youtubeApiKey');
    });

    it('should configure redaction for authorization headers', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.redact.paths).toContain('req.headers.authorization');
      expect(config.redact.paths).toContain('req.headers["x-access-token"]');
      expect(config.redact.paths).toContain('authorization');
    });

    it('should configure redaction for cookie fields', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.redact.paths).toContain('cookie');
      expect(config.redact.paths).toContain('req.headers.cookie');
      expect(config.redact.paths).toContain('res.headers["set-cookie"]');
    });

    it('should set redact.remove to true for complete data removal', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.redact.remove).toBe(true);
    });
  });

  describe('Serializers', () => {
    it('should configure standard serializers for req, res, and err', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.serializers.req).toBe(mockPino.stdSerializers.req);
      expect(config.serializers.res).toBe(mockPino.stdSerializers.res);
      expect(config.serializers.err).toBe(mockPino.stdSerializers.err);
    });
  });

  describe('Base fields configuration', () => {
    it('should include pid in base fields', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.base.pid).toBe(process.pid);
    });
  });

  describe('Logger export', () => {
    it('should export the pino logger instance', () => {
      const logger = require('../logger');

      expect(logger).toBe(mockPinoInstance);
      expect(mockPino).toHaveBeenCalledTimes(1);
    });

    it('should export logger with all standard log methods', () => {
      const logger = require('../logger');

      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should export logger with child method', () => {
      const logger = require('../logger');

      expect(typeof logger.child).toBe('function');
    });
  });

  describe('Environment-specific behavior', () => {
    it('should handle different log levels via LOG_LEVEL', () => {
      const logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

      logLevels.forEach(level => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.doMock('pino', () => mockPino);

        process.env.LOG_LEVEL = level;

        require('../logger');

        expect(mockPino).toHaveBeenCalledWith(
          expect.objectContaining({
            level
          })
        );
      });
    });

    it('should configure pretty logs when log level is debug', () => {
      process.env.LOG_LEVEL = 'debug';

      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.transport).toBeDefined();
      expect(config.transport.target).toBe('pino-pretty');
    });

  });

  describe('Complete configuration structure', () => {
    it('should configure all required pino options', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];

      // Verify all top-level config properties
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('transport');
      expect(config).toHaveProperty('redact');
      expect(config).toHaveProperty('serializers');
      expect(config).toHaveProperty('base');
    });

    it('should have valid redact configuration structure', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];

      expect(config.redact).toHaveProperty('paths');
      expect(config.redact).toHaveProperty('remove');
      expect(Array.isArray(config.redact.paths)).toBe(true);
      expect(config.redact.paths.length).toBeGreaterThan(0);
    });

    it('should configure pino-pretty options correctly', () => {
      process.env.LOG_LEVEL = 'debug';

      require('../logger');

      const config = mockPino.mock.calls[0][0];
      const transportOptions = config.transport.options;

      expect(transportOptions.colorize).toBe(true);
      expect(transportOptions.translateTime).toBe('UTC:yyyy-mm-dd HH:MM:ss.l o');
      expect(transportOptions.ignore).toBe('pid,hostname');
      expect(transportOptions.messageFormat).toBe('{if req.id}[{req.id}] {end}{msg}');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty LOG_LEVEL gracefully', () => {
      process.env.LOG_LEVEL = '';

      require('../logger');

      const config = mockPino.mock.calls[0][0];
      // Empty string evaluates to falsy, so it falls back to 'info'
      expect(config.level).toBe('info');
    });

    it('should handle multiple require calls returning same instance', () => {
      const logger1 = require('../logger');
      const logger2 = require('../logger');

      expect(logger1).toBe(logger2);
      expect(mockPino).toHaveBeenCalledTimes(1);
    });

    it('should properly configure redaction with remove flag', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];

      // Verify that sensitive data will be completely removed, not just masked
      expect(config.redact.remove).toBe(true);
    });

    it('should configure serializers as function references', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];

      expect(typeof config.serializers.req).toBe('function');
      expect(typeof config.serializers.res).toBe('function');
      expect(typeof config.serializers.err).toBe('function');
    });
  });

  describe('Security considerations', () => {
    it('should redact all common password-related fields', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      const redactedPaths = config.redact.paths;

      const passwordFields = [
        'password',
        'passwordHash',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword'
      ];

      passwordFields.forEach(field => {
        expect(redactedPaths).toContain(field);
      });
    });

    it('should redact all authentication tokens', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      const redactedPaths = config.redact.paths;

      const tokenFields = [
        'token',
        'authToken',
        'plexAuthToken',
        'session_token',
        'plexApiKey',
        'youtubeApiKey'
      ];

      tokenFields.forEach(field => {
        expect(redactedPaths).toContain(field);
      });
    });

    it('should redact authorization and cookie headers', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      const redactedPaths = config.redact.paths;

      const headerFields = [
        'req.headers.authorization',
        'req.headers["x-access-token"]',
        'authorization',
        'cookie',
        'req.headers.cookie',
        'res.headers["set-cookie"]'
      ];

      headerFields.forEach(field => {
        expect(redactedPaths).toContain(field);
      });
    });

    it('should completely remove sensitive data instead of masking', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];

      // remove: true means data is completely removed, not replaced with [Redacted]
      expect(config.redact.remove).toBe(true);
    });
  });
});
