describe('watchStatusQueries', () => {
  let watchStatusQueries;
  let configModule, Video, VideoWatchStatus, MediaServerUser;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../../configModule', () => ({ getConfig: jest.fn(() => ({})) }));
    jest.doMock('../../../models', () => ({
      Video: { findOne: jest.fn() },
      VideoWatchStatus: { findAll: jest.fn() },
      MediaServerUser: { findAll: jest.fn().mockResolvedValue([]) },
    }));

    watchStatusQueries = require('../watchStatusQueries');
    configModule = require('../../configModule');
    ({ Video, VideoWatchStatus, MediaServerUser } = require('../../../models'));
  });

  describe('getWatchedByMap', () => {
    test('returns an empty map without querying for no ids', async () => {
      await expect(watchStatusQueries.getWatchedByMap([])).resolves.toEqual(new Map());
      expect(VideoWatchStatus.findAll).not.toHaveBeenCalled();
    });

    test('dedupes server types across users', async () => {
      VideoWatchStatus.findAll.mockResolvedValue([
        { video_id: 7, server_type: 'plex' },
        { video_id: 7, server_type: 'plex' },
        { video_id: 7, server_type: 'jellyfin' },
        { video_id: 9, server_type: 'emby' },
      ]);

      const map = await watchStatusQueries.getWatchedByMap([7, 9]);

      expect(map.get(7)).toEqual(['plex', 'jellyfin']);
      expect(map.get(9)).toEqual(['emby']);
      // 'any' rule (default): no per-user filter in the where clause.
      const where = VideoWatchStatus.findAll.mock.calls[0][0].where;
      expect(where.played).toBe(true);
    });

    test('rule=primary filters to the owner and configured users', async () => {
      configModule.getConfig.mockReturnValue({
        watchStatusWatchedRule: 'primary',
        jellyfinUserId: 'JF_USER',
      });
      VideoWatchStatus.findAll.mockResolvedValue([]);

      await watchStatusQueries.getWatchedByMap([7]);

      const where = VideoWatchStatus.findAll.mock.calls[0][0].where;
      const { Op } = require('sequelize');
      expect(where[Op.or]).toEqual([
        { server_type: 'plex', server_user_id: '1' },
        { server_type: 'jellyfin', server_user_id: 'JF_USER' },
        { server_type: 'emby', server_user_id: '' },
      ]);
    });
  });

  describe('getStatusesForVideo', () => {
    test('returns empty array for an unknown video', async () => {
      Video.findOne.mockResolvedValue(null);
      await expect(watchStatusQueries.getStatusesForVideo('abc123def45')).resolves.toEqual([]);
      expect(VideoWatchStatus.findAll).not.toHaveBeenCalled();
    });

    test('maps per-user rows to the API shape with resolved user names', async () => {
      Video.findOne.mockResolvedValue({ id: 7 });
      VideoWatchStatus.findAll.mockResolvedValue([
        {
          server_type: 'plex',
          server_user_id: '1',
          played: 1,
          play_count: 2,
          percent_watched: 100,
          last_watched_at: new Date('2026-07-10T12:00:00Z'),
          last_synced_at: new Date('2026-07-16T00:00:00Z'),
        },
        {
          server_type: 'plex',
          server_user_id: '55',
          played: 1,
          play_count: 1,
          percent_watched: 100,
          last_watched_at: new Date('2026-07-12T12:00:00Z'),
          last_synced_at: new Date('2026-07-16T00:00:00Z'),
        },
      ]);
      MediaServerUser.findAll.mockResolvedValue([
        { server_type: 'plex', server_user_id: '55', server_user_name: 'kid1' },
      ]);

      const statuses = await watchStatusQueries.getStatusesForVideo('abc123def45');

      expect(statuses).toEqual([
        {
          server: 'plex',
          serverUserId: '1',
          userName: null,
          played: true,
          playCount: 2,
          percentWatched: 100,
          lastWatchedAt: new Date('2026-07-10T12:00:00Z'),
          lastSyncedAt: new Date('2026-07-16T00:00:00Z'),
        },
        {
          server: 'plex',
          serverUserId: '55',
          userName: 'kid1',
          played: true,
          playCount: 1,
          percentWatched: 100,
          lastWatchedAt: new Date('2026-07-12T12:00:00Z'),
          lastSyncedAt: new Date('2026-07-16T00:00:00Z'),
        },
      ]);
    });
  });
});
