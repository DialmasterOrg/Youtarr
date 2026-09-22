/* eslint-env jest */
const { Sequelize } = require('sequelize');

describe('VideosModule', () => {
  let VideosModule;
  let mockSequelize;
  let mockVideo;
  let mockWatchStatusQueries;
  let mockFs;
  let mockConfigModule;
  let mockVideoValidationModule;
  let mockLogger;
  let mockNfoGenerator;
  let mockMessageEmitter;
  let mockM3uGenerator;
  let mockScheduledTaskRuns;
  let mockExecFile;

  beforeEach(() => {
    jest.resetModules();

    // Mock the Video model
    mockVideo = {
      count: jest.fn(),
      findAll: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn().mockResolvedValue([0]),
      findByPk: jest.fn().mockResolvedValue(null)
    };

    // Mock the Channel model
    const mockChannel = {
      findAll: jest.fn().mockResolvedValue([])
    };

    mockWatchStatusQueries = {
      getWatchedByMap: jest.fn().mockResolvedValue(new Map()),
      buildWatchedExistsSql: jest.fn().mockReturnValue({
        sql: 'EXISTS (SELECT 1 FROM video_watch_status vws WHERE vws.video_id = videos.id AND vws.played = 1)',
        replacements: {}
      })
    };

    // Mock the sequelize instance
    mockSequelize = {
      query: jest.fn(),
      dialect: {},
      col: jest.fn((name) => name),
      fn: jest.fn((...args) => ['fn', args]),
      literal: jest.fn((sql) => sql),
    };

    // Mock fs promises
    mockFs = {
      stat: jest.fn(),
      readdir: jest.fn(),
      access: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn()
    };

    // Mock configModule
    mockConfigModule = {
      directoryPath: '/test/output/dir',
      getConfig: jest.fn().mockReturnValue({}),
      updateConfig: jest.fn(),
      getJobsPath: jest.fn().mockReturnValue('/test/jobs')
    };

    mockVideoValidationModule = {
      checkVideoExistsOnYoutube: jest.fn().mockResolvedValue(true)
    };

    // Mock logger - use the mock from __mocks__/logger.js
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn()
    };

    mockNfoGenerator = {
      writeVideoNfoFile: jest.fn()
    };

    mockMessageEmitter = {
      emitMessage: jest.fn()
    };

    mockM3uGenerator = {
      regenerateAllChannelM3Us: jest.fn().mockResolvedValue({ attempted: 0, succeeded: 0 })
    };

    // Mock the database module
    jest.doMock('../../db.js', () => ({
      Sequelize,
      sequelize: mockSequelize
    }));

    // Mock the models
    jest.doMock('../../models', () => ({
      Video: mockVideo,
      Job: { _name: 'Job' },
      JobVideo: { _name: 'JobVideo' },
    }));

    // Mock the watch status query module (owns the watchedBy aggregation)
    jest.doMock('../mediaServers/watchStatusQueries', () => mockWatchStatusQueries);

    // Mock the Channel model
    jest.doMock('../../models/channel', () => mockChannel);

    // Mock fs
    jest.doMock('fs', () => ({
      promises: mockFs
    }));

    // Mock child_process for the ffprobe resolution fallback; fails by
    // default so only tests that opt in exercise the success path.
    mockExecFile = jest.fn((file, args, opts, cb) => cb(new Error('ffprobe unavailable')));
    jest.doMock('child_process', () => ({
      execFile: mockExecFile
    }));

    // Mock configModule
    jest.doMock('../configModule', () => mockConfigModule);

    jest.doMock('../videoValidationModule', () => mockVideoValidationModule);

    jest.doMock('../nfoGenerator', () => mockNfoGenerator);

    jest.doMock('../messageEmitter', () => mockMessageEmitter);

    jest.doMock('../m3uGenerator', () => mockM3uGenerator);

    mockScheduledTaskRuns = { record: jest.fn().mockResolvedValue(undefined) };
    jest.doMock('../scheduledTaskRuns', () => mockScheduledTaskRuns);

    // Mock logger
    jest.doMock('../../logger', () => mockLogger);

    // Require the module after mocks are in place
    VideosModule = require('../videosModule');
  });

  afterEach(() => {
    jest.clearAllMocks();
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
          youtube_removed: false,
          youtube_removed_checked_at: null,
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
          youtube_removed: false,
          youtube_removed_checked_at: null,
          timeCreated: new Date('2024-01-02')
        }
      ];

      // Mock count query
      mockVideo.count.mockResolvedValue(2);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockVideo.aggregate.mockResolvedValue([]);

      // Mock file stat checks for both videos
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await VideosModule.getVideosPaginated();

      expect(result).toEqual({
        channels: [],
        enabledChannels: [],
        videos: mockVideos,
        total: 2,
        page: 1,
        totalPages: 1
      });
      // Count query + videos query + getAllUniqueChannels query + no update queries needed
      expect(mockVideo.count).toHaveBeenCalledTimes(1);
      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        distinct: true,
      }));
      expect(mockVideo.findAll).toHaveBeenCalledTimes(1);
      expect(mockVideo.aggregate).toHaveBeenCalledTimes(1);
      expect(mockVideoValidationModule.checkVideoExistsOnYoutube).toHaveBeenCalledTimes(2);
      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        { youtube_removed_checked_at: expect.any(Date) },
        { where: { id: [1, 2] } }
      );
    });

    test('should execute the correct SQL query', async () => {
      const { JobVideo, Job } = require('../../models');

      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);
      mockSequelize.fn.mockImplementation((...args) => ['fn', ...args]);

      await VideosModule.getVideosPaginated();

      expect(mockVideo.findAll).toHaveBeenCalledWith({
        attributes: {
          include: [
            [
              mockSequelize.fn(
                'COALESCE',
                mockSequelize.col('Video.last_downloaded_at'),
                mockSequelize.col('jobVideos->job.time_created'),
                mockSequelize.fn('STR_TO_DATE', mockSequelize.col('Video.original_date'), '%Y%m%d'),
              ),
              'timeCreated',
            ],
          ],
        },
        include: [{
          model: JobVideo,
          as: 'jobVideos',
          attributes: [],
          include: [{
            model: Job,
            as: 'job',
            attributes: [],
          }],
        }],
        where: {},
        order: [['timeCreated', 'DESC']],
        limit: 12,
        offset: 0,
        subQuery: false,
        raw: true,
      });
    });

    test('should execute the correct SQL query for channel names', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated();

      expect(mockVideo.aggregate).toHaveBeenCalledWith('youTubeChannelName', 'distinct', expect.objectContaining({
        where: {
          youTubeChannelName: {
            [Sequelize.Op.not]: null,
          },
        },
      }));
    });

    test('should return empty array when no videos found', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      const result = await VideosModule.getVideosPaginated();

      expect(result.videos).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(mockVideo.count).toHaveBeenCalledTimes(1);
      expect(mockVideo.findAll).toHaveBeenCalledTimes(1);
      expect(mockVideo.aggregate).toHaveBeenCalledTimes(1);
    });

    test('should handle database query errors', async () => {
      const mockError = new Error('Database connection failed');
      mockVideo.count.mockRejectedValue(mockError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith({ err: mockError }, 'Error in getVideosPaginated');
      expect(mockVideo.count).toHaveBeenCalledTimes(1);
    });

    test('should handle sequelize-specific errors', async () => {
      const sequelizeError = new Error('SequelizeDatabaseError: Table videos does not exist');
      mockVideo.count.mockRejectedValue(sequelizeError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('SequelizeDatabaseError');

      expect(mockLogger.error).toHaveBeenCalledWith({ err: sequelizeError }, 'Error in getVideosPaginated');
    });

    test('should handle search filter correctly', async () => {
      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({ search: 'test video' });

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          [Sequelize.Op.and]: [{
            [Sequelize.Op.or]: [
              { youTubeVideoName: { [Sequelize.Op.like]: '%test video%' } },
              { youTubeChannelName: { [Sequelize.Op.like]: '%test video%' } },
            ],
          }],
        },
      }));
    });

    test('should handle pagination parameters correctly', async () => {
      mockVideo.count.mockResolvedValue(100);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({ page: 3, limit: 20 });

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 20,
        offset: 40, // (page 3 - 1) * limit 20 = 40
      }));
    });

    test('should handle sort options correctly', async () => {
      // Test sort by published date ascending
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({ sortBy: 'published', sortOrder: 'asc' });

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        order: [['originalDate', 'ASC']],
      }));

      jest.clearAllMocks();

      // Test default sort (added date descending)
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated();

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        order: [['timeCreated', 'DESC']],
      }));
    });

    test('should handle date filters correctly', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          originalDate: {
            // Dates formatted without dashes
            [Sequelize.Op.gte]: '20240101',
            [Sequelize.Op.lte]: '20241231'
          },
        },
      }));
    });

    test('should handle channel filter correctly', async () => {
      mockVideo.count.mockResolvedValue(5);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({ channelFilter: 'Test Channel' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          youTubeChannelName: 'Test Channel',
        },
      }));
    });

    test('should apply protectedFilter=only to the WHERE clause', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ protectedFilter: 'only' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          protected: true,
        },
      }));
    });

    test('should apply protectedFilter=exclude to the WHERE clause', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ protectedFilter: 'exclude' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          protected: false,
        },
      }));
    });

    test('should apply missingFilter=only to the WHERE clause', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ missingFilter: 'only' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          removed: true,
        },
      }));
    });

    test('should apply missingFilter=exclude to the WHERE clause', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ missingFilter: 'exclude' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          removed: false,
        },
      }));
    });

    test('should omit missingFilter from the WHERE clause by default', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated();

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          removed: undefined,
        },
      }));
    });

    test('should apply watchedFilter=only as an EXISTS clause in count and page queries', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ watchedFilter: 'only' });

      const countOptions = mockVideo.count.mock.calls[0][0];
      const pageOptions = mockVideo.findAll.mock.calls[0][0];
      expect(countOptions.where[Sequelize.Op.and][0]).toContain('EXISTS (SELECT 1 FROM video_watch_status');
      expect(countOptions.where[Sequelize.Op.and][0]).not.toContain('NOT EXISTS');
      expect(pageOptions.where[Sequelize.Op.and][0]).toContain('EXISTS (SELECT 1 FROM video_watch_status');
      expect(pageOptions.where[Sequelize.Op.and][0]).not.toContain('NOT EXISTS');
    });

    test('should apply watchedFilter=exclude as a NOT EXISTS clause', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ watchedFilter: 'exclude' });

      const countOptions = mockVideo.count.mock.calls[0][0];
      expect(countOptions.where[Sequelize.Op.and][0]).toContain('NOT EXISTS (SELECT 1 FROM video_watch_status');
    });

    test('should merge watched-rule replacements into the query replacements', async () => {
      mockWatchStatusQueries.buildWatchedExistsSql.mockReturnValue({
        sql: 'EXISTS (SELECT 1 FROM video_watch_status vws WHERE vws.video_id = videos.id AND vws.played = 1 AND vws.server_user_id = :watchedPlexOwnerId)',
        replacements: { watchedPlexOwnerId: 42 }
      });
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated({ watchedFilter: 'only' });

      expect(mockVideo.count).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          [Sequelize.Op.and]: [
            'EXISTS (SELECT 1 FROM video_watch_status vws WHERE vws.video_id = videos.id AND vws.played = 1 AND vws.server_user_id = 42)',
          ],
        },
      }));
    });

    test('should omit the watched clause by default', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValueOnce([]);

      await VideosModule.getVideosPaginated();

      const countOptions = mockVideo.count.mock.calls[0][0];
      expect(JSON.stringify(countOptions.where)).not.toContain('video_watch_status');
      expect(mockWatchStatusQueries.buildWatchedExistsSql).not.toHaveBeenCalled();
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
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        }
      ];

      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockSequelize.query.mockResolvedValueOnce(); // Update query
      mockVideo.aggregate.mockResolvedValue([]);

      // Mock file exists with different size
      mockFs.stat.mockResolvedValueOnce({ size: 2000 });

      const result = await VideosModule.getVideosPaginated();

      expect(mockFs.stat).toHaveBeenCalledWith('/test/output/dir/Test Channel/video [abc123].mp4');
      expect(result.videos[0].fileSize).toBe('2000');
      expect(result.videos[0].removed).toBe(false);

      // Check update was called
      expect(mockVideo.update).toHaveBeenCalledTimes(2);
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        1,
        { fileSize: 2000 },
        { where: { id: 1 } },
      );
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        2,
        { youtube_removed_checked_at: result.videos[0].youtube_removed_checked_at },
        { where: { id: [1] } },
      );
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
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        }
      ];

      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockSequelize.query.mockResolvedValueOnce(); // Update query
      mockVideo.aggregate.mockResolvedValue([]);

      // Mock file does not exist; fileCheckModule's same-dir fallback will
      // also try .webm/.mkv/.m4v/.avi variants, all of which must ENOENT.
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await VideosModule.getVideosPaginated();

      expect(result.videos[0].removed).toBe(true);

      // Check update was called
      expect(mockVideo.update).toHaveBeenCalledTimes(2);
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        1,
        { removed: true },
        { where: { id: 1 } },
      );
      expect(mockVideo.update).toHaveBeenNthCalledWith(
        2,
        { youtube_removed_checked_at: result.videos[0].youtube_removed_checked_at },
        { where: { id: [1] } },
      );
    });

    test('should mark video as YouTube removed when validation fails', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        }
      ];

      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockVideo.aggregate.mockResolvedValue([]);

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockVideoValidationModule.checkVideoExistsOnYoutube.mockResolvedValueOnce(false);

      const result = await VideosModule.getVideosPaginated();

      expect(mockVideoValidationModule.checkVideoExistsOnYoutube).toHaveBeenCalledWith('abc123');
      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      const [updateData, updateOptions] = mockVideo.update.mock.calls[0];
      expect(updateData.youtube_removed).toBe(true);
      expect(updateData.youtube_removed_checked_at).toBeInstanceOf(Date);
      expect(updateOptions).toEqual({ where: { id: [1] } });
      expect(result.videos[0].youtube_removed).toBe(true);
      expect(result.videos[0].youtube_removed_checked_at).toBeInstanceOf(Date);
    });

    test('should write the same checked-at timestamp it returns', async () => {
      const RealDate = Date;
      const base = RealDate.now();
      let ticks = 0;
      // Every no-argument construction lands a millisecond later, so two
      // separate new Date() calls can't agree by luck.
      global.Date = class TickingDate extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super(base + ticks++);
          } else {
            super(...args);
          }
        }
      };

      try {
        mockVideo.count.mockResolvedValue(1);
        mockVideo.findAll.mockResolvedValue([
          {
            id: 1,
            youtubeId: 'abc123',
            youTubeChannelName: 'Test Channel',
            youTubeVideoName: 'Test Video',
            filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
            fileSize: '1000',
            removed: false,
            youtube_removed: false,
            youtube_removed_checked_at: null
          }
        ]);
        mockVideo.aggregate.mockResolvedValue([]);
        mockFs.stat.mockResolvedValueOnce({ size: 1000 });
        mockVideoValidationModule.checkVideoExistsOnYoutube.mockResolvedValueOnce(true);

        const result = await VideosModule.getVideosPaginated();

        expect(mockVideo.update).toHaveBeenCalledWith(
          { youtube_removed_checked_at: result.videos[0].youtube_removed_checked_at },
          { where: { id: [1] } },
        );
      } finally {
        global.Date = RealDate;
      }
    });

    test('should skip YouTube validation when recently checked', async () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const recentIso = twentyThreeHoursAgo.toISOString();

      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: '/test/output/dir/Test Channel/video [abc123].mp4',
          fileSize: '1000',
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: recentIso
        }
      ];

      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockVideo.aggregate.mockResolvedValue([]);

      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await VideosModule.getVideosPaginated();

      expect(mockVideoValidationModule.checkVideoExistsOnYoutube).not.toHaveBeenCalled();
      expect(mockVideo.update).not.toHaveBeenCalled();
      expect(result.videos[0].youtube_removed).toBe(false);
      expect(result.videos[0].youtube_removed_checked_at).toBe(recentIso);
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
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        }
      ];

      mockVideo.count.mockResolvedValue(1);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockVideo.aggregate.mockResolvedValue([]);

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
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated({
        search: 'test',
        channelFilter: 'Channel',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      const expectedOptions = expect.objectContaining({
        where: {
          [Sequelize.Op.and]: [{
            [Sequelize.Op.or]: [
              { youTubeVideoName: { [Sequelize.Op.like]: '%test%' } },
              { youTubeChannelName: { [Sequelize.Op.like]: '%test%' } },
            ],
          }],
          youTubeChannelName: 'Channel',
          originalDate: {
            [Sequelize.Op.gte]: '20240101',
            [Sequelize.Op.lte]: '20241231'
          },
        },
      });
      expect(mockVideo.count).toHaveBeenCalledWith(expectedOptions);
      expect(mockVideo.findAll).toHaveBeenCalledWith(expectedOptions);
    });

    test('attaches watchedBy server list from video_watch_status rows', async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video',
          filePath: null,
          fileSize: null,
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        },
        {
          id: 2,
          youtubeId: 'def456',
          youTubeChannelName: 'Another Channel',
          youTubeVideoName: 'Another Video',
          filePath: null,
          fileSize: null,
          removed: false,
          youtube_removed: false,
          youtube_removed_checked_at: null
        }
      ];

      mockVideo.count.mockResolvedValue(2);
      mockVideo.findAll.mockResolvedValue(mockVideos);
      mockVideo.aggregate.mockResolvedValue([]);

      mockWatchStatusQueries.getWatchedByMap.mockResolvedValueOnce(
        new Map([[1, ['plex', 'jellyfin']]])
      );

      const result = await VideosModule.getVideosPaginated({ page: 1, limit: 12 });

      expect(mockWatchStatusQueries.getWatchedByMap).toHaveBeenCalledWith([1, 2]);
      expect(result.videos[0].watchedBy).toEqual(['plex', 'jellyfin']);
      expect(result.videos[1].watchedBy).toEqual([]);
    });

    test('passes an empty id list when the page has no videos', async () => {
      mockVideo.count.mockResolvedValue(0);
      mockVideo.findAll.mockResolvedValue([]);
      mockVideo.aggregate.mockResolvedValue([]);

      await VideosModule.getVideosPaginated();

      expect(mockWatchStatusQueries.getWatchedByMap).toHaveBeenCalledWith([]);
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
        videoFilePath: '/test/dir/video [root123].mp4',
        videoFileSize: 1000,
        audioFilePath: null,
        audioFileSize: null
      });
      expect(fileMap.get('channel1_123')).toEqual({
        videoFilePath: '/test/dir/Channel1/video [channel1_123].mp4',
        videoFileSize: 2000,
        audioFilePath: null,
        audioFileSize: null
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
      expect(fileMap.get('abc123').videoFileSize).toBe(2000);
      expect(duplicates.size).toBe(1);
      expect(duplicates.get('abc123')).toHaveLength(1); // Only one duplicate path tracked (the smaller one)
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
      const mockError = new Error('Permission denied');
      mockFs.readdir.mockRejectedValueOnce(mockError);

      const { fileMap, duplicates } = await VideosModule.scanForVideoFiles('/restricted');

      expect(fileMap.size).toBe(0);
      expect(duplicates.size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError, dir: '/restricted' },
        'Error scanning directory'
      );
    });

    test('should detect .mkv files', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'Channel - Title [vid12345abc].mkv', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 9000 });

      const { fileMap } = await VideosModule.scanForVideoFiles('/videos');

      expect(fileMap.size).toBe(1);
      expect(fileMap.get('vid12345abc')).toMatchObject({
        videoFilePath: expect.stringMatching(/\.mkv$/),
        videoFileSize: 9000
      });
    });

    test('should detect .webm, .m4v, and .avi files', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'A [aaaaaaaaaaa].webm', isDirectory: () => false, isFile: () => true },
        { name: 'B [bbbbbbbbbbb].m4v', isDirectory: () => false, isFile: () => true },
        { name: 'C [ccccccccccc].avi', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat
        .mockResolvedValueOnce({ size: 100 })
        .mockResolvedValueOnce({ size: 200 })
        .mockResolvedValueOnce({ size: 300 });

      const { fileMap } = await VideosModule.scanForVideoFiles('/videos');

      expect(fileMap.size).toBe(3);
      expect(fileMap.get('aaaaaaaaaaa').videoFilePath).toMatch(/\.webm$/);
      expect(fileMap.get('bbbbbbbbbbb').videoFilePath).toMatch(/\.m4v$/);
      expect(fileMap.get('ccccccccccc').videoFilePath).toMatch(/\.avi$/);
    });

    test('should still ignore unsupported extensions like .txt', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'note [zzzzzzzzzzz].txt', isDirectory: () => false, isFile: () => true }
      ]);

      const { fileMap } = await VideosModule.scanForVideoFiles('/videos');

      expect(fileMap.size).toBe(0);
      expect(mockFs.stat).not.toHaveBeenCalled();
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

    test('probes the file with ffprobe when video_resolution is NULL', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'Video [abc12345678].mp4', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });
      mockExecFile.mockImplementation((file, args, opts, cb) => cb(null, '1280,720\n'));

      mockVideo.count.mockResolvedValueOnce(1);
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'abc12345678',
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: '1000',
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
          video_resolution: null
        }
      ]);
      mockSequelize.query.mockResolvedValue([]);

      await VideosModule.backfillVideoMetadata();

      expect(mockExecFile).toHaveBeenCalledWith(
        'ffprobe',
        expect.arrayContaining(['/test/output/dir/Video [abc12345678].mp4']),
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function)
      );
      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        {
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: 1000,
          removed: false,
          video_resolution: '1280x720',
        },
        { where: { id: 1 } },
      );
    });

    test('preserves already-flushed probe results when the time limit trips mid-chunk', async () => {
      // Fake clock: each ffprobe costs 1s, so the 50s limit trips after the
      // first 100 probes have been flushed but before the chunk completes.
      let clock = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
      mockExecFile.mockImplementation((file, args, opts, cb) => {
        clock += 1000;
        cb(null, '1920,1080\n');
      });

      const VIDEO_COUNT = 150;
      mockFs.readdir.mockResolvedValueOnce(
        Array.from({ length: VIDEO_COUNT }, (_, i) => ({
          name: `Video [id${i}].mp4`,
          isDirectory: () => false,
          isFile: () => true
        }))
      );
      mockFs.stat.mockResolvedValue({ size: 1000 });

      mockVideo.count.mockResolvedValueOnce(VIDEO_COUNT);
      mockVideo.findAll.mockResolvedValueOnce(
        Array.from({ length: VIDEO_COUNT }, (_, i) => ({
          id: i + 1,
          youtubeId: `id${i}`,
          filePath: `/test/output/dir/Video [id${i}].mp4`,
          fileSize: '1000',
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
          video_resolution: null
        }))
      );
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideosModule.backfillVideoMetadata({ timeLimit: 50000 });
      nowSpy.mockRestore();

      expect(result.timedOut).toBe(true);
      expect(mockVideo.update).toHaveBeenCalledTimes(100);
    });

    test('runs ffprobes concurrently but never more than 4 at once', async () => {
      const VIDEO_COUNT = 20;
      mockFs.readdir.mockResolvedValueOnce(
        Array.from({ length: VIDEO_COUNT }, (_, i) => ({
          name: `Video [id${i}].mp4`,
          isDirectory: () => false,
          isFile: () => true
        }))
      );
      mockFs.stat.mockResolvedValue({ size: 1000 });

      let inFlight = 0;
      let maxInFlight = 0;
      mockExecFile.mockImplementation((file, args, opts, cb) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        setImmediate(() => {
          inFlight--;
          cb(null, '1920,1080\n');
        });
      });

      mockVideo.count.mockResolvedValueOnce(VIDEO_COUNT);
      mockVideo.findAll.mockResolvedValueOnce(
        Array.from({ length: VIDEO_COUNT }, (_, i) => ({
          id: i + 1,
          youtubeId: `id${i}`,
          filePath: `/test/output/dir/Video [id${i}].mp4`,
          fileSize: '1000',
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
          video_resolution: null
        }))
      );
      mockSequelize.query.mockResolvedValue([]);

      await VideosModule.backfillVideoMetadata();

      expect(mockExecFile).toHaveBeenCalledTimes(VIDEO_COUNT);
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBeLessThanOrEqual(4);
      expect(mockVideo.update).toHaveBeenCalledTimes(VIDEO_COUNT);
    });

    test('stamps the 0 sentinel when ffprobe fails', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'Video [abc12345678].mp4', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      mockVideo.count.mockResolvedValueOnce(1);
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'abc12345678',
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: '1000',
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
          video_resolution: null
        }
      ]);

      await VideosModule.backfillVideoMetadata();

      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        {
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: 1000,
          removed: false,
          video_resolution: '0x0',
        },
        { where: { id: 1 } },
      );
    });

    test('clears video_resolution when the video file is gone but audio remains', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'Video [abc12345678].mp3', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 500 });

      mockVideo.count.mockResolvedValueOnce(1);
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'abc12345678',
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: '1000',
          audioFilePath: '/test/output/dir/Video [abc12345678].mp3',
          audioFileSize: '500',
          removed: false,
          video_resolution: '1920x1080'
        }
      ]);

      await VideosModule.backfillVideoMetadata();

      expect(mockExecFile).not.toHaveBeenCalled();
      expect(mockVideo.update).toHaveBeenCalledTimes(1);
      expect(mockVideo.update).toHaveBeenCalledWith(
        {
          filePath: null,
          fileSize: null,
          audioFilePath: '/test/output/dir/Video [abc12345678].mp3',
          audioFileSize: 500,
          removed: false,
          video_resolution: null,
        },
        { where: { id: 1 } },
      );
    });

    test('does not probe when video_resolution is already set', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'Video [abc12345678].mp4', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      mockVideo.count.mockResolvedValueOnce(1);
      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'abc12345678',
          filePath: '/test/output/dir/Video [abc12345678].mp4',
          fileSize: '1000',
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
          video_resolution: '1920x1080'
        }
      ]);
      mockSequelize.query.mockResolvedValue([]);

      const result = await VideosModule.backfillVideoMetadata();

      expect(mockExecFile).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        { elapsed: expect.any(Number) },
        'Video metadata backfill stopped (time limit reached), will continue at next scheduled run'
      );
    });

    test('should handle no output directory configured', async () => {
      // Remove output directory from config
      mockConfigModule.directoryPath = null;

      const result = await VideosModule.backfillVideoMetadata();

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
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

    test('should clear removed flag when a previously-missing file reappears (raw row removed=1)', async () => {
      // Sequelize raw mode returns BOOLEAN columns as 0/1, not true/false.
      // This test exercises that path to ensure restoration is detected.
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'video [restored1].mp4', isDirectory: () => false, isFile: () => true }
      ]);
      mockFs.stat.mockResolvedValueOnce({ size: 1000 });

      mockVideo.count.mockResolvedValueOnce(1);

      mockVideo.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'restored1',
          filePath: '/test/output/dir/video [restored1].mp4',
          fileSize: '1000',
          removed: 1
        }
      ]);

      mockSequelize.query.mockResolvedValueOnce();

      const result = await VideosModule.backfillVideoMetadata();

      expect(result.updated).toBe(1);
      expect(result.removed).toBe(0);
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

    test('resolves with the failure and its partial counters instead of throwing', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      const mockError = new Error('Database error');
      mockVideo.count.mockRejectedValueOnce(mockError);

      await expect(VideosModule.backfillVideoMetadata()).resolves.toEqual(expect.objectContaining({
        status: 'error',
        errorMessage: 'Database error',
        processed: 0,
        updated: 0,
        removed: 0
      }));
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError },
        'Error during video metadata backfill'
      );
    });

    test('should accept options object with timeLimit and trigger', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      const result = await VideosModule.backfillVideoMetadata({ timeLimit: 1000, trigger: 'manual' });

      expect(result).toBeDefined();
      expect(result.trigger).toBe('manual');
    });

    test('should still accept legacy positional timeLimit argument', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      const result = await VideosModule.backfillVideoMetadata(100);
      expect(result).toBeDefined();
      expect(result.trigger).toBe('scheduled');
    });

    test('should return skipped result when a backfill is already in progress', async () => {
      VideosModule._backfillRunning = true;

      const result = await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(result).toEqual({ skipped: true, reason: 'already-running' });
      expect(VideosModule._backfillRunning).toBe(true);

      VideosModule._backfillRunning = false;
    });

    test('should release lock on success', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(VideosModule._backfillRunning).toBe(false);
    });

    test('kicks off a channel m3u sweep after the rescan completes', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(mockM3uGenerator.regenerateAllChannelM3Us).toHaveBeenCalledTimes(1);
    });

    test('should release lock on error', async () => {
      const error = new Error('boom');
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockRejectedValueOnce(error);

      await expect(VideosModule.backfillVideoMetadata({ trigger: 'manual' })).resolves.toMatchObject({ status: 'error' });
      expect(VideosModule._backfillRunning).toBe(false);
    });

    test('records a manual run in the task history instead of config', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(mockScheduledTaskRuns.record).toHaveBeenCalledWith(
        expect.objectContaining({
          taskKey: 'videoRescanFrequency',
          trigger: 'manual',
          status: 'success',
          outcome: 'completed',
          startedAt: expect.any(Date),
          finishedAt: expect.any(Date),
          details: expect.objectContaining({
            videosScanned: 0,
            filesFoundOnDisk: 0,
            videosUpdated: 0,
            videosMarkedMissing: 0
          })
        })
      );
      expect(mockConfigModule.updateConfig).not.toHaveBeenCalled();
    });

    test('leaves scheduled runs for the scheduler to record', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      await VideosModule.backfillVideoMetadata({ trigger: 'scheduled' });

      expect(mockScheduledTaskRuns.record).not.toHaveBeenCalled();
    });

    test('should still emit completion when run recording fails', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);
      mockScheduledTaskRuns.record.mockRejectedValue(new Error('history write failed'));

      await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(mockMessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'server',
        'rescanStatus',
        expect.objectContaining({ running: false, lastRun: expect.any(Object) })
      );
      expect(VideosModule._backfillRunning).toBe(false);
    });

    test('should release lock when no output directory and completion emit fails', async () => {
      mockConfigModule.directoryPath = '';
      mockMessageEmitter.emitMessage.mockImplementation((...args) => {
        const payload = args[4];
        if (payload?.running === false) {
          throw new Error('websocket unavailable');
        }
      });

      const result = await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(result).toBeUndefined();
      expect(VideosModule._backfillRunning).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to emit rescanStatus completion'
      );
    });

    test('should emit rescanStatus WebSocket broadcasts on start and completion', async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      mockVideo.count.mockResolvedValueOnce(0);

      await VideosModule.backfillVideoMetadata({ trigger: 'manual' });

      expect(mockMessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'server',
        'rescanStatus',
        expect.objectContaining({ running: true, trigger: 'manual' })
      );
      expect(mockMessageEmitter.emitMessage).toHaveBeenCalledWith(
        'broadcast',
        null,
        'server',
        'rescanStatus',
        expect.objectContaining({ running: false, lastRun: expect.any(Object) })
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
      mockVideo.count.mockRejectedValue(timeoutError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('ETIMEDOUT');
      expect(mockLogger.error).toHaveBeenCalledWith({ err: timeoutError }, 'Error in getVideosPaginated');
    });

    test('should handle permission errors', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      mockVideo.count.mockRejectedValue(permissionError);

      await expect(VideosModule.getVideosPaginated()).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith({ err: permissionError }, 'Error in getVideosPaginated');
    });

    test('should rethrow errors after logging', async () => {
      const customError = new Error('Custom error message');
      mockVideo.count.mockRejectedValue(customError);

      try {
        await VideosModule.getVideosPaginated();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBe(customError);
        expect(error.message).toBe('Custom error message');
      }

      expect(mockLogger.error).toHaveBeenCalledWith({ err: customError }, 'Error in getVideosPaginated');
    });
  });

  describe('setVideoProtection', () => {
    test('sets protected to true for existing video', async () => {
      const mockVideoRecord = {
        id: 1,
        protected: false,
        update: jest.fn().mockResolvedValue(),
      };
      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideosModule.setVideoProtection(1, true);

      expect(mockVideo.findByPk).toHaveBeenCalledWith(1);
      expect(mockVideoRecord.update).toHaveBeenCalledWith({ protected: true });
      expect(result).toEqual({ id: 1, protected: true });
    });

    test('sets protected to false for existing video', async () => {
      const mockVideoRecord = {
        id: 1,
        protected: true,
        update: jest.fn().mockResolvedValue(),
      };
      mockVideo.findByPk.mockResolvedValue(mockVideoRecord);

      const result = await VideosModule.setVideoProtection(1, false);

      expect(mockVideoRecord.update).toHaveBeenCalledWith({ protected: false });
      expect(result).toEqual({ id: 1, protected: false });
    });

    test('throws error when video not found', async () => {
      mockVideo.findByPk.mockResolvedValue(null);

      await expect(VideosModule.setVideoProtection(999, true)).rejects.toThrow('Video not found');
    });
  });

  describe('bulkUpdateVideoRatings', () => {
    test('clears metadata when null rating is applied and tracks missing videos', async () => {
      const existingId = 101;
      const missingId = 202;

      const videoInstance = {
        id: existingId,
        filePath: '/downloads/Channel/video [abc123].mp4',
        update: jest.fn().mockResolvedValue()
      };

      mockVideo.findByPk.mockImplementation(async (id) => (id === existingId ? videoInstance : null));
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        normalized_rating: 'PG',
        rating_source: 'Initial Source',
        fulltitle: 'Test Video'
      }));
      mockFs.writeFile.mockResolvedValue();

      const result = await VideosModule.bulkUpdateVideoRatings([existingId, missingId], null);

      expect(mockVideo.findByPk).toHaveBeenCalledWith(existingId);
      expect(mockVideo.findByPk).toHaveBeenCalledWith(missingId);
      expect(videoInstance.update).toHaveBeenCalledWith({
        normalized_rating: null,
        rating_source: 'Manual Override'
      });
      expect(result.success).toEqual([existingId]);
      expect(result.failed).toEqual([{ id: missingId, error: 'Video not found' }]);
      expect(mockFs.readFile).toHaveBeenCalledWith(expect.stringContaining('.info.json'), 'utf8');
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);

      const [, writtenData] = mockFs.writeFile.mock.calls[0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.normalized_rating).toBeNull();
      expect(parsed.rating_source).toBe('Manual Override');
      expect(mockNfoGenerator.writeVideoNfoFile).toHaveBeenCalledWith(
        videoInstance.filePath,
        expect.objectContaining({ normalized_rating: null })
      );
    });
  });

  describe('tryStartBackfill', () => {
    test('returns started: true when not running', () => {
      VideosModule._backfillRunning = false;
      const spy = jest.spyOn(VideosModule, 'backfillVideoMetadata').mockResolvedValue();
      const result = VideosModule.tryStartBackfill({ trigger: 'manual' });
      expect(result).toEqual({ started: true });
      expect(spy).toHaveBeenCalledWith({ trigger: 'manual' });
      spy.mockRestore();
    });

    test('returns started: false when already running', () => {
      VideosModule._backfillRunning = true;
      const result = VideosModule.tryStartBackfill();
      expect(result).toEqual({ started: false, reason: 'already-running' });
      VideosModule._backfillRunning = false;
    });
  });
});
