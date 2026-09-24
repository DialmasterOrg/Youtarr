/* eslint-env jest */

jest.mock('../../logger');

describe('autoRemovalQueries', () => {
  let autoRemovalQueries;
  let mockSequelize;
  let mockWatchStatusQueries;
  let mockLogger;
  let mockVideo;
  let MockSequelize;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSequelize = {
      query: jest.fn().mockResolvedValue([]),
      dialect: {},
      col: jest.fn((name) => name),
      literal: jest.fn((sql) => sql),
      fn: jest.fn((...args) => ['fn', args]),
      where: jest.fn((...args) => ['where', args]),
    };

    mockWatchStatusQueries = {
      buildWatchedEligibilitySql: jest.fn().mockReturnValue({
        sql: 'EXISTS (WATCHED_PROBE)',
        replacements: {}
      })
    };

    mockVideo = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    MockSequelize = {
      QueryTypes: { SELECT: 'SELECT' },
      Op: {
        and: Symbol('and'),
        lt: Symbol('lt'),
        not: Symbol('not'),
        notIn: Symbol('notIn'),
      },
    };
    jest.doMock('../../db.js', () => ({
      Sequelize: MockSequelize,
      sequelize: mockSequelize,
    }));
    jest.doMock('../../models', () => ({
      Video: mockVideo,
      Job: { _name: 'Job' },
      JobVideo: { _name: 'JobVideo' },
      Channel: { _name: 'Channel' },
    }));

    jest.doMock('../videosModule', () => ({
      TIME_CREATED_ATTRIBUTE: 'stuff()',
    }));
    jest.doMock('../mediaServers/watchStatusQueries', () => mockWatchStatusQueries);

    mockLogger = require('../../logger');
    autoRemovalQueries = require('../autoRemovalQueries');
  });

  describe('getBaseRemovalQueryOptions', () => {
    test('should group on video', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions();

      expect(options).toMatchObject(expect.objectContaining({
        group: mockSequelize.col('Video.id'),
      }));
    });

    test('should include only id & max(timeCreated) attributes if idOnly = true', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ idOnly: true });

      expect(options).toMatchObject(expect.objectContaining({
        attributes: [
          'id',
          [mockSequelize.fn('MAX', 'stuff()'), 'timeCreated'],
        ],
        raw: true,
      }));
    });

    test('should include youtube & file size attributes if idOnly = false', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ idOnly: false });

      expect(options).toMatchObject(expect.objectContaining({
        attributes: expect.arrayContaining([
          'youtubeId',
          'youTubeVideoName',
          'youTubeChannelName',
          [
            mockSequelize.literal('(COALESCE(Video.file_size, 0) + COALESCE(Video.audio_file_size, 0))'),
            'fileSize',
          ],
        ]),
        raw: true,
      }));
    });

    test('should join on jobs', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions();

      expect(options).toMatchObject(expect.objectContaining({
        include: expect.arrayContaining([
          {
            model: { _name: 'JobVideo' },
            as: 'jobVideos',
            attributes: [],
            include: [{
              model: { _name: 'Job' },
              as: 'job',
              attributes: [],
            }],
          },
        ]),
      }));
    });

    test('should join & filter on channels if enabled', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ joinChannel: true });

      expect(options).toMatchObject(expect.objectContaining({
        include: expect.arrayContaining([
          {
            model: { _name: 'Channel' },
            as: 'channel',
            attributes: [],
            on: {
              id: mockSequelize.col('Video.channel_id'),
              enabled: true,
            },
          },
        ]),
        where: expect.objectContaining({
          [MockSequelize.Op.and]: [
            mockSequelize.where(
              mockSequelize.fn('COALESCE', mockSequelize.col('channel.auto_removal_protected'), false),
              false,
            ),
          ],
        }),
      }));
    });

    test('should not join or filter on channels if disabled', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ joinChannel: false });

      expect(options).toMatchObject(expect.objectContaining({
        include: expect.not.arrayContaining([
          expect.objectContaining({
            model: { _name: 'Channel' },
          }),
        ]),
        where: expect.not.objectContaining({
          [MockSequelize.Op.and]: expect.arrayContaining([
            mockSequelize.where(
              mockSequelize.fn('COALESCE', mockSequelize.col('channel.auto_removal_protected'), false),
              false,
            ),
          ]),
        }),
      }));
    });

    test('should filter out provided ids', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ excludeIds: [1, 2, 3] });

      expect(options).toMatchObject(expect.objectContaining({
        where: expect.objectContaining({
          id: {
            [MockSequelize.Op.notIn]: [1, 2, 3],
          },
        }),
      }));
    });

    test('should not filter on id if none are provided', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ excludeIds: [] });

      expect(options).not.toMatchObject(expect.objectContaining({
        where: expect.objectContaining({
          id: expect.objectContaining({
            [MockSequelize.Op.notIn]: expect.anything(),
          }),
        }),
      }));
    });

    test('should order & filter on timeCreated', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions();

      expect(options).toMatchObject(expect.objectContaining({
        having: {
          timeCreated: {
            [MockSequelize.Op.not]: null,
          },
        },
        order: [['timeCreated', 'DESC']],
        subQuery: false,
      }));
    });

    test('should use provided ordering direction', async () => {
      const options = autoRemovalQueries.getBaseRemovalQueryOptions({ orderDirection: 'ASC' });

      expect(options.order).toEqual([['timeCreated', 'ASC']]);
    });
  });

  describe('getRecentVideoIds', () => {
    test('returns empty array without querying for zero, negative, or invalid counts', async () => {
      await expect(autoRemovalQueries.getRecentVideoIds(0)).resolves.toEqual([]);
      await expect(autoRemovalQueries.getRecentVideoIds(-5)).resolves.toEqual([]);
      await expect(autoRemovalQueries.getRecentVideoIds(NaN)).resolves.toEqual([]);
      expect(mockVideo.findAll).not.toHaveBeenCalled();
    });

    test('returns the most recently downloaded video ids', async () => {
      mockVideo.findAll.mockResolvedValue([{ id: 5 }, { id: 3 }, { id: 9 }]);

      const ids = await autoRemovalQueries.getRecentVideoIds(3);

      expect(ids).toEqual([5, 3, 9]);
      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          removed: false,
        }),
        order: [['timeCreated', 'DESC']],
        limit: 3,
        subQuery: false,
      }));
    });

    test('does not count protected videos toward the recent N', async () => {
      await autoRemovalQueries.getRecentVideoIds(5);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          protected: false,
        }),
      }));
    });

    test('rethrows when the query fails so callers can fail closed', async () => {
      mockVideo.findAll.mockRejectedValue(new Error('db down'));

      await expect(autoRemovalQueries.getRecentVideoIds(5)).rejects.toThrow('db down');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('excludes videos of fully protected enabled channels from the recent N', async () => {
      await autoRemovalQueries.getRecentVideoIds(5);

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          [MockSequelize.Op.and]: [
            mockSequelize.where(
              mockSequelize.fn('COALESCE', mockSequelize.col('channel.auto_removal_protected'), false),
              false,
            ),
          ],
        }),
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'channel',
            on: {
              id: mockSequelize.col('Video.channel_id'),
              enabled: true,
            },
          }),
        ]),
      }));
    });
  });

  describe('getWatchedRemovalCandidates', () => {
    test('selects non-removed, non-protected videos matching the watched probe', async () => {
      const rows = [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeVideoName: 'Watched Video',
          youTubeChannelName: 'Channel',
          fileSize: '1000',
          timeCreated: new Date('2026-01-01')
        }
      ];
      mockVideo.findAll.mockResolvedValue(rows);

      const videos = await autoRemovalQueries.getWatchedRemovalCandidates();

      expect(videos).toEqual(rows);
      expect(mockWatchStatusQueries.buildWatchedEligibilitySql).toHaveBeenCalledWith({
        minDaysSinceWatched: 0,
        videosName: 'Video',
      });
      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          removed: false,
          protected: false,
          [MockSequelize.Op.and]: expect.arrayContaining([
            'EXISTS (WATCHED_PROBE)'
          ]),
        }),
      }));
      expect(mockVideo.findAll).not.toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: expect.anything(),
        }),
      }));
      expect(mockVideo.findAll).not.toHaveBeenCalledWith(expect.objectContaining({
        having: expect.objectContaining({
          timeCreated: expect.objectContaining({
            [MockSequelize.Op.lt]: expect.anything(),
          }),
        }),
      }));
    });

    test('collapses multi-job videos to one row per video id', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates();

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        attributes: expect.arrayContaining([
          [mockSequelize.fn('MAX', 'stuff()'), 'timeCreated'],
        ]),
        group: 'Video.id',
      }));
      expect(mockVideo.findAll).not.toHaveBeenCalledWith(expect.objectContaining({
        distinct: true,
      }));
    });

    test('passes minDaysSinceWatched to the eligibility probe and merges its replacements', async () => {
      mockWatchStatusQueries.buildWatchedEligibilitySql.mockReturnValue({
        sql: 'EXISTS (SELECT :watchedMinDaysSinceWatched)',
        replacements: { watchedMinDaysSinceWatched: 7 }
      });

      await autoRemovalQueries.getWatchedRemovalCandidates({ minDaysSinceWatched: 7 });

      expect(mockWatchStatusQueries.buildWatchedEligibilitySql).toHaveBeenCalledWith({
        minDaysSinceWatched: 7,
        videosName: 'Video',
      });
      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          [MockSequelize.Op.and]: expect.arrayContaining([
            'EXISTS (SELECT 7)'
          ]),
        }),
      }));
    });

    test('adds a download-age constraint on the aggregated download time when minVideoAgeDays is set', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates({ minVideoAgeDays: 30 });

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        having: expect.objectContaining({
          timeCreated: {
            [MockSequelize.Op.not]: null,
            [MockSequelize.Op.lt]: mockSequelize.fn(
              'DATE_SUB',
              mockSequelize.fn('NOW'),
              mockSequelize.literal('INTERVAL 30 DAY'),
            ),
          },
        }),
      }));
    });

    test('excludes the provided video ids', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates({ excludeIds: [4, 8] });

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: {
            [MockSequelize.Op.notIn]: [4, 8],
          },
        }),
      }));
    });

    test('returns empty array when the query fails', async () => {
      mockVideo.findAll.mockRejectedValue(new Error('db down'));

      await expect(autoRemovalQueries.getWatchedRemovalCandidates()).resolves.toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('excludes videos of fully protected enabled channels', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates();

      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'channel',
            on: {
              id: mockSequelize.col('Video.channel_id'),
              enabled: true,
            },
          }),
        ]),
        where: expect.objectContaining({
          [MockSequelize.Op.and]: expect.arrayContaining([
            mockSequelize.where(
              mockSequelize.fn('COALESCE', mockSequelize.col('channel.auto_removal_protected'), false),
              false,
            ),
          ]),
        }),
      }));
    });
  });

  describe('getChannelKeepRecentIds', () => {
    test('returns zero channels and no ids when no channel sets a keep-recent count', async () => {
      const result = await autoRemovalQueries.getChannelKeepRecentIds();

      expect(result).toEqual({ channelCount: 0, ids: [] });
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      const [sql] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('auto_removal_keep_recent_count > 0');
      expect(sql).toContain('auto_removal_protected = 0');
      expect(sql).toContain('enabled = 1');
      expect(sql).toContain('channel_id IS NOT NULL');
    });

    test('queries each configured channel and merges the returned ids', async () => {
      mockSequelize.query
        .mockResolvedValue([
          { channel_id: 'UC-aaa', keepCount: 2 },
          { channel_id: 'UC-bbb', keepCount: 1 }
        ]);
      mockVideo.findAll
        .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
        .mockResolvedValueOnce([{ id: 20 }]);

      const result = await autoRemovalQueries.getChannelKeepRecentIds();

      expect(result).toEqual({ channelCount: 2, ids: [10, 11, 20] });
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      expect(mockVideo.findAll).toHaveBeenCalledTimes(2);
      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          protected: false,
          channel_id: 'UC-aaa',
        }),
        order: [['timeCreated', 'DESC']],
        limit: 2,
        subQuery: false,
      }));
      expect(mockVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ channel_id: 'UC-bbb' }),
        limit: 1,
      }));
    });

    test('rethrows when a query fails so callers can fail closed', async () => {
      mockSequelize.query.mockRejectedValue(new Error('db down'));

      await expect(autoRemovalQueries.getChannelKeepRecentIds()).rejects.toThrow('db down');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
