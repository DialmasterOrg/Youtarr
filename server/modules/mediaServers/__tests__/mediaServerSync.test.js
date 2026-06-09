describe('mediaServerSync', () => {
  let mediaServerSync;
  let Playlist, PlaylistVideo, PlaylistSyncState, Video;
  let serverRegistry;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn() }));
    jest.doMock('../../../models', () => ({
      Playlist: { findByPk: jest.fn() },
      PlaylistVideo: { findAll: jest.fn() },
      PlaylistSyncState: { findOne: jest.fn(), create: jest.fn() },
      Video: { findOne: jest.fn() },
    }));
    jest.doMock('../../configModule', () => ({ getConfig: () => ({}) }));
    jest.doMock('../../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    mediaServerSync = require('../mediaServerSync');
    const models = require('../../../models');
    Playlist = models.Playlist;
    PlaylistVideo = models.PlaylistVideo;
    PlaylistSyncState = models.PlaylistSyncState;
    Video = models.Video;
    serverRegistry = require('../serverRegistry');
  });

  function makeAdapter(name, impl = {}) {
    const adapter = {
      triggerLibraryScan: jest.fn(),
      resolveItemIdByFilepath: jest.fn(),
      createPlaylist: jest.fn(),
      replacePlaylistItems: jest.fn(),
      ...impl,
    };
    // Mirror BaseAdapter's default batch resolution so per-file mock
    // implementations keep working with the batch-based sync.
    if (!adapter.resolveItemIdsByFilepaths) {
      adapter.resolveItemIdsByFilepaths = jest.fn(async (filepaths) => {
        const results = new Map();
        for (const filepath of filepaths) {
          results.set(filepath, await adapter.resolveItemIdByFilepath(filepath));
        }
        return results;
      });
    }
    Object.defineProperty(adapter, 'constructor', { value: { name } });
    return adapter;
  }

  test('builds itemIds in position order, skips un-resolvable ones, and calls createPlaylist on first sync', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'My PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
      { youtube_id: 'v3', position: 3, ignored: false },
    ]);
    Video.findOne.mockImplementation(({ where }) => {
      if (where.youtubeId === 'v1') return Promise.resolve({ filePath: '/youtube/A/v1.mp4' });
      if (where.youtubeId === 'v3') return Promise.resolve({ filePath: '/youtube/C/v3.mp4' });
      return Promise.resolve(null);
    });
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn((p) => Promise.resolve(p === '/youtube/A/v1.mp4' ? 'rk1' : p === '/youtube/C/v3.mp4' ? 'rk3' : null)),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'plexplaylistid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: My PL', ['rk1', 'rk3'], { public: false });
    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
  });

  test('retries only the still-unresolved paths in later backoff rounds', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findOne.mockImplementation(({ where }) => {
      if (where.youtubeId === 'v1') return Promise.resolve({ filePath: '/youtube/A/v1.mp4' });
      if (where.youtubeId === 'v2') return Promise.resolve({ filePath: '/youtube/B/v2.mp4' });
      return Promise.resolve(null);
    });
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    // Round 1: v2 not yet indexed by the scan. Round 2: it appears.
    const batchResolve = jest.fn()
      .mockResolvedValueOnce(new Map([['/youtube/A/v1.mp4', 'rk1'], ['/youtube/B/v2.mp4', null]]))
      .mockResolvedValueOnce(new Map([['/youtube/B/v2.mp4', 'rk2']]));
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdsByFilepaths: batchResolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    // Collapse the backoff sleeps so the test runs instantly.
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
    try {
      await mediaServerSync.syncPlaylist(1);
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(batchResolve).toHaveBeenCalledTimes(2);
    expect(batchResolve).toHaveBeenNthCalledWith(1, ['/youtube/A/v1.mp4', '/youtube/B/v2.mp4']);
    expect(batchResolve).toHaveBeenNthCalledWith(2, ['/youtube/B/v2.mp4']);
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: PL', ['rk1', 'rk2'], { public: false });
  });

  test('replaces items when sync state already exists', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: true,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findOne.mockResolvedValue({ filePath: '/youtube/A/v1.mp4' });
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: updateMock });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'existingid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);
    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith(
      'existingid',
      ['rk1'],
      expect.objectContaining({ name: 'YT: PL', public: true }),
    );
    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
  });

  test('skips adapter when per-playlist sync flag is false', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: false, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findOne.mockResolvedValue({ filePath: '/a.mp4' });
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({});

    const plexAdapter = makeAdapter('PlexAdapter', { resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk') });
    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('jf1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'jf-pl' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter, jellyfinAdapter]);

    await mediaServerSync.syncPlaylist(1);
    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
    expect(jellyfinAdapter.createPlaylist).toHaveBeenCalled();
  });

  test('skips playlist creation when no items resolve yet (first-time sync, videos not downloaded)', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findOne.mockResolvedValue(null); // No videos downloaded yet
    PlaylistSyncState.findOne.mockResolvedValue(null); // No prior sync state

    const plexAdapter = makeAdapter('PlexAdapter');
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
    expect(PlaylistSyncState.create).not.toHaveBeenCalled();
  });

  test('still replaces items with empty list when sync state exists (user ignored all videos)', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([]);
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: updateMock });

    const plexAdapter = makeAdapter('PlexAdapter', {
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'existingid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith(
      'existingid',
      [],
      expect.any(Object),
    );
  });

  test('updates sync_state with new id when adapter delete-and-recreates (Jellyfin/Emby)', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: false, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findOne.mockResolvedValue({ filePath: '/youtube/v1.mp4' });
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'old-id', update: updateMock });

    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('jf1'),
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'new-id' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ server_playlist_id: 'new-id', last_error: null }),
    );
  });

  test('recovers from prior-failure state row (last_error set, no server_playlist_id) by updating in place', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findOne.mockResolvedValue({ filePath: '/a.mp4' });
    const updateMock = jest.fn();
    // Prior failure left a row with null server_playlist_id and last_error set.
    PlaylistSyncState.findOne.mockResolvedValue({
      server_playlist_id: null,
      last_error: 'Request failed with status code 500',
      update: updateMock,
    });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'newpid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: PL', ['rk1'], { public: false });
    // Must UPDATE the existing row (unique constraint would reject a duplicate create)
    expect(PlaylistSyncState.create).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      server_playlist_id: 'newpid',
      last_error: null,
    }));
  });
});
