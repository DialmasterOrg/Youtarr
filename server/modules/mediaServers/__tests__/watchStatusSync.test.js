// Minimal fake adapters; the orchestrator keys server type off the adapter's
// serverType property (the BaseAdapter contract), never off class names.
const fakeAdapter = (serverType, fetchWatchStates) => ({ serverType, fetchWatchStates });

describe('watchStatusSync', () => {
  let watchStatusSync;
  let serverRegistry, configModule, logger, Video, VideoWatchStatus;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../../configModule', () => ({ getConfig: jest.fn(() => ({})) }));
    jest.doMock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn() }));
    jest.doMock('../../../models', () => ({
      Video: { findAll: jest.fn(), findOne: jest.fn() },
      VideoWatchStatus: { bulkCreate: jest.fn().mockResolvedValue([]), findAll: jest.fn() },
    }));

    watchStatusSync = require('../watchStatusSync');
    serverRegistry = require('../serverRegistry');
    configModule = require('../../configModule');
    logger = require('../../../logger');
    ({ Video, VideoWatchStatus } = require('../../../models'));

    configModule.getConfig.mockReturnValue({ jellyfinUserId: 'JF_USER' });
  });

  test('skips when no media servers are configured', async () => {
    serverRegistry.getEnabledAdapters.mockReturnValue([]);
    const summary = await watchStatusSync.syncAll('manual');
    expect(summary.skipped).toBeDefined();
    expect(Video.findAll).not.toHaveBeenCalled();
  });

  test('matches server entries to videos by basename and upserts rows', async () => {
    const adapter = fakeAdapter('plex', jest.fn().mockResolvedValue([
      {
        path: 'Q:\\Media\\Chan\\Video A [id1].mp4',
        played: true, playCount: 1, positionMs: null, percentWatched: 100,
        lastWatchedAt: new Date('2026-07-10T12:00:00Z'),
      },
      {
        path: '/mnt/other/Unrelated [zz9].mp4',
        played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null,
      },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([
      { id: 7, filePath: '/usr/src/app/data/Chan/Video A [id1]/Video A [id1].mp4' },
      { id: 8, filePath: '/usr/src/app/data/Chan/Video B [id2]/Video B [id2].mp4' },
    ]);

    const summary = await watchStatusSync.syncAll();

    expect(summary.servers.plex).toEqual({ updated: 1 });
    expect(VideoWatchStatus.bulkCreate).toHaveBeenCalledTimes(1);
    const [rows, options] = VideoWatchStatus.bulkCreate.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      video_id: 7,
      server_type: 'plex',
      server_user_id: null,
      played: true,
      play_count: 1,
      percent_watched: 100,
    });
    expect(options.updateOnDuplicate).toEqual(
      expect.arrayContaining(['played', 'play_count', 'position_ms', 'percent_watched', 'last_watched_at', 'last_synced_at'])
    );
  });

  test('records the configured user id for jellyfin rows', async () => {
    const adapter = fakeAdapter('jellyfin', jest.fn().mockResolvedValue([
      { path: '/media/Chan/Video A [id1].mp4', played: false, playCount: 0, positionMs: 5000, percentWatched: 1, lastWatchedAt: null },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Chan/Video A [id1].mp4' }]);

    await watchStatusSync.syncAll();

    const [rows] = VideoWatchStatus.bulkCreate.mock.calls[0];
    expect(rows[0].server_user_id).toBe('JF_USER');
    expect(rows[0].server_type).toBe('jellyfin');
  });

  test('records the configured user id for emby rows', async () => {
    configModule.getConfig.mockReturnValue({ embyUserId: 'EMBY_USER' });
    const adapter = fakeAdapter('emby', jest.fn().mockResolvedValue([
      { path: '/media/Chan/Video A [id1].mp4', played: true, playCount: 2, positionMs: null, percentWatched: 100, lastWatchedAt: null },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Chan/Video A [id1].mp4' }]);

    const summary = await watchStatusSync.syncAll();

    expect(summary.servers.emby).toEqual({ updated: 1 });
    const [rows] = VideoWatchStatus.bulkCreate.mock.calls[0];
    expect(rows[0].server_user_id).toBe('EMBY_USER');
    expect(rows[0].server_type).toBe('emby');
  });

  test('one failing server does not abort the others and is reported in the summary', async () => {
    const bad = fakeAdapter('plex', jest.fn().mockRejectedValue(new Error('boom')));
    const good = fakeAdapter('jellyfin', jest.fn().mockResolvedValue([]));
    serverRegistry.getEnabledAdapters.mockReturnValue([bad, good]);
    Video.findAll.mockResolvedValue([]);

    const summary = await watchStatusSync.syncAll();

    // Unexpected internal errors are genericized, never rendered verbatim.
    expect(summary.servers.plex).toEqual({ error: 'internal error during sync; check Youtarr logs' });
    expect(summary.servers.jellyfin).toEqual({ updated: 0 });
    expect(VideoWatchStatus.bulkCreate).not.toHaveBeenCalled();
  });

  test('sanitizes summary error messages by failure type', async () => {
    const { MediaServerUnavailableError, WatchStateFetchError } = require('../adapters/baseAdapter');
    const axiosErr = new Error('Request failed with status code 401');
    axiosErr.isAxiosError = true;
    axiosErr.response = { status: 401 };
    // Real axios errors carry the request config, including auth material.
    axiosErr.config = {
      headers: { 'X-Emby-Token': 'EMBY_SECRET' },
      params: { 'X-Plex-Token': 'PLEX_SECRET' },
    };

    const unavailable = fakeAdapter('plex', jest.fn().mockRejectedValue(
      new MediaServerUnavailableError({ message: 'connect ECONNREFUSED 10.0.0.5:32400' })
    ));
    const presentable = fakeAdapter('jellyfin', jest.fn().mockRejectedValue(
      new WatchStateFetchError('could not list any Plex library section (HTTP 401)')
    ));
    const http = fakeAdapter('emby', jest.fn().mockRejectedValue(axiosErr));
    serverRegistry.getEnabledAdapters.mockReturnValue([unavailable, presentable, http]);
    Video.findAll.mockResolvedValue([]);

    const summary = await watchStatusSync.syncAll();

    expect(summary.servers.plex).toEqual({ error: 'server not reachable or not responding' });
    expect(summary.servers.jellyfin).toEqual({ error: 'could not list any Plex library section (HTTP 401)' });
    expect(summary.servers.emby).toEqual({ error: 'request failed (HTTP 401)' });

    // The raw axios error must never be logged: its config carries API
    // tokens, and the logger's redaction paths don't cover err.config.*.
    // Only the compact describeHttpError shape may appear.
    const loggedWarns = JSON.stringify(logger.warn.mock.calls);
    expect(loggedWarns).not.toContain('EMBY_SECRET');
    expect(loggedWarns).not.toContain('PLEX_SECRET');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        serverType: 'emby',
        err: expect.objectContaining({ status: 401 }),
      }),
      'Watch status sync failed for server'
    );
  });

  test('getStatus reflects the last run and running=false after completion', async () => {
    serverRegistry.getEnabledAdapters.mockReturnValue([]);
    await watchStatusSync.syncAll('manual');
    const status = watchStatusSync.getStatus();
    expect(status.running).toBe(false);
    expect(status.lastRun.trigger).toBe('manual');
  });

  describe('getStatusesForVideo', () => {
    test('returns empty array for an unknown video', async () => {
      Video.findOne.mockResolvedValue(null);
      await expect(watchStatusSync.getStatusesForVideo('abc123def45')).resolves.toEqual([]);
      expect(VideoWatchStatus.findAll).not.toHaveBeenCalled();
    });

    test('maps rows to the API shape ordered by server type', async () => {
      Video.findOne.mockResolvedValue({ id: 7 });
      VideoWatchStatus.findAll.mockResolvedValue([
        {
          server_type: 'plex',
          played: 1,
          play_count: 2,
          percent_watched: 100,
          last_watched_at: new Date('2026-07-10T12:00:00Z'),
          last_synced_at: new Date('2026-07-16T00:00:00Z'),
        },
      ]);

      const statuses = await watchStatusSync.getStatusesForVideo('abc123def45');

      expect(VideoWatchStatus.findAll).toHaveBeenCalledWith({
        where: { video_id: 7 },
        order: [['server_type', 'ASC']],
      });
      expect(statuses).toEqual([
        {
          server: 'plex',
          played: true,
          playCount: 2,
          percentWatched: 100,
          lastWatchedAt: new Date('2026-07-10T12:00:00Z'),
          lastSyncedAt: new Date('2026-07-16T00:00:00Z'),
        },
      ]);
    });
  });
});
