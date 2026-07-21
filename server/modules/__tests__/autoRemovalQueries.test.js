/* eslint-env jest */

jest.mock('../../logger');

describe('autoRemovalQueries', () => {
  let autoRemovalQueries;
  let mockSequelize;
  let mockWatchStatusQueries;
  let mockLogger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSequelize = {
      query: jest.fn().mockResolvedValue([])
    };

    mockWatchStatusQueries = {
      buildWatchedEligibilitySql: jest.fn().mockReturnValue({
        sql: 'EXISTS (WATCHED_PROBE)',
        replacements: {}
      })
    };

    jest.doMock('../../db.js', () => ({
      Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
      sequelize: mockSequelize
    }));
    jest.doMock('../mediaServers/watchStatusQueries', () => mockWatchStatusQueries);

    mockLogger = require('../../logger');
    autoRemovalQueries = require('../autoRemovalQueries');
  });

  describe('getRecentVideoIds', () => {
    test('returns empty array without querying for zero, negative, or invalid counts', async () => {
      await expect(autoRemovalQueries.getRecentVideoIds(0)).resolves.toEqual([]);
      await expect(autoRemovalQueries.getRecentVideoIds(-5)).resolves.toEqual([]);
      await expect(autoRemovalQueries.getRecentVideoIds(NaN)).resolves.toEqual([]);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    test('returns the most recently downloaded video ids', async () => {
      mockSequelize.query.mockResolvedValue([{ id: 5 }, { id: 3 }, { id: 9 }]);

      const ids = await autoRemovalQueries.getRecentVideoIds(3);

      expect(ids).toEqual([5, 3, 9]);
      const [sql, options] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('Videos.removed = 0');
      expect(sql).toContain('ORDER BY timeCreated DESC');
      expect(sql).toContain('LIMIT :count');
      expect(options.replacements).toEqual({ count: 3 });
    });

    test('does not count protected videos toward the recent N', async () => {
      mockSequelize.query.mockResolvedValue([]);

      await autoRemovalQueries.getRecentVideoIds(5);

      const [sql] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('Videos.protected = 0');
    });

    test('rethrows when the query fails so callers can fail closed', async () => {
      mockSequelize.query.mockRejectedValue(new Error('db down'));

      await expect(autoRemovalQueries.getRecentVideoIds(5)).rejects.toThrow('db down');
      expect(mockLogger.error).toHaveBeenCalled();
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
      mockSequelize.query.mockResolvedValue(rows);

      const videos = await autoRemovalQueries.getWatchedRemovalCandidates();

      expect(videos).toEqual(rows);
      expect(mockWatchStatusQueries.buildWatchedEligibilitySql).toHaveBeenCalledWith({
        minDaysSinceWatched: 0
      });
      const [sql, options] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('Videos.removed = 0');
      expect(sql).toContain('Videos.protected = 0');
      expect(sql).toContain('EXISTS (WATCHED_PROBE)');
      expect(sql).not.toContain(':minVideoAgeDays');
      expect(sql).not.toContain(':excludeIds');
      expect(options.replacements).toEqual({});
    });

    test('collapses multi-job videos to one row per video id', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates();

      const [sql] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('GROUP BY Videos.id');
      expect(sql).toMatch(/MAX\(COALESCE\(/);
      expect(sql).not.toContain('DISTINCT');
    });

    test('passes minDaysSinceWatched to the eligibility probe and merges its replacements', async () => {
      mockWatchStatusQueries.buildWatchedEligibilitySql.mockReturnValue({
        sql: 'EXISTS (WATCHED_PROBE_7D)',
        replacements: { watchedMinDaysSinceWatched: 7 }
      });

      await autoRemovalQueries.getWatchedRemovalCandidates({ minDaysSinceWatched: 7 });

      expect(mockWatchStatusQueries.buildWatchedEligibilitySql).toHaveBeenCalledWith({
        minDaysSinceWatched: 7
      });
      const [sql, options] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('EXISTS (WATCHED_PROBE_7D)');
      expect(options.replacements).toEqual({ watchedMinDaysSinceWatched: 7 });
    });

    test('adds a download-age constraint on the aggregated download time when minVideoAgeDays is set', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates({ minVideoAgeDays: 30 });

      const [sql, options] = mockSequelize.query.mock.calls[0];
      expect(sql).toMatch(/HAVING timeCreated IS NOT NULL\s+AND timeCreated < DATE_SUB\(NOW\(\), INTERVAL :minVideoAgeDays DAY\)/);
      expect(options.replacements).toEqual({ minVideoAgeDays: 30 });
    });

    test('excludes the provided video ids', async () => {
      await autoRemovalQueries.getWatchedRemovalCandidates({ excludeIds: [4, 8] });

      const [sql, options] = mockSequelize.query.mock.calls[0];
      expect(sql).toContain('Videos.id NOT IN (:excludeIds)');
      expect(options.replacements).toEqual({ excludeIds: [4, 8] });
    });

    test('returns empty array when the query fails', async () => {
      mockSequelize.query.mockRejectedValue(new Error('db down'));

      await expect(autoRemovalQueries.getWatchedRemovalCandidates()).resolves.toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
