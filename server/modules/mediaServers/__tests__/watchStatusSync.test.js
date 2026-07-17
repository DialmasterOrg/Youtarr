// Minimal fake adapters; the orchestrator keys server type off the adapter's
// serverType property (the BaseAdapter contract), never off class names.
// fetchWatchStates resolves the adapter contract shape { entries, users }.
const fakeAdapter = (serverType, fetchWatchStates) => ({ serverType, fetchWatchStates });
const resolvedFetch = (entries, users = []) => jest.fn().mockResolvedValue({ entries, users });

describe('watchStatusSync', () => {
  let watchStatusSync;
  let serverRegistry, configModule, logger, Video, VideoWatchStatus, MediaServerUser, WatchStatusSyncCursor;

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
      VideoWatchStatus: {
        bulkCreate: jest.fn().mockResolvedValue([]),
        findAll: jest.fn(),
      },
      MediaServerUser: { bulkCreate: jest.fn().mockResolvedValue([]), findAll: jest.fn().mockResolvedValue([]) },
      WatchStatusSyncCursor: {
        findOne: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue([]),
      },
    }));

    watchStatusSync = require('../watchStatusSync');
    serverRegistry = require('../serverRegistry');
    configModule = require('../../configModule');
    logger = require('../../../logger');
    ({ Video, VideoWatchStatus, MediaServerUser, WatchStatusSyncCursor } = require('../../../models'));

    configModule.getConfig.mockReturnValue({ jellyfinUserId: 'JF_USER' });
  });

  test('skips when no media servers are configured', async () => {
    serverRegistry.getEnabledAdapters.mockReturnValue([]);
    const summary = await watchStatusSync.syncAll('manual');
    expect(summary.skipped).toBeDefined();
    expect(Video.findAll).not.toHaveBeenCalled();
  });

  test('matches server entries to videos by basename and upserts rows', async () => {
    const adapter = fakeAdapter('plex', resolvedFetch([
      {
        path: 'Q:\\Media\\Chan\\Video A [id1].mp4',
        serverUserId: '1',
        played: true, playCount: 1, positionMs: null, percentWatched: 100,
        lastWatchedAt: new Date('2026-07-10T12:00:00Z'),
      },
      {
        path: '/mnt/other/Unrelated [zz9].mp4',
        serverUserId: '1',
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
      server_user_id: '1',
      played: true,
      play_count: 1,
      percent_watched: 100,
    });
    expect(options.updateOnDuplicate).toEqual(
      expect.arrayContaining(['played', 'play_count', 'position_ms', 'percent_watched', 'last_watched_at', 'last_synced_at'])
    );
  });

  test('persists one row per user for the same video and server', async () => {
    const adapter = fakeAdapter('jellyfin', resolvedFetch([
      { path: '/media/Chan/Video A [id1].mp4', serverUserId: 'u1', played: true, playCount: 2, positionMs: null, percentWatched: 100, lastWatchedAt: null },
      { path: '/media/Chan/Video A [id1].mp4', serverUserId: 'u2', played: false, playCount: 0, positionMs: 5000, percentWatched: 1, lastWatchedAt: null },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Chan/Video A [id1].mp4' }]);

    const summary = await watchStatusSync.syncAll();

    // `updated` counts distinct videos, not (video, user) rows.
    expect(summary.servers.jellyfin).toEqual({ updated: 1 });
    const [rows] = VideoWatchStatus.bulkCreate.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.server_user_id).sort()).toEqual(['u1', 'u2']);
    expect(rows.every((r) => r.video_id === 7 && r.server_type === 'jellyfin')).toBe(true);
  });

  test('matches every user entry of the best-scoring path, not just one', async () => {
    // Same basename in two paths; only the better-matching path's users count.
    const adapter = fakeAdapter('jellyfin', resolvedFetch([
      { path: '/media/Chan/Video A [id1].mp4', serverUserId: 'u1', played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null },
      { path: '/media/Chan/Video A [id1].mp4', serverUserId: 'u2', played: false, playCount: 0, positionMs: null, percentWatched: null, lastWatchedAt: null },
      { path: '/stale/Other/Video A [id1].mp4', serverUserId: 'u3', played: true, playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Chan/Video A [id1].mp4' }]);

    await watchStatusSync.syncAll();

    const [rows] = VideoWatchStatus.bulkCreate.mock.calls[0];
    expect(rows.map((r) => r.server_user_id).sort()).toEqual(['u1', 'u2']);
  });

  test('upserts the media server user directory from the adapter user list', async () => {
    const adapter = fakeAdapter('emby', resolvedFetch([], [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: null },
    ]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([]);

    await watchStatusSync.syncAll();

    expect(MediaServerUser.bulkCreate).toHaveBeenCalledWith(
      [
        { server_type: 'emby', server_user_id: 'u1', server_user_name: 'Alice' },
        { server_type: 'emby', server_user_id: 'u2', server_user_name: null },
      ],
      { updateOnDuplicate: ['server_user_name', 'updatedAt'] }
    );
  });

  test('does not touch the user directory when the adapter reports no users', async () => {
    const adapter = fakeAdapter('jellyfin', resolvedFetch([]));
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([]);

    await watchStatusSync.syncAll();

    expect(MediaServerUser.bulkCreate).not.toHaveBeenCalled();
  });

  test('passes the stored cursor and known plex accounts to the plex adapter', async () => {
    const stored = new Date('2026-07-17T10:00:00Z');
    WatchStatusSyncCursor.findOne.mockResolvedValue({ cursor: stored });
    MediaServerUser.findAll.mockResolvedValue([{ server_user_id: '55' }]);
    const plex = fakeAdapter('plex', resolvedFetch([]));
    const jellyfin = fakeAdapter('jellyfin', resolvedFetch([]));
    serverRegistry.getEnabledAdapters.mockReturnValue([plex, jellyfin]);
    Video.findAll.mockResolvedValue([]);

    await watchStatusSync.syncAll();

    // Pulled back 60s so a boundary event is never missed.
    expect(plex.fetchWatchStates).toHaveBeenCalledWith({
      since: new Date(stored.getTime() - 60_000),
      knownUserIds: ['55'],
    });
    expect(jellyfin.fetchWatchStates).toHaveBeenCalledWith({});
  });

  test('persists the history cursor the adapter reports after rows are written', async () => {
    const cursor = new Date('2026-07-17T11:00:00Z');
    const plex = fakeAdapter('plex', jest.fn().mockResolvedValue({
      entries: [], users: [], historyCursor: cursor,
    }));
    serverRegistry.getEnabledAdapters.mockReturnValue([plex]);
    Video.findAll.mockResolvedValue([]);

    await watchStatusSync.syncAll();

    expect(WatchStatusSyncCursor.upsert).toHaveBeenCalledWith({ server_type: 'plex', cursor });
  });

  test('does not advance the cursor when the adapter reports none', async () => {
    const plex = fakeAdapter('plex', resolvedFetch([]));
    serverRegistry.getEnabledAdapters.mockReturnValue([plex]);
    Video.findAll.mockResolvedValue([]);

    await watchStatusSync.syncAll();

    expect(WatchStatusSyncCursor.upsert).not.toHaveBeenCalled();
  });

  test('does not store new accounts when persisting their rows fails', async () => {
    // If the account were stored despite the failed persist, the next sync
    // would treat it as known and its backfill window would be lost forever.
    VideoWatchStatus.bulkCreate.mockRejectedValueOnce(new Error('db down'));
    const plex = fakeAdapter('plex', jest.fn().mockResolvedValue({
      entries: [{
        path: '/m/Video A [id1].mp4', serverUserId: '55', played: true,
        playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null,
      }],
      users: [{ id: '55', name: 'kid1' }],
      historyCursor: new Date('2026-07-17T11:00:00Z'),
    }));
    serverRegistry.getEnabledAdapters.mockReturnValue([plex]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Video A [id1].mp4' }]);

    const summary = await watchStatusSync.syncAll();

    expect(summary.servers.plex.error).toBeDefined();
    expect(MediaServerUser.bulkCreate).not.toHaveBeenCalled();
    expect(WatchStatusSyncCursor.upsert).not.toHaveBeenCalled();
  });

  test('stores accounts only after rows and the cursor are written', async () => {
    const plex = fakeAdapter('plex', jest.fn().mockResolvedValue({
      entries: [{
        path: '/m/Video A [id1].mp4', serverUserId: '55', played: true,
        playCount: 1, positionMs: null, percentWatched: 100, lastWatchedAt: null,
      }],
      users: [{ id: '55', name: 'kid1' }],
      historyCursor: new Date('2026-07-17T11:00:00Z'),
    }));
    serverRegistry.getEnabledAdapters.mockReturnValue([plex]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: '/data/Video A [id1].mp4' }]);

    await watchStatusSync.syncAll();

    const persistedAt = VideoWatchStatus.bulkCreate.mock.invocationCallOrder[0];
    const cursorAt = WatchStatusSyncCursor.upsert.mock.invocationCallOrder[0];
    const usersAt = MediaServerUser.bulkCreate.mock.invocationCallOrder[0];
    expect(persistedAt).toBeLessThan(cursorAt);
    expect(cursorAt).toBeLessThan(usersAt);
  });

  test('one failing server does not abort the others and is reported in the summary', async () => {
    const bad = fakeAdapter('plex', jest.fn().mockRejectedValue(new Error('boom')));
    const good = fakeAdapter('jellyfin', resolvedFetch([]));
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

});
