/* eslint-env jest */
const { Sequelize } = require('sequelize');

describe('VideosModule', () => {
  let VideosModule;
  let mockSequelize;
  let mockVideo;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();

    // Mock the Video model
    mockVideo = jest.fn();

    // Mock the sequelize instance
    mockSequelize = {
      query: jest.fn()
    };

    // Mock the database module
    jest.doMock('../../db.js', () => ({
      Sequelize,
      sequelize: mockSequelize
    }));

    // Mock the models
    jest.doMock('../../models', () => ({
      Video: mockVideo
    }));

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Require the module after mocks are in place
    VideosModule = require('../videosModule');
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    test('should create an instance of VideosModule', () => {
      expect(VideosModule).toBeDefined();
      expect(VideosModule.getVideos).toBeDefined();
      expect(typeof VideosModule.getVideos).toBe('function');
    });
  });

  describe('getVideos', () => {
    test('should successfully return videos with proper query', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          duration: 300,
          originalDate: '20240101',
          description: 'Test description',
          channel_id: 'channel123',
          timeCreated: new Date('2024-01-01')
        },
        {
          id: 2,
          youtubeId: 'def456',
          youTubeChannelName: 'Another Channel',
          youTubeVideoName: 'Another Video',
          duration: 600,
          originalDate: '20240102',
          description: 'Another description',
          channel_id: 'channel456',
          timeCreated: new Date('2024-01-02')
        }
      ];

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideosModule.getVideos();

      expect(result).toEqual(mockVideos);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        {
          type: Sequelize.QueryTypes.SELECT,
          model: mockVideo,
          mapToModel: true,
          raw: true
        }
      );
    });

    test('should execute the correct SQL query', async () => {
      mockSequelize.query.mockResolvedValue([]);

      await VideosModule.getVideos();

      const sqlQuery = mockSequelize.query.mock.calls[0][0];

      // Verify the query contains all expected columns
      expect(sqlQuery).toContain('Videos.id');
      expect(sqlQuery).toContain('Videos.youtubeId');
      expect(sqlQuery).toContain('Videos.youTubeChannelName');
      expect(sqlQuery).toContain('Videos.youTubeVideoName');
      expect(sqlQuery).toContain('Videos.duration');
      expect(sqlQuery).toContain('Videos.originalDate');
      expect(sqlQuery).toContain('Videos.description');
      expect(sqlQuery).toContain('Videos.channel_id');
      expect(sqlQuery).toContain('COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\')) AS timeCreated');

      // Verify the JOINs
      expect(sqlQuery).toContain('LEFT JOIN');
      expect(sqlQuery).toContain('JobVideos ON Videos.id = JobVideos.video_id');
      expect(sqlQuery).toContain('Jobs ON Jobs.id = JobVideos.job_id');

      // Verify the ORDER BY clause
      expect(sqlQuery).toContain('ORDER BY');
      expect(sqlQuery).toContain('COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\')) DESC');

      // Verify the LIMIT
      expect(sqlQuery).toContain('LIMIT 150');
    });

    test('should pass correct query options to sequelize', async () => {
      mockSequelize.query.mockResolvedValue([]);

      await VideosModule.getVideos();

      const queryOptions = mockSequelize.query.mock.calls[0][1];

      expect(queryOptions).toEqual({
        type: Sequelize.QueryTypes.SELECT,
        model: mockVideo,
        mapToModel: true,
        raw: true
      });
    });

    test('should return empty array when no videos found', async () => {
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideosModule.getVideos();

      expect(result).toEqual([]);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });

    test('should handle database query errors', async () => {
      const mockError = new Error('Database connection failed');
      mockSequelize.query.mockRejectedValue(mockError);

      await expect(VideosModule.getVideos()).rejects.toThrow('Database connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });

    test('should handle sequelize-specific errors', async () => {
      const sequelizeError = new Error('SequelizeDatabaseError: Table Videos does not exist');
      mockSequelize.query.mockRejectedValue(sequelizeError);

      await expect(VideosModule.getVideos()).rejects.toThrow('SequelizeDatabaseError');

      expect(consoleErrorSpy).toHaveBeenCalledWith(sequelizeError);
    });

    test('should handle null/undefined results gracefully', async () => {
      mockSequelize.query.mockResolvedValue(null);

      const result = await VideosModule.getVideos();

      expect(result).toBeNull();
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });

    test('should limit results to 150 videos', async () => {
      // Create an array of 200 mock videos
      const mockVideos = Array.from({ length: 200 }, (_, index) => ({
        id: index + 1,
        youtubeId: `video${index + 1}`,
        youTubeChannelName: `Channel ${index + 1}`,
        youTubeVideoName: `Video ${index + 1}`,
        duration: 300,
        originalDate: '20240101',
        description: `Description ${index + 1}`,
        channel_id: `channel${index + 1}`,
        timeCreated: new Date('2024-01-01')
      }));

      // Even if we have 200 videos, the query should limit to 150
      const limitedVideos = mockVideos.slice(0, 150);
      mockSequelize.query.mockResolvedValue(limitedVideos);

      const result = await VideosModule.getVideos();

      expect(result).toHaveLength(150);
      expect(result).toEqual(limitedVideos);

      // Verify LIMIT 150 is in the query
      const sqlQuery = mockSequelize.query.mock.calls[0][0];
      expect(sqlQuery).toContain('LIMIT 150');
    });

    test('should order videos by timeCreated descending', async () => {
      const mockVideos = [
        {
          id: 3,
          youtubeId: 'newest',
          youTubeChannelName: 'Channel',
          youTubeVideoName: 'Newest Video',
          duration: 100,
          originalDate: '20240103',
          description: 'Newest',
          channel_id: 'channel1',
          timeCreated: new Date('2024-01-03')
        },
        {
          id: 2,
          youtubeId: 'middle',
          youTubeChannelName: 'Channel',
          youTubeVideoName: 'Middle Video',
          duration: 100,
          originalDate: '20240102',
          description: 'Middle',
          channel_id: 'channel1',
          timeCreated: new Date('2024-01-02')
        },
        {
          id: 1,
          youtubeId: 'oldest',
          youTubeChannelName: 'Channel',
          youTubeVideoName: 'Oldest Video',
          duration: 100,
          originalDate: '20240101',
          description: 'Oldest',
          channel_id: 'channel1',
          timeCreated: new Date('2024-01-01')
        }
      ];

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideosModule.getVideos();

      expect(result).toEqual(mockVideos);
      // Verify the first video is the newest
      expect(result[0].youtubeId).toBe('newest');
      expect(result[2].youtubeId).toBe('oldest');

      // Verify ORDER BY DESC is in the query
      const sqlQuery = mockSequelize.query.mock.calls[0][0];
      expect(sqlQuery).toMatch(/ORDER BY[\s\S]+DESC/);
    });

    test('should use COALESCE to handle null timeCreated from Jobs', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'video1',
          youTubeChannelName: 'Channel',
          youTubeVideoName: 'Video without Job',
          duration: 100,
          originalDate: '20240101',
          description: 'No job association',
          channel_id: 'channel1',
          timeCreated: new Date('2024-01-01') // This would come from originalDate via COALESCE
        }
      ];

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideosModule.getVideos();

      expect(result).toEqual(mockVideos);

      // Verify COALESCE is used to handle null Jobs.timeCreated
      const sqlQuery = mockSequelize.query.mock.calls[0][0];
      expect(sqlQuery).toContain('COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\'))');
    });

    test('should handle concurrent calls correctly', async () => {
      const mockVideos1 = [{ id: 1, youtubeId: 'video1' }];
      const mockVideos2 = [{ id: 2, youtubeId: 'video2' }];

      let callCount = 0;
      mockSequelize.query.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockVideos1 : mockVideos2);
      });

      const [result1, result2] = await Promise.all([
        VideosModule.getVideos(),
        VideosModule.getVideos()
      ]);

      expect(result1).toEqual(mockVideos1);
      expect(result2).toEqual(mockVideos2);
      expect(mockSequelize.query).toHaveBeenCalledTimes(2);
    });

    test('should properly format the SQL query for readability', async () => {
      mockSequelize.query.mockResolvedValue([]);

      await VideosModule.getVideos();

      const sqlQuery = mockSequelize.query.mock.calls[0][0];

      // Check that the query is properly formatted with newlines and indentation
      expect(sqlQuery).toMatch(/SELECT\s+Videos\.id/);
      expect(sqlQuery).toMatch(/FROM\s+Videos/);
      expect(sqlQuery).toMatch(/LEFT JOIN\s+JobVideos/);
      expect(sqlQuery).toMatch(/LEFT JOIN\s+Jobs/);
      expect(sqlQuery).toMatch(/ORDER BY/);
      expect(sqlQuery).toMatch(/LIMIT 150/);
    });

    test('should handle special characters in video names', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'special123',
          youTubeChannelName: 'Channel with "quotes" & special',
          youTubeVideoName: 'Video\'s title with [brackets] & symbols!',
          duration: 300,
          originalDate: '20240101',
          description: 'Description with \n newlines and \t tabs',
          channel_id: 'channel123',
          timeCreated: new Date('2024-01-01')
        }
      ];

      mockSequelize.query.mockResolvedValue(mockVideos);

      const result = await VideosModule.getVideos();

      expect(result).toEqual(mockVideos);
      expect(result[0].youTubeVideoName).toContain('\'');
      expect(result[0].youTubeChannelName).toContain('"');
      expect(result[0].description).toContain('\n');
    });
  });

  describe('module export', () => {
    test('should export a singleton instance', () => {
      // Reset modules to get a fresh import
      jest.resetModules();

      // Re-mock dependencies
      jest.doMock('../../db.js', () => ({
        Sequelize,
        sequelize: mockSequelize
      }));

      jest.doMock('../../models', () => ({
        Video: mockVideo
      }));

      const VideosModule1 = require('../videosModule');
      const VideosModule2 = require('../videosModule');

      expect(VideosModule1).toBe(VideosModule2);
    });
  });

  describe('error handling edge cases', () => {
    test('should handle network timeout errors', async () => {
      const timeoutError = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';
      mockSequelize.query.mockRejectedValue(timeoutError);

      await expect(VideosModule.getVideos()).rejects.toThrow('ETIMEDOUT');
      expect(consoleErrorSpy).toHaveBeenCalledWith(timeoutError);
    });

    test('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      mockSequelize.query.mockRejectedValue(permissionError);

      await expect(VideosModule.getVideos()).rejects.toThrow('Permission denied');
      expect(consoleErrorSpy).toHaveBeenCalledWith(permissionError);
    });

    test('should rethrow errors after logging', async () => {
      const customError = new Error('Custom error message');
      mockSequelize.query.mockRejectedValue(customError);

      try {
        await VideosModule.getVideos();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBe(customError);
        expect(error.message).toBe('Custom error message');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(customError);
    });
  });
});