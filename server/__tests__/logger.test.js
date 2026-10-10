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

    const LEVEL_VALUES = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
    mockPinoInstance.isLevelEnabled = jest.fn(
      (level) => LEVEL_VALUES[level] >= LEVEL_VALUES[mockPinoInstance.level]
    );

    // Mock pino constructor; like pino, the instance starts at the configured level
    mockPino = jest.fn((config) => {
      mockPinoInstance.level = config.level;
      return mockPinoInstance;
    });
    mockPino.stdSerializers = {
      req: jest.fn(),
      res: jest.fn(),
      err: jest.fn()
    };

    jest.doMock('pino', () => mockPino);

    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FILE_MAX_SIZE;
    delete process.env.LOG_FILE_MAX_COUNT;
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

    it('should configure pretty console logs', () => {
      require('../logger');

      const config = mockPino.mock.calls[0][0];
      expect(config.transport.targets[0].target).toBe('pino-pretty');
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
      require('../logger');

      const transportOptions = mockPino.mock.calls[0][0].transport.targets[0].options;

      expect(transportOptions.colorize).toBe(true);
      expect(transportOptions.translateTime).toBe('SYS:yyyy-mm-dd HH:MM:ss.l o');
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

  describe('Log file target', () => {
    const path = require('path');
    const serverPath = path.join(__dirname, '..', 'server.js');
    let mockCheckWritable;
    let originalArgv;

    beforeEach(() => {
      originalArgv = process.argv;
      mockCheckWritable = jest.fn(() => null);
      jest.doMock('../logging/logFileConfig', () => ({
        ...jest.requireActual('../logging/logFileConfig'),
        checkLogDirectoryWritable: mockCheckWritable,
      }));
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    const fileTarget = () => mockPino.mock.calls[0][0].transport.targets
      .find((target) => target.target.endsWith('logFileTransport.js'));

    it('adds the rolling file target in the server process', () => {
      process.argv = ['node', serverPath];
      require('../logger');

      expect(fileTarget().options).toEqual(expect.objectContaining({
        maxSizeBytes: 10 * 1024 * 1024,
        maxFiles: 5,
      }));
    });

    it('pins both targets to trace so the root level is the only filter', () => {
      process.argv = ['node', serverPath];
      require('../logger');

      const levels = mockPino.mock.calls[0][0].transport.targets.map((target) => target.level);
      expect(levels).toEqual(['trace', 'trace']);
    });

    it('leaves the file target out of other processes such as the post-processor', () => {
      process.argv = ['node', path.join(__dirname, '..', 'modules', 'videoDownloadPostProcessFiles.js')];
      require('../logger');

      expect(fileTarget()).toBeUndefined();
    });

    it('logs to the console only when the log folder is not writable', () => {
      process.argv = ['node', serverPath];
      mockCheckWritable.mockReturnValue(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }));
      require('../logger');

      expect(fileTarget()).toBeUndefined();
    });

    it('warns when the log folder is not writable', () => {
      process.argv = ['node', serverPath];
      mockCheckWritable.mockReturnValue(new Error('EACCES: permission denied'));
      require('../logger');

      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        expect.objectContaining({ directory: expect.stringMatching(/config[\\/]logs$/) }),
        'Cannot write to the log folder; logging to the console only'
      );
    });

    it('reports the folder error in the logging status', () => {
      process.argv = ['node', serverPath];
      mockCheckWritable.mockReturnValue(new Error('EACCES: permission denied'));
      const logger = require('../logger');

      expect(logger.getLoggingStatus().file).toEqual(expect.objectContaining({
        enabled: false,
        error: 'EACCES: permission denied',
      }));
    });

    it('uses LOG_FILE_MAX_SIZE and LOG_FILE_MAX_COUNT', () => {
      process.argv = ['node', serverPath];
      process.env.LOG_FILE_MAX_SIZE = '25MB';
      process.env.LOG_FILE_MAX_COUNT = '3';
      require('../logger');

      expect(fileTarget().options).toEqual(expect.objectContaining({
        maxSizeBytes: 25 * 1024 * 1024,
        maxFiles: 3,
      }));
    });

    it('warns about an invalid LOG_FILE_MAX_COUNT and uses the default', () => {
      process.argv = ['node', serverPath];
      process.env.LOG_FILE_MAX_COUNT = 'many';
      require('../logger');

      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        { variable: 'LOG_FILE_MAX_COUNT', value: 'many', fallback: 5 },
        'Invalid LOG_FILE_MAX_COUNT; using the default'
      );
    });
  });

  describe('applyLevelSetting', () => {
    it('switches to the saved setting', () => {
      const logger = require('../logger');

      logger.applyLevelSetting('debug');

      expect(mockPinoInstance.level).toBe('debug');
    });

    it('falls back to LOG_LEVEL when the setting is Default', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = require('../logger');
      logger.applyLevelSetting('debug');

      logger.applyLevelSetting('');

      expect(mockPinoInstance.level).toBe('warn');
    });

    it('logs which level is now active and where it came from', () => {
      const logger = require('../logger');

      logger.applyLevelSetting('debug');

      // Not `level`: that key would overwrite pino's own level field and the
      // record would be dropped.
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { newLevel: 'debug', previousLevel: 'info', source: 'setting' },
        'Log level changed'
      );
    });

    it('records a change to a quieter level before applying it', () => {
      const logger = require('../logger');
      let levelWhenLogged;
      mockPinoInstance.info.mockImplementation(() => { levelWhenLogged = mockPinoInstance.level; });

      logger.applyLevelSetting('warn');

      expect(levelWhenLogged).toBe('info');
    });

    it('records a change to a louder level after applying it', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = require('../logger');
      let levelWhenLogged;
      mockPinoInstance.info.mockImplementation(() => { levelWhenLogged = mockPinoInstance.level; });

      logger.applyLevelSetting('debug');

      expect(levelWhenLogged).toBe('debug');
    });

    it('can change the level without recording it', () => {
      const logger = require('../logger');

      logger.applyLevelSetting('debug', { announce: false });

      expect(mockPinoInstance.level).toBe('debug');
      expect(mockPinoInstance.info).not.toHaveBeenCalled();
    });

    it('does nothing when the level is unchanged', () => {
      const logger = require('../logger');

      logger.applyLevelSetting('info');

      expect(mockPinoInstance.info).not.toHaveBeenCalled();
    });
  });

  describe('getLoggingStatus', () => {
    it('reports the LOG_LEVEL value and log file settings', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = require('../logger');

      expect(logger.getLoggingStatus()).toEqual({
        envLevel: 'warn',
        file: {
          enabled: false,
          directory: expect.stringMatching(/config[\\/]logs$/),
          maxSizeBytes: 10 * 1024 * 1024,
          maxFiles: 5,
          error: null,
        },
      });
    });
  });
});
