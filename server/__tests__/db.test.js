/* eslint-env jest */
const path = require('path');

// Store original modules
const originalSequelize = jest.requireActual('sequelize');

describe('db.js', () => {
  let db;
  let mockSequelizeInstance;
  let mockAuthenticate;
  let mockQuery;
  let mockGetQueryInterface;
  let mockUmzugInstance;
  let mockUmzugUp;
  let consoleLogSpy;
  let consoleErrorSpy;
  let SequelizeMock;
  let UmzugMock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Setup Sequelize mocks
    mockAuthenticate = jest.fn().mockResolvedValue();
    mockQuery = jest.fn().mockResolvedValue();
    mockGetQueryInterface = jest.fn().mockReturnValue({});

    mockSequelizeInstance = {
      authenticate: mockAuthenticate,
      query: mockQuery,
      getQueryInterface: mockGetQueryInterface
    };

    SequelizeMock = jest.fn(() => mockSequelizeInstance);
    // Add static properties to match real Sequelize
    Object.setPrototypeOf(SequelizeMock, originalSequelize.Sequelize);

    jest.doMock('sequelize', () => ({
      Sequelize: SequelizeMock
    }));

    // Setup Umzug mocks
    mockUmzugUp = jest.fn().mockResolvedValue();
    mockUmzugInstance = {
      up: mockUmzugUp
    };

    UmzugMock = jest.fn(() => mockUmzugInstance);
    jest.doMock('umzug', () => UmzugMock);

    // Mock models
    jest.doMock('../models', () => ({
      Channel: 'ChannelModel',
      Video: 'VideoModel',
      Job: 'JobModel',
      JobVideo: 'JobVideoModel',
      ChannelVideo: 'ChannelVideoModel'
    }));

    // Clear environment variables
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Sequelize initialization', () => {
    it('should create Sequelize instance with default values when no env vars are set', () => {
      db = require('../db');

      expect(SequelizeMock).toHaveBeenCalledWith(
        'youtarr',
        'root',
        '123qweasd',
        expect.objectContaining({
          host: 'localhost',
          dialect: 'mysql',
          port: 3321,
          logging: false,
          dialectOptions: {
            charset: 'utf8mb4',
            supportBigNumbers: true,
            bigNumberStrings: true
          },
          define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            dialectOptions: {
              charset: 'utf8mb4'
            }
          }
        })
      );
    });

    it('should use environment variables when set', () => {
      process.env.DB_NAME = 'custom_db';
      process.env.DB_USER = 'custom_user';
      process.env.DB_PASSWORD = 'custom_pass';
      process.env.DB_HOST = 'custom_host';
      process.env.DB_PORT = '3306';

      db = require('../db');

      expect(SequelizeMock).toHaveBeenCalledWith(
        'custom_db',
        'custom_user',
        'custom_pass',
        expect.objectContaining({
          host: 'custom_host',
          port: '3306' // Note: port is passed as string from env
        })
      );
    });

    it('should configure utf8mb4 charset properly', () => {
      db = require('../db');

      const callArgs = SequelizeMock.mock.calls[0][3];
      expect(callArgs.dialectOptions.charset).toBe('utf8mb4');
      expect(callArgs.define.charset).toBe('utf8mb4');
      expect(callArgs.define.collate).toBe('utf8mb4_unicode_ci');
    });

    it('should export sequelize instance and Sequelize class', () => {
      db = require('../db');

      expect(db.sequelize).toBe(mockSequelizeInstance);
      expect(db.Sequelize).toBe(SequelizeMock);
    });
  });

  describe('initializeDatabase', () => {
    beforeEach(() => {
      db = require('../db');
    });

    it('should authenticate the database connection', async () => {
      await db.initializeDatabase();

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Connection has been established successfully.');
    });

    it('should set UTF8MB4 character set', async () => {
      await db.initializeDatabase();

      expect(mockQuery).toHaveBeenCalledWith('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    });

    it('should run database migrations', async () => {
      await db.initializeDatabase();

      expect(UmzugMock).toHaveBeenCalledWith({
        migrations: {
          path: path.join(__dirname, '../../migrations'),
          params: [{}, SequelizeMock]
        },
        storage: 'sequelize',
        storageOptions: {
          sequelize: mockSequelizeInstance
        }
      });
      expect(mockUmzugUp).toHaveBeenCalled();
    });

    it('should load and export models', async () => {
      await db.initializeDatabase();

      const models = require('../models');
      Object.keys(models).forEach(modelName => {
        expect(db[modelName]).toBe(models[modelName]);
      });
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication failed');
      mockAuthenticate.mockRejectedValue(authError);

      await expect(db.initializeDatabase()).rejects.toThrow('Authentication failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to initialize the database:', authError);
    });

    it('should handle migration errors', async () => {
      const migrationError = new Error('Migration failed');
      mockUmzugUp.mockRejectedValue(migrationError);

      await expect(db.initializeDatabase()).rejects.toThrow('Migration failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to initialize the database:', migrationError);
    });

    it('should handle query errors when setting charset', async () => {
      const queryError = new Error('Query failed');
      mockQuery.mockRejectedValue(queryError);

      await expect(db.initializeDatabase()).rejects.toThrow('Query failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to initialize the database:', queryError);
    });

    it('should complete initialization in correct order', async () => {
      const callOrder = [];

      mockAuthenticate.mockImplementation(() => {
        callOrder.push('authenticate');
        return Promise.resolve();
      });

      mockQuery.mockImplementation(() => {
        callOrder.push('setCharset');
        return Promise.resolve();
      });

      mockUmzugUp.mockImplementation(() => {
        callOrder.push('migrate');
        return Promise.resolve();
      });

      await db.initializeDatabase();

      expect(callOrder).toEqual(['authenticate', 'setCharset', 'migrate']);
    });

    it('should not proceed with migrations if authentication fails', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth failed'));

      try {
        await db.initializeDatabase();
      } catch (e) {
        // Expected to throw
      }

      expect(mockUmzugUp).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should not load models if migrations fail', async () => {
      const originalModels = { ...require('../models') };
      mockUmzugUp.mockRejectedValue(new Error('Migration failed'));

      try {
        await db.initializeDatabase();
      } catch (e) {
        // Expected to throw
      }

      // Models should not be attached to db
      Object.keys(originalModels).forEach(modelName => {
        expect(db[modelName]).toBeUndefined();
      });
    });

    it('should handle missing models gracefully', async () => {
      jest.resetModules();
      jest.doMock('../models', () => ({}));

      const dbNew = require('../db');
      await dbNew.initializeDatabase();

      expect(consoleLogSpy).toHaveBeenCalledWith('Connection has been established successfully.');
    });

    it('should properly configure Umzug with sequelize storage', async () => {
      await db.initializeDatabase();

      const umzugConfig = UmzugMock.mock.calls[0][0];
      expect(umzugConfig.storage).toBe('sequelize');
      expect(umzugConfig.storageOptions.sequelize).toBe(mockSequelizeInstance);
    });

    it('should pass query interface and Sequelize to migrations', async () => {
      const mockQueryInterface = { someMethod: jest.fn() };
      mockGetQueryInterface.mockReturnValue(mockQueryInterface);

      await db.initializeDatabase();

      const umzugConfig = UmzugMock.mock.calls[0][0];
      expect(umzugConfig.migrations.params).toEqual([mockQueryInterface, SequelizeMock]);
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric string port values correctly', () => {
      process.env.DB_PORT = '3306';

      jest.resetModules();
      require('../db');

      expect(SequelizeMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          port: '3306' // Port is kept as string from env
        })
      );
    });

    it('should handle empty string environment variables', () => {
      process.env.DB_NAME = '';
      process.env.DB_USER = '';
      process.env.DB_PASSWORD = '';
      process.env.DB_HOST = '';
      process.env.DB_PORT = '';

      jest.resetModules();
      require('../db');

      expect(SequelizeMock).toHaveBeenCalledWith(
        'youtarr', // Falls back to default
        'root',
        '123qweasd',
        expect.objectContaining({
          host: 'localhost',
          port: 3321
        })
      );
    });

    it('should handle multiple calls to initializeDatabase', async () => {
      db = require('../db');

      await db.initializeDatabase();
      await db.initializeDatabase();

      expect(mockAuthenticate).toHaveBeenCalledTimes(2);
      expect(mockUmzugUp).toHaveBeenCalledTimes(2);
    });

    it('should maintain dialect options for utf8mb4 support', () => {
      db = require('../db');

      const callArgs = SequelizeMock.mock.calls[0][3];
      expect(callArgs.dialectOptions.supportBigNumbers).toBe(true);
      expect(callArgs.dialectOptions.bigNumberStrings).toBe(true);
    });
  });
});