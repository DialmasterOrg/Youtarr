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
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);
    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith('existingid', ['rk1']);
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
});
