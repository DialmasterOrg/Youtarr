/* eslint-env jest */

// Mock logger module
jest.mock('../../logger');

describe('DatabaseHealthModule', () => {
  let databaseHealthModule;
  let logger;
  let mockSequelize;
  let mockQueryInterface;

  beforeEach(() => {
    jest.resetModules();

    // Reset logger mocks
    logger = require('../../logger');
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock Sequelize query interface
    mockQueryInterface = {
      showAllTables: jest.fn(),
      describeTable: jest.fn(),
    };

    mockSequelize = {
      getQueryInterface: jest.fn(() => mockQueryInterface),
    };

    databaseHealthModule = require('../databaseHealthModule');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDatabaseSchema', () => {
    it('should return valid=true when all tables and columns exist', async () => {
      const mockModels = {
        Channel: {
          getTableName: () => 'channels',
          rawAttributes: {
            id: { type: { constructor: { name: 'INTEGER' } }, allowNull: false },
            channel_id: { type: { constructor: { name: 'STRING' } }, allowNull: true },
            title: { type: { constructor: { name: 'STRING' } }, allowNull: true },
          },
        },
      };

      mockQueryInterface.showAllTables.mockResolvedValue(['channels']);
      mockQueryInterface.describeTable.mockResolvedValue({
        id: { type: 'INTEGER', allowNull: false },
        channel_id: { type: 'VARCHAR(255)', allowNull: true },
        title: { type: 'VARCHAR(255)', allowNull: true },
      });

      const result = await databaseHealthModule.validateDatabaseSchema(
        mockSequelize,
        mockModels
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing table', async () => {
      const mockModels = {
        Channel: {
          getTableName: () => 'channels',
          rawAttributes: {
            id: { type: { constructor: { name: 'INTEGER' } }, allowNull: false },
          },
        },
        Video: {
          getTableName: () => 'videos',
          rawAttributes: {
            id: { type: { constructor: { name: 'INTEGER' } }, allowNull: false },
          },
        },
      };

      // Only channels table exists, videos table is missing
      mockQueryInterface.showAllTables.mockResolvedValue(['channels']);
      mockQueryInterface.describeTable.mockResolvedValue({
        id: { type: 'INTEGER', allowNull: false },
      });

      const result = await databaseHealthModule.validateDatabaseSchema(
        mockSequelize,
        mockModels
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Table "videos" for model "Video" does not exist');
    });

    it('should detect missing column', async () => {
      const mockModels = {
        Channel: {
          getTableName: () => 'channels',
          rawAttributes: {
            id: { type: { constructor: { name: 'INTEGER' } }, allowNull: false },
            channel_id: { type: { constructor: { name: 'STRING' } }, allowNull: true },
            new_field: { type: { constructor: { name: 'STRING' } }, allowNull: true },
          },
        },
      };

      mockQueryInterface.showAllTables.mockResolvedValue(['channels']);
      // Database only has id and channel_id, missing new_field
      mockQueryInterface.describeTable.mockResolvedValue({
        id: { type: 'INTEGER', allowNull: false },
        channel_id: { type: 'VARCHAR(255)', allowNull: true },
      });

      const result = await databaseHealthModule.validateDatabaseSchema(
        mockSequelize,
        mockModels
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Table "channels" is missing column "new_field"');
    });

    it('should detect nullable constraint mismatch', async () => {
      const mockModels = {
        Channel: {
          getTableName: () => 'channels',
          rawAttributes: {
            id: { type: { constructor: { name: 'INTEGER' } }, allowNull: false },
            channel_id: { type: { constructor: { name: 'STRING' } }, allowNull: false }, // Model says not nullable
          },
        },
      };

      mockQueryInterface.showAllTables.mockResolvedValue(['channels']);
      mockQueryInterface.describeTable.mockResolvedValue({
        id: { type: 'INTEGER', allowNull: false },
        channel_id: { type: 'VARCHAR(255)', allowNull: true }, // DB says nullable
      });

      const result = await databaseHealthModule.validateDatabaseSchema(
        mockSequelize,
        mockModels
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nullable mismatch');
    });

    it('should handle validation errors gracefully', async () => {
      const mockModels = {
        Channel: {
          getTableName: () => 'channels',
          rawAttributes: {},
        },
      };

      mockQueryInterface.showAllTables.mockRejectedValue(new Error('Connection failed'));

      const result = await databaseHealthModule.validateDatabaseSchema(
        mockSequelize,
        mockModels
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Schema validation failed');
    });
  });

  describe('setStartupHealth and getStartupHealth', () => {
    it('should store and retrieve startup health status', () => {
      const errors = ['Connection error', 'Schema error'];
      databaseHealthModule.setStartupHealth(false, false, errors);

      const health = databaseHealthModule.getStartupHealth();

      expect(health.database.connected).toBe(false);
      expect(health.database.schemaValid).toBe(false);
      expect(health.database.errors).toEqual(errors);
      expect(health.timestamp).toBeDefined();
    });

    it('should store healthy status', () => {
      databaseHealthModule.setStartupHealth(true, true, []);

      const health = databaseHealthModule.getStartupHealth();

      expect(health.database.connected).toBe(true);
      expect(health.database.schemaValid).toBe(true);
      expect(health.database.errors).toHaveLength(0);
    });
  });

  describe('isDatabaseHealthy', () => {
    it('should return true when database is connected and schema is valid', () => {
      databaseHealthModule.setStartupHealth(true, true, []);
      expect(databaseHealthModule.isDatabaseHealthy()).toBe(true);
    });

    it('should return false when database is not connected', () => {
      databaseHealthModule.setStartupHealth(false, true, ['Connection error']);
      expect(databaseHealthModule.isDatabaseHealthy()).toBe(false);
    });

    it('should return false when schema is not valid', () => {
      databaseHealthModule.setStartupHealth(true, false, ['Schema error']);
      expect(databaseHealthModule.isDatabaseHealthy()).toBe(false);
    });

    it('should return false when both connection and schema are invalid', () => {
      databaseHealthModule.setStartupHealth(false, false, ['Connection error', 'Schema error']);
      expect(databaseHealthModule.isDatabaseHealthy()).toBe(false);
    });
  });
});
