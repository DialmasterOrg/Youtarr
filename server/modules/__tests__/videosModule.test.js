/* eslint-env jest */
const { Sequelize } = require('sequelize');

describe('VideosModule', () => {
  let VideosModule;
  let mockSequelize;
  let mockVideo;
  let mockFs;
  let mockConfigModule;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    jest.resetModules();

    // Mock the Video model
    mockVideo = {
      count: jest.fn(),
      findAll: jest.fn()
    };

    // Mock the sequelize instance
    mockSequelize = {
      query: jest.fn()
    };

    // Mock fs promises
    mockFs = {
      stat: jest.fn(),
      readdir: jest.fn()
    };

    // Mock configModule
    mockConfigModule = {
      directoryPath: '/test/output/dir'
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

    // Mock fs
    jest.doMock('fs', () => ({
      promises: mockFs
    }));

    // Mock configModule
    jest.doMock('../configModule', () => mockConfigModule);

    // Spy on console.error and console.log
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Require the module after mocks are in place
    VideosModule = require('../videosModule');
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    test('should create an instance of VideosModule', () => {
      expect(VideosModule).toBeDefined();
      expect(VideosModule.getVideosPaginated).toBeDefined();
      expect(typeof VideosModule.getVideosPaginated).toBe('function');
      expect(VideosModule.backfillVideoMetadata).toBeDefined();
      expect(typeof VideosModule.backfillVideoMetadata).toBe('function');
      expect(VideosModule.scanForVideoFiles).toBeDefined();
      expect(typeof VideosModule.scanForVideoFiles).toBe('function');
    });
  });

  describe('getVideosPaginated', () => {
    test('should successfully return paginated videos with default options', async () => {
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
          filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false,
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
          filePath: '/test/output/dir/Another Channel/video [def456].mp4',
          fileSize: '2000',
          removed: false,
          timeCreated: new Date('2024-01-02')
        }
      ];

      // Mock count query
      mockSequelize.query.mockResolvedValueOnce([{ total: 2 }]);
      // Mock videos query
      mockSequelize.query.mockResolvedValueOnce(mockVideos);

      // Mock file stat checks for both videos
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await VideosModule.getVideosPaginated();

      expect(result).toEqual({
        channels: [],
        videos: mockVideos,
        total: 2,
        page: 1,
        totalPages: 1
      });
      // Count query + videos query + no update queries needed
      expect(mockSequelize.query).toHaveBeenCalledTimes(2);
      // First call should be count query
      expect(mockSequelize.query.mock.calls[0][0]).toContain('COUNT');
      // Second call should be videos query
      expect(mockSequelize.query.mock.calls[1][0]).toContain('SELECT');
    });

    test('should execute the correct SQL query', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated();

      const sqlQuery = mockSequelize.query.mock.calls[1][0];

      // Verify the query contains all expected columns
      expect(sqlQuery).toContain('Videos.id');
      expect(sqlQuery).toContain('Videos.youtubeId');
      expect(sqlQuery).toContain('Videos.youTubeChannelName');
      expect(sqlQuery).toContain('Videos.youTubeVideoName');
      expect(sqlQuery).toContain('Videos.duration');
      expect(sqlQuery).toContain('Videos.originalDate');
      expect(sqlQuery).toContain('Videos.description');
      expect(sqlQuery).toContain('Videos.channel_id');
      expect(sqlQuery).toContain('Videos.filePath');
      expect(sqlQuery).toContain('Videos.fileSize');
      expect(sqlQuery).toContain('Videos.removed');
      expect(sqlQuery).toContain('COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\')) AS timeCreated');

      // Verify the JOINs
      expect(sqlQuery).toContain('LEFT JOIN');
      expect(sqlQuery).toContain('JobVideos ON Videos.id = JobVideos.video_id');
      expect(sqlQuery).toContain('Jobs ON Jobs.id = JobVideos.job_id');

      // Verify the ORDER BY clause
      expect(sqlQuery).toContain('ORDER BY');
      expect(sqlQuery).toContain('COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\')) DESC');

      // Verify the LIMIT and OFFSET
      expect(sqlQuery).toContain('LIMIT :limit OFFSET :offset');
    });

    test('should pass correct query options to sequelize', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated();

      const queryOptions = mockSequelize.query.mock.calls[1][1];

      expect(queryOptions.type).toBe(Sequelize.QueryTypes.SELECT);
      expect(queryOptions.model).toBe(mockVideo);
      expect(queryOptions.mapToModel).toBe(true);
      expect(queryOptions.raw).toBe(true);
      expect(queryOptions.replacements).toBeDefined();
      expect(queryOptions.replacements.limit).toBe(12); // default limit
      expect(queryOptions.replacements.offset).toBe(0); // default offset
    });

    test('should return empty array when no videos found', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      const result = await VideosModule.getVideosPaginated();

      expect(result.videos).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(mockSequelize.query).toHaveBeenCalledTimes(2);
    });

    test('should handle database query errors', async () => {
      const mockError = new Error('Database connection failed');
      mockSequelize.query.mockRejectedValue(mockError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('Database connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getVideosPaginated:', mockError);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });

    test('should handle sequelize-specific errors', async () => {
      const sequelizeError = new Error('SequelizeDatabaseError: Table Videos does not exist');
      mockSequelize.query.mockRejectedValue(sequelizeError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('SequelizeDatabaseError');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getVideosPaginated:', sequelizeError);
    });

    test('should handle search filter correctly', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 1 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ search: 'test video' });

      const countQuery = mockSequelize.query.mock.calls[0][0];
      const videosQuery = mockSequelize.query.mock.calls[1][0];
      const replacements = mockSequelize.query.mock.calls[1][1].replacements;

      expect(countQuery).toContain('WHERE');
      expect(countQuery).toContain('(Videos.youTubeVideoName LIKE :search OR Videos.youTubeChannelName LIKE :search)');
      expect(videosQuery).toContain('(Videos.youTubeVideoName LIKE :search OR Videos.youTubeChannelName LIKE :search)');
      expect(replacements.search).toBe('%test video%');
    });

    test('should handle pagination parameters correctly', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 100 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ page: 3, limit: 20 });

      const replacements = mockSequelize.query.mock.calls[1][1].replacements;

      expect(replacements.limit).toBe(20);
      expect(replacements.offset).toBe(40); // (page 3 - 1) * limit 20 = 40
    });

    test('should handle sort options correctly', async () => {
      // Test sort by published date ascending
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ sortBy: 'published', sortOrder: 'asc' });

      const query1 = mockSequelize.query.mock.calls[1][0];
      expect(query1).toContain('ORDER BY Videos.originalDate ASC');

      jest.clearAllMocks();

      // Test default sort (added date descending)
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated();

      const query2 = mockSequelize.query.mock.calls[1][0];
      expect(query2).toContain('ORDER BY COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\')) DESC');
    });

    test('should handle date filters correctly', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      const query = mockSequelize.query.mock.calls[0][0];
      const replacements = mockSequelize.query.mock.calls[0][1].replacements;

      expect(query).toContain('Videos.originalDate >= :dateFrom');
      expect(query).toContain('Videos.originalDate <= :dateTo');
      expect(replacements.dateFrom).toBe('20240101'); // Dates formatted without dashes
      expect(replacements.dateTo).toBe('20241231');
    });

    test('should handle channel filter correctly', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 5 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ channelFilter: 'Test Channel' });

      const query = mockSequelize.query.mock.calls[0][0];
      const replacements = mockSequelize.query.mock.calls[0][1].replacements;

      expect(query).toContain('Videos.youTubeChannelName = :channelFilter');
      expect(replacements.channelFilter).toBe('Test Channel');
    });

    test('should update file metadata when file exists', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockSequelize.query.mockResolvedValueOnce([{ total: 1 }]);
      mockSequelize.query.mockResolvedValueOnce(mockVideos);

      // Mock file exists with different size
      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      // Mock update query
      mockSequelize.query.mockResolvedValueOnce();

      const result = await VideosModule.getVideosPaginated();

      expect(mockFs.stat).toHaveBeenCalledWith('/test/output/dir/Test Channel/video [abc123].mp4');
      expect(result.videos[0].fileSize).toBe('2000');
      expect(result.videos[0].removed).toBe(false);

      // Check update query was called
      expect(mockSequelize.query).toHaveBeenCalledTimes(3);
      const updateQuery = mockSequelize.query.mock.calls[2][0];
      expect(updateQuery).toContain('UPDATE Videos SET');
    });

    test('should mark video as removed when file does not exist', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false
        }
      ];

      mockSequelize.query.mockResolvedValueOnce([{ total: 1 }]);
      mockSequelize.query.mockResolvedValueOnce(mockVideos);

      // Mock file does not exist
      mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });

      // Mock update query
      mockSequelize.query.mockResolvedValueOnce();

      const result = await VideosModule.getVideosPaginated();

      expect(result.videos[0].removed).toBe(true);

      // Check update query was called
      expect(mockSequelize.query).toHaveBeenCalledTimes(3);
      const updateQuery = mockSequelize.query.mock.calls[2][0];
      expect(updateQuery).toContain('UPDATE Videos SET');
      expect(updateQuery).toContain('removed = ?');
    });
    test('should not scan for video files when no filePath stored', async () => {
      // This behavior is intentional to avoid performance issues
      // Videos without filePath are handled by the backfill process
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: null, // No file path stored
          fileSize: null,
          removed: false
        }
      ];

      mockSequelize.query.mockResolvedValueOnce([{ total: 1 }]);
      mockSequelize.query.mockResolvedValueOnce(mockVideos);

      const result = await VideosModule.getVideosPaginated();

      // Should NOT attempt to scan directories for videos without filePath
      expect(mockFs.readdir).not.toHaveBeenCalled();
      expect(mockFs.stat).not.toHaveBeenCalled();

      // Video should be returned as-is without modification
      expect(result.videos[0].filePath).toBe(null);
      expect(result.videos[0].fileSize).toBe(null);
      expect(result.videos[0].removed).toBe(false);
    });

    test('should handle multiple WHERE conditions', async () => {
      mockSequelize.query.mockResolvedValueOnce([{ total: 0 }]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({
        search: 'test',
        channelFilter: 'Channel',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      const query = mockSequelize.query.mock.calls[0][0];
      expect(query).toContain('WHERE');
      expect(query).toContain('AND');
      expect(query.match(/AND/g)).toHaveLength(3); // 3 AND operators for 4 conditions
    });
  });

  describe('scanForVideoFiles', () => {
    test('should recursively scan directories for video files', async () => {
      // Mock directory structure
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'Channel1', isDirectory: () => true, isFile: () => false },
          { name: 'video [root123].mp4', isDirectory: () => false, isFile: () => true }
        ])
        .mockResolvedValueOnce([
          { name: 'video [channel1_123].mp4', isDirectory: () => false, isFile: () => true }
        ]);

      // First stat is for the channel subdirectory file (directory processed first)
      mockFs.stat.mockResolvedValueOnce({ size: 2000 });
      // Second stat for root video
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const { fileMap, duplicates } = await VideosModule.scanForVideoFiles('/test/dir');

      expect(fileMap.size).toBe(2);
      expect(fileMap.get('root123')).toEqual({
        filePath: '/test/dir/video [root123].mp4',
        fileSize: 1000
      });
      expect(fileMap.get('channel1_123')).toEqual({
        filePath: '/test/dir/Channel1/video [channel1_123].mp4',
        fileSize: 2000
      });
      expect(duplicates.size).toBe(0);
    });

    test('should handle duplicate files and keep larger one', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'video1 [abc123].mp4', isDirectory: () => false, isFile: () => true },
        { name: 'video2 [abc123].mp4', isDirectory: () => false, isFile: () => true }
      ]);

      mockFs.stat
        .mockResolvedValueOnce({ size: 1000 })
        .mockResolvedValueOnce({ size: 2000 });

      const { fileMap, duplicates } = await VideosModule.scanForVideoFiles('/test');

      expect(fileMap.size).toBe(1);
      expect(fileMap.get('abc123').fileSize).toBe(2000);
      expect(duplicates.size).toBe(1);
      expect(duplicates.get('abc123')).toHaveLength(2);
    });

    test('should ignore non-mp4 files', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'video [abc123].mp4', isDirectory: () => false, isFile: () => true },
        { name: 'thumbnail [abc123].jpg', isDirectory: () => false, isFile: () => true },
        { name: 'info [abc123].json', isDirectory: () => false, isFile: () => true }
      ]);

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const { fileMap } = await VideosModule.scanForVideoFiles('/test');

      expect(fileMap.size).toBe(1);
      expect(fileMap.has('abc123')).toBe(true);
      expect(mockFs.stat).toHaveBeenCalledTimes(1);
    });

    test('should handle filesystem errors gracefully', async () => {
      mockFs.readdir.mockRejectedValueOnce(new Error('Permission denied'));

      const { fileMap, duplicates } = await VideosModule.scanForVideoFiles('/restricted');

      expect(fileMap.size).toBe(0);
      expect(duplicates.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error scanning directory /restricted:',
        'Permission denied'
      );
    });
  });

  describe('backfillVideoMetadata', () => {
    test('should backfill video metadata successfully', async () => {
      // Mock file system scan
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'video [abc123].mp4', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 5000 });

      // Mock video count
      mockVideo.count.mockResolvedValueOnce(1);

      // Mock video fetch
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'abc123',
          filePath: null,
          fileSize: null,
          removed: false
        }
      ]);

      // Mock update query
      mockSequelize.query.mockResolvedValueOnce();

      const result = await VideosModule.backfillVideoMetadata();

      expect(result.processed).toBe(1);
      expect(result.filesOnDisk).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.timeElapsed).toBeDefined();
    });

    test('should respect time limit', async () => {
      // Create a long-running scenario
      // Mock readdir to take a long time (this will cause time limit to exceed during file scanning)
      mockFs.readdir.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([]), 200))
      );

      mockVideo.count.mockResolvedValueOnce(1000);
      // Don't need to mock findAll since we'll timeout during the file scan

      const result = await VideosModule.backfillVideoMetadata(100); // 100ms limit

      expect(result.timedOut).toBe(true);
      expect(result.timeElapsed).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('stopped after')
      );
    });

    test('should handle no output directory configured', async () => {
      // Remove output directory from config
      mockConfigModule.directoryPath = null;

      const result = await VideosModule.backfillVideoMetadata();

      expect(result).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No YouTube output directory configured, skipping backfill'
      );
      expect(mockFs.readdir).not.toHaveBeenCalled();
    });

    test('should mark videos as removed when files not found', async () => {
      // Mock empty filesystem
      mockFs.readdir.mockResolvedValueOnce([]);

      // Mock video count
      mockVideo.count.mockResolvedValueOnce(1);

      // Mock video with file path that doesn't exist
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'missing123',
          filePath: '/test/missing.mp4',
          fileSize: '1000',
          removed: false
        }
      ]);

      // Mock update query
      mockSequelize.query.mockResolvedValueOnce();

      const result = await VideosModule.backfillVideoMetadata();

      expect(result.removed).toBe(1);
      expect(result.updated).toBe(0);
    });

    test('should process videos in chunks', async () => {
      // Mock filesystem
      mockFs.readdir.mockResolvedValueOnce([]);

      // Mock large number of videos
      mockVideo.count.mockResolvedValueOnce(2500);

      // Mock findAll to return videos in chunks
      const chunk1 = Array(1000).fill({
        id: 1,
        youtubeId: 'test1',
        removed: true
      });
      const chunk2 = Array(1000).fill({
        id: 2,
        youtubeId: 'test2',
        removed: true
      });
      const chunk3 = Array(500).fill({
        id: 3,
        youtubeId: 'test3',
        removed: true
      });

      mockVideo.findAll
        .mockResolvedValueOnce(chunk1)
        .mockResolvedValueOnce(chunk2)
        .mockResolvedValueOnce(chunk3);

      const result = await VideosModule.backfillVideoMetadata();

      expect(mockVideo.findAll).toHaveBeenCalledTimes(3);
      expect(result.processed).toBe(2500);
    });

    test('should handle database errors during backfill', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockRejectedValueOnce(new Error('Database error'));

      await expect(VideosModule.backfillVideoMetadata()).rejects.toThrow('Database error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during video metadata backfill:',
        expect.any(Error)
      );
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

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('ETIMEDOUT');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getVideosPaginated:', timeoutError);
    });

    test('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      mockSequelize.query.mockRejectedValue(permissionError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('Permission denied');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getVideosPaginated:', permissionError);
    });

    test('should rethrow errors after logging', async () => {
      const customError = new Error('Custom error message');
      mockSequelize.query.mockRejectedValue(customError);

      try {
        await VideosModule.getVideosPaginated();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBe(customError);
        expect(error.message).toBe('Custom error message');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getVideosPaginated:', customError);
    });
  });
});