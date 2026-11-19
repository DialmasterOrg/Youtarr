describe('mediaServerSync', () => {
  let mediaServerSync;
  let Playlist, PlaylistVideo, PlaylistSyncState, Video;
  let serverRegistry;
  let messageEmitter;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn() }));
    jest.doMock('../../../models', () => ({
      Playlist: { findByPk: jest.fn() },
      PlaylistVideo: { findAll: jest.fn() },
      PlaylistSyncState: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
      Video: { findAll: jest.fn() },
    }));
    jest.doMock('../../configModule', () => ({ getConfig: () => ({}) }));
    jest.doMock('../libraryLocator', () => ({ scopeFor: jest.fn().mockResolvedValue(null) }));
    jest.doMock('../../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../../messageEmitter', () => ({ emitMessage: jest.fn() }));

    messageEmitter = require('../../messageEmitter');
    mediaServerSync = require('../mediaServerSync');
    const models = require('../../../models');
    Playlist = models.Playlist;
    PlaylistVideo = models.PlaylistVideo;
    PlaylistSyncState = models.PlaylistSyncState;
    Video = models.Video;
    Video.findAll.mockResolvedValue([]);
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

  // Runs fn with the backoff sleeps collapsed, so a sync that never resolves
  // its files finishes instantly.
  async function withInstantBackoff(fn) {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
    try {
      await fn();
    } finally {
      setTimeoutSpy.mockRestore();
    }
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
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' },
      { youtubeId: 'v3', filePath: '/youtube/C/v3.mp4' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn((p) => Promise.resolve(p === '/youtube/A/v1.mp4' ? 'rk1' : p === '/youtube/C/v3.mp4' ? 'rk3' : null)),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'plexplaylistid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: My PL', ['rk1', 'rk3'], { public: false, mediaType: 'video' });
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
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' },
      { youtubeId: 'v2', filePath: '/youtube/B/v2.mp4' },
    ]);
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
    expect(batchResolve).toHaveBeenNthCalledWith(1, ['/youtube/A/v1.mp4', '/youtube/B/v2.mp4'], { libraryIds: null });
    expect(batchResolve).toHaveBeenNthCalledWith(2, ['/youtube/B/v2.mp4'], { libraryIds: null });
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: PL', ['rk1', 'rk2'], { public: false, mediaType: 'video' });
  });

  test('resolves Plex items only in the libraries that hold Youtarr\'s folders', async () => {
    const scope = new Set(['41']);
    require('../libraryLocator').scopeFor.mockResolvedValue(scope);
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });
    const plexResolve = jest.fn().mockResolvedValue(new Map([['/youtube/A/v1.mp4', 'rk1']]));
    const jellyfinResolve = jest.fn().mockResolvedValue(new Map([['/youtube/A/v1.mp4', 'jf1']]));
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdsByFilepaths: plexResolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      resolveItemIdsByFilepaths: jellyfinResolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'jid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter, jellyfinAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexResolve).toHaveBeenCalledWith(['/youtube/A/v1.mp4'], { libraryIds: scope });
    expect(jellyfinResolve).toHaveBeenCalledWith(['/youtube/A/v1.mp4'], { libraryIds: null });
    expect(require('../libraryLocator').scopeFor).toHaveBeenCalledTimes(1);
  });

  test('replaces items when sync state already exists', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: true,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
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
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/a.mp4' }]);
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

  test('creates no server playlist and records why when nothing is downloaded yet', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([]); // No videos downloaded yet
    PlaylistSyncState.findOne.mockResolvedValue(null); // No prior sync state

    const plexAdapter = makeAdapter('PlexAdapter');
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
    expect(PlaylistSyncState.create).toHaveBeenCalledTimes(1);
    expect(PlaylistSyncState.create).toHaveBeenCalledWith({
      playlist_id: 1,
      server_type: 'plex',
      last_error: 'No downloaded items to sync yet.',
    });
  });

  test('fetches downloaded videos in a single batched query', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/a.mp4' }]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({});
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(Video.findAll).toHaveBeenCalledTimes(1);
    expect(Video.findAll).toHaveBeenCalledWith({ where: { youtubeId: ['v1', 'v2'] } });
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
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/v1.mp4' }]);
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

  test('continues to the next adapter when recording an error itself fails', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/a.mp4' }]);
    // Call order: plex _syncToOne findAll -> plex createPlaylist throws ->
    // _recordError findOne THROWS -> jellyfin _syncToOne findAll
    PlaylistSyncState.findOne
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('db connection lost'))
      .mockResolvedValueOnce(null);
    PlaylistSyncState.create.mockResolvedValue({});

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      createPlaylist: jest.fn().mockRejectedValue(new Error('plex 500')),
    });
    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('jf1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'jf-pl' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter, jellyfinAdapter]);

    await expect(mediaServerSync.syncPlaylist(1)).resolves.toBeUndefined();
    expect(jellyfinAdapter.createPlaylist).toHaveBeenCalled();
  });

  test('aborts with one friendly warning and a concise last_error when the server is unreachable', async () => {
    const { MediaServerUnavailableError } = require('../adapters/baseAdapter');
    const logger = require('../../../logger');
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'My PL',
      sync_to_plex: false, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({});

    const resolveBatch = jest.fn().mockRejectedValue(
      new MediaServerUnavailableError({ status: 503, message: 'Request failed with status code 503' })
    );
    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      resolveItemIdsByFilepaths: resolveBatch,
      createPlaylist: jest.fn(),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

    await expect(mediaServerSync.syncPlaylist(1)).resolves.toBeUndefined();

    // Aborted on the first resolve attempt: no backoff retry rounds.
    expect(resolveBatch).toHaveBeenCalledTimes(1);
    expect(jellyfinAdapter.createPlaylist).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ serverType: 'jellyfin' }),
      expect.stringContaining('Unable to sync playlist "My PL" to Jellyfin: server not reachable or not responding')
    );
    expect(PlaylistSyncState.create).toHaveBeenCalledWith(
      expect.objectContaining({ last_error: 'Jellyfin not reachable or not responding.' })
    );
  });

  test('recovers from prior-failure state row (last_error set, no server_playlist_id) by updating in place', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/a.mp4' }]);
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

    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith('YT: PL', ['rk1'], { public: false, mediaType: 'video' });
    // Must UPDATE the existing row (unique constraint would reject a duplicate create)
    expect(PlaylistSyncState.create).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      server_playlist_id: 'newpid',
      last_error: null,
    }));
  });

  test('coalesces concurrent syncs of the same playlist into one in-flight run plus one rerun', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // Hold the first run open at its first DB read; return null so each run
    // ends right after the gate (no adapters needed for this test).
    Playlist.findByPk.mockImplementation(async () => {
      await gate;
      return null;
    });

    const first = mediaServerSync.syncPlaylist(1);
    const second = mediaServerSync.syncPlaylist(1);
    const third = mediaServerSync.syncPlaylist(1);
    expect(second).toBe(first); // joined the in-flight run
    expect(third).toBe(first);

    release();
    await Promise.all([first, second, third]);

    // One initial run + exactly ONE coalesced rerun, not one per caller.
    expect(Playlist.findByPk).toHaveBeenCalledTimes(2);
  });

  test('syncs run fresh again once the previous run finished', async () => {
    Playlist.findByPk.mockResolvedValue(null);
    await mediaServerSync.syncPlaylist(1);
    await mediaServerSync.syncPlaylist(1);
    expect(Playlist.findByPk).toHaveBeenCalledTimes(2);
  });

  test('clears the in-flight guard when a sync rejects', async () => {
    Playlist.findByPk.mockRejectedValueOnce(new Error('db down'));
    await expect(mediaServerSync.syncPlaylist(1)).rejects.toThrow('db down');
    Playlist.findByPk.mockResolvedValueOnce(null);
    await expect(mediaServerSync.syncPlaylist(1)).resolves.toBeUndefined();
    expect(Playlist.findByPk).toHaveBeenCalledTimes(2);
  });

  test('audio-only playlist syncs via audioFilePath and creates an audio playlist', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Audio PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: 'mp3_only',
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a1', position: 1, ignored: false },
      { youtube_id: 'a2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/A/a1.mp3' },
      { youtubeId: 'a2', filePath: null, audioFilePath: '/youtube/B/a2.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn((p) => Promise.resolve(p === '/youtube/A/a1.mp3' ? 'rk1' : p === '/youtube/B/a2.mp3' ? 'rk2' : null)),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith(
      'YT: Audio PL', ['rk1', 'rk2'], { public: false, mediaType: 'audio' }
    );
  });

  test('audio-only sync asks the adapter to scan audio libraries', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Audio PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: 'mp3_only',
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a1', position: 1, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/A/a1.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.triggerLibraryScan).toHaveBeenCalledWith(null, { mediaType: 'audio' });
  });

  test('video sync asks the adapter to scan with the video media type', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Video PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: null },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.triggerLibraryScan).toHaveBeenCalledWith(null, { mediaType: 'video' });
  });

  test('mixed playlist syncs only its video items, as a video playlist', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Mixed PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'a1', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: null },
      { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/B/a1.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const resolve = jest.fn((p) => Promise.resolve(p === '/youtube/A/v1.mp4' ? 'rk1' : null));
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: resolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(resolve).not.toHaveBeenCalledWith('/youtube/B/a1.mp3');
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith(
      'YT: Mixed PL', ['rk1'], { public: false, mediaType: 'video' }
    );
  });

  test('a video row with both filePath and audioFilePath syncs its video file', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'V+A PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: '/youtube/A/v1.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const resolve = jest.fn(() => Promise.resolve('rk1'));
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: resolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(resolve).toHaveBeenCalledWith('/youtube/A/v1.mp4');
    expect(resolve).not.toHaveBeenCalledWith('/youtube/A/v1.mp3');
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith(
      'YT: V+A PL', ['rk1'], { public: false, mediaType: 'video' }
    );
  });

  test('MP3 Only playlist syncs as audio using each item\'s mp3, skipping items downloaded without one', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Audio PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: 'mp3_only',
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a1', position: 1, ignored: false },
      { youtube_id: 'v1', position: 2, ignored: false },
      { youtube_id: 'b1', position: 3, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      // Normal mp3-only download.
      { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/A/a1.mp3' },
      // Manually downloaded as video-only: no mp3, so it can't join an audio playlist.
      { youtubeId: 'v1', filePath: '/youtube/V/v1.mp4', audioFilePath: null },
      // Downloaded as Video + MP3: the mp3 joins the audio playlist.
      { youtubeId: 'b1', filePath: '/youtube/B/b1.mp4', audioFilePath: '/youtube/B/b1.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const resolve = jest.fn((p) => Promise.resolve(
      p === '/youtube/A/a1.mp3' ? 'rk-a1' : p === '/youtube/B/b1.mp3' ? 'rk-b1' : null
    ));
    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: resolve,
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(resolve).not.toHaveBeenCalledWith('/youtube/V/v1.mp4');
    expect(resolve).not.toHaveBeenCalledWith('/youtube/B/b1.mp4');
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith(
      'YT: Audio PL', ['rk-a1', 'rk-b1'], { public: false, mediaType: 'audio' }
    );
  });

  test('playlist not set to MP3 Only defers rather than syncing audio-only downloads as audio', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Video PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: null,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a1', position: 1, ignored: false },
      { youtube_id: 'a2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/A/a1.mp3' },
      { youtubeId: 'a2', filePath: null, audioFilePath: '/youtube/B/a2.mp3' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);

    const plexAdapter = makeAdapter('PlexAdapter', {
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.triggerLibraryScan).toHaveBeenCalledWith(null, { mediaType: 'video' });
    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
    expect(PlaylistSyncState.create).toHaveBeenCalledWith({
      playlist_id: 1,
      server_type: 'plex',
      last_error: 'None of the downloaded items has a video file. This playlist syncs as a video playlist because its Download Type is Video Only.',
    });
  });

  test('keeps the existing server playlist when no downloads match the playlist type yet', async () => {
    // A playlist just switched to MP3 Only: its downloads are still video files.
    // The old server playlist must be left alone, not emptied or recreated.
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'Flipped PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: 'mp3_only',
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: null },
    ]);
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: updateMock });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
  });

  test('defers instead of emptying an existing server playlist when no items resolve (scan lag)', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false, audio_format: null,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: updateMock });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue(null),
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

    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
    // Only the reason is written: the server playlist id and the time of the
    // last real sync stay as they were.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      last_error: expect.stringContaining('Downloaded video files were not found on Plex.'),
    });
  });

  test('leaves out videos whose files were deleted', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'user_deleted' },
      { youtubeId: 'v2', filePath: '/youtube/B/v2.mp4', removed: false },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: jest.fn() });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn((p) => Promise.resolve(p === '/youtube/A/v1.mp4' ? 'rk1' : 'rk2')),
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'existingid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith('existingid', ['rk2'], expect.any(Object));
  });

  test('empties an existing server playlist once every downloaded file is deleted', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'auto_removal' }]);
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: jest.fn() });

    const plexAdapter = makeAdapter('PlexAdapter', {
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'existingid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith('existingid', [], expect.any(Object));
  });

  test('forgets the server playlist when emptying it leaves none on the server', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: false, sync_to_jellyfin: true, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'user_deleted' }]);
    const updateMock = jest.fn();
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: updateMock });

    const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: null }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ server_playlist_id: null, last_error: null }));
  });

  test('creates no server playlist when every downloaded file is deleted before the first sync', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'user_deleted' }]);
    PlaylistSyncState.findOne.mockResolvedValue(null);

    const plexAdapter = makeAdapter('PlexAdapter');
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.createPlaylist).not.toHaveBeenCalled();
  });

  test('keeps syncing a missing video, whose file may come back', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'not_found' }]);
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: jest.fn() });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue('rk1'),
      replacePlaylistItems: jest.fn().mockResolvedValue({ id: 'existingid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(plexAdapter.replacePlaylistItems).toHaveBeenCalledWith('existingid', ['rk1'], expect.any(Object));
  });

  test('does not empty a server playlist whose files are only missing', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
    Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', removed: true, removed_reason: 'not_found' }]);
    PlaylistSyncState.findOne.mockResolvedValue({ server_playlist_id: 'existingid', update: jest.fn() });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn().mockResolvedValue(null),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });
    try {
      await mediaServerSync.syncPlaylist(1);
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(plexAdapter.replacePlaylistItems).not.toHaveBeenCalled();
  });

  test('reversed sort order queries positions descending and syncs items in that order', async () => {
    Playlist.findByPk.mockResolvedValue({
      id: 1, playlist_id: 'PL1', title: 'PL', sort_order: 'reversed',
      sync_to_plex: true, sync_to_jellyfin: false, sync_to_emby: false,
      public_on_servers: false,
    });
    // Simulate the DESC query result: highest position first.
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v2', position: 2, ignored: false },
      { youtube_id: 'v1', position: 1, ignored: false },
    ]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' },
      { youtubeId: 'v2', filePath: '/youtube/B/v2.mp4' },
    ]);
    PlaylistSyncState.findOne.mockResolvedValue(null);
    PlaylistSyncState.create.mockResolvedValue({ id: 1 });

    const plexAdapter = makeAdapter('PlexAdapter', {
      resolveItemIdByFilepath: jest.fn((p) =>
        Promise.resolve(p === '/youtube/B/v2.mp4' ? 'rk2' : 'rk1')
      ),
      createPlaylist: jest.fn().mockResolvedValue({ id: 'pid' }),
    });
    serverRegistry.getEnabledAdapters.mockReturnValue([plexAdapter]);

    await mediaServerSync.syncPlaylist(1);

    expect(PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      order: [['position', 'DESC']],
    }));
    expect(plexAdapter.createPlaylist).toHaveBeenCalledWith(
      'YT: PL',
      ['rk2', 'rk1'],
      { public: false, mediaType: 'video' }
    );
  });

  describe('while a reorganize moves files', () => {
    test('puts the sync off and runs it when the reorganize ends', async () => {
      const lock = require('../../reorganize/reorganizeLock');
      const token = lock.acquire({ label: 'Chan' });
      Playlist.findByPk.mockResolvedValue(null);

      await mediaServerSync.syncPlaylist(5);
      expect(Playlist.findByPk).not.toHaveBeenCalled();

      lock.release(token);
      await new Promise(setImmediate);
      await new Promise(setImmediate);

      expect(Playlist.findByPk).toHaveBeenCalledWith(5);
    });

    test('reports whether any playlist sync is in flight', async () => {
      let finish;
      Playlist.findByPk.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

      const pending = mediaServerSync.syncPlaylist(5);
      await new Promise(setImmediate);
      expect(mediaServerSync.isAnySyncInFlight()).toBe(true);

      finish(null);
      await pending;
      expect(mediaServerSync.isAnySyncInFlight()).toBe(false);
    });
  });

  describe('recorded sync result', () => {
    function mockPlaylist(overrides = {}) {
      Playlist.findByPk.mockResolvedValue({
        id: 1, playlist_id: 'PL1', title: 'PL',
        sync_to_plex: false, sync_to_jellyfin: true, sync_to_emby: false,
        public_on_servers: false, audio_format: null,
        ...overrides,
      });
    }

    test('a Video + MP3 playlist whose videos the server lacks says it syncs as video', async () => {
      mockPlaylist({ audio_format: 'video_mp3' });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: '/youtube/A/v1.mp3' },
      ]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn().mockResolvedValue(null),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await withInstantBackoff(() => mediaServerSync.syncPlaylist(1));

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'Downloaded video files were not found on Jellyfin. If they were just downloaded, the server may still be scanning; otherwise check that the files still exist and that the server has a video-type library that includes your Youtarr output folder. This playlist syncs as a video playlist because its Download Type is Video + MP3.',
      });
    });

    test('a Video Only playlist whose videos the server lacks does not mention the Download Type', async () => {
      mockPlaylist();
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn().mockResolvedValue(null),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await withInstantBackoff(() => mediaServerSync.syncPlaylist(1));

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'Downloaded video files were not found on Jellyfin. If they were just downloaded, the server may still be scanning; otherwise check that the files still exist and that the server has a video-type library that includes your Youtarr output folder.',
      });
    });

    test('an MP3 Only playlist whose mp3s the server lacks asks for a music-type library', async () => {
      mockPlaylist({ audio_format: 'mp3_only' });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'a1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([
        { youtubeId: 'a1', filePath: null, audioFilePath: '/youtube/A/a1.mp3' },
      ]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn().mockResolvedValue(null),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await withInstantBackoff(() => mediaServerSync.syncPlaylist(1));

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'Downloaded MP3 files were not found on Jellyfin. If they were just downloaded, the server may still be scanning; otherwise check that the files still exist and that the server has a music-type library that includes your Youtarr output folder.',
      });
    });

    test('an MP3 Only playlist with only video downloads says it syncs as music', async () => {
      mockPlaylist({ audio_format: 'mp3_only' });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/A/v1.mp4', audioFilePath: null },
      ]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      serverRegistry.getEnabledAdapters.mockReturnValue([makeAdapter('JellyfinAdapter')]);

      await mediaServerSync.syncPlaylist(1);

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'None of the downloaded items has an MP3 file. This playlist syncs as a music playlist because its Download Type is MP3 Only.',
      });
    });

    test('the warning for an item the server lacks names its file and type', async () => {
      const logger = require('../../../logger');
      mockPlaylist({ title: 'My PL' });
      PlaylistVideo.findAll.mockResolvedValue([
        { youtube_id: 'v1', position: 1, ignored: false },
        { youtube_id: 'v2', position: 2, ignored: false },
      ]);
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/A/Found [v1].mp4' },
        { youtubeId: 'v2', filePath: '/youtube/B/Lost [v2].mp4' },
      ]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      PlaylistSyncState.create.mockResolvedValue({});
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn((p) => Promise.resolve(p.includes('Found') ? 'jf1' : null)),
        createPlaylist: jest.fn().mockResolvedValue({ id: 'jf-pl' }),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await withInstantBackoff(() => mediaServerSync.syncPlaylist(1));

      expect(logger.warn).toHaveBeenCalledWith(
        { youtube_id: 'v2', serverType: 'jellyfin', fileName: 'Lost [v2].mp4', itemType: 'Video' },
        'Unable to sync item v2 for playlist "My PL" to Jellyfin: Video file "Lost [v2].mp4" not found on server, skipping'
      );
    });

    test('an HTTP failure is recorded as a short message naming the server and status', async () => {
      mockPlaylist();
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      const httpError = Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: { status: 401 },
        config: { headers: { 'X-Emby-Token': 'secret-token' } },
      });
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn().mockResolvedValue('jf1'),
        createPlaylist: jest.fn().mockRejectedValue(httpError),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await mediaServerSync.syncPlaylist(1);

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'Jellyfin request failed (HTTP 401).',
      });
    });

    test('an HTTP failure with no response is recorded with its error code', async () => {
      mockPlaylist();
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findAll.mockResolvedValue([{ youtubeId: 'v1', filePath: '/youtube/A/v1.mp4' }]);
      PlaylistSyncState.findOne.mockResolvedValue(null);
      const httpError = Object.assign(new Error('socket hang up'), {
        isAxiosError: true,
        code: 'ECONNRESET',
      });
      const jellyfinAdapter = makeAdapter('JellyfinAdapter', {
        resolveItemIdByFilepath: jest.fn().mockResolvedValue('jf1'),
        createPlaylist: jest.fn().mockRejectedValue(httpError),
      });
      serverRegistry.getEnabledAdapters.mockReturnValue([jellyfinAdapter]);

      await mediaServerSync.syncPlaylist(1);

      expect(PlaylistSyncState.create).toHaveBeenCalledWith({
        playlist_id: 1,
        server_type: 'jellyfin',
        last_error: 'Jellyfin request failed (ECONNRESET).',
      });
    });
  });

  describe('getSyncStatus', () => {
    test('returns each server\'s last sync time and reason', async () => {
      const syncedAt = new Date('2026-11-18T10:00:00Z');
      PlaylistSyncState.findAll.mockResolvedValue([
        { server_type: 'plex', server_playlist_id: 'p1', last_synced_at: syncedAt, last_error: null },
        { server_type: 'jellyfin', server_playlist_id: null, last_synced_at: null, last_error: 'No downloaded items to sync yet.' },
      ]);

      const status = await mediaServerSync.getSyncStatus({ id: 7 });

      expect(PlaylistSyncState.findAll).toHaveBeenCalledWith({ where: { playlist_id: 7 } });
      expect(status).toEqual({
        syncing: false,
        servers: {
          plex: { last_synced_at: syncedAt, last_error: null },
          jellyfin: { last_synced_at: null, last_error: 'No downloaded items to sync yet.' },
        },
      });
    });

    test('reports syncing only while a sync of that playlist is running', async () => {
      PlaylistSyncState.findAll.mockResolvedValue([]);
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      Playlist.findByPk.mockImplementation(async () => {
        await gate;
        return null;
      });

      const run = mediaServerSync.syncPlaylist(7);
      const during = await mediaServerSync.getSyncStatus({ id: 7 });
      const otherPlaylist = await mediaServerSync.getSyncStatus({ id: 8 });
      release();
      await run;
      const after = await mediaServerSync.getSyncStatus({ id: 7 });

      expect(during.syncing).toBe(true);
      expect(otherPlaylist.syncing).toBe(false);
      expect(after.syncing).toBe(false);
    });
  });

  describe('playlistSyncUpdated broadcast', () => {
    const broadcastFor = (id) => ['broadcast', null, 'playlists', 'playlistSyncUpdated', { playlistDbId: id }];

    test('is sent when a sync starts and again when it ends', async () => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      Playlist.findByPk.mockImplementation(async () => {
        await gate;
        return null;
      });

      const run = mediaServerSync.syncPlaylist(7);
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(1);
      expect(messageEmitter.emitMessage).toHaveBeenLastCalledWith(...broadcastFor(7));

      release();
      await run;
      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(2);
      expect(messageEmitter.emitMessage).toHaveBeenLastCalledWith(...broadcastFor(7));
    });

    test('the end is sent once the sync no longer counts as running, so a refetch sees it finished', async () => {
      PlaylistSyncState.findAll.mockResolvedValue([]);
      Playlist.findByPk.mockResolvedValue(null);
      const statusAtBroadcast = [];
      messageEmitter.emitMessage.mockImplementation(() => {
        statusAtBroadcast.push(mediaServerSync.getSyncStatus({ id: 7 }));
      });

      await mediaServerSync.syncPlaylist(7);

      const [atStart, atEnd] = await Promise.all(statusAtBroadcast);
      expect(atStart.syncing).toBe(true);
      expect(atEnd.syncing).toBe(false);
    });

    test('is sent at the end of a sync that rejects', async () => {
      Playlist.findByPk.mockRejectedValue(new Error('db down'));

      await expect(mediaServerSync.syncPlaylist(7)).rejects.toThrow('db down');

      expect(messageEmitter.emitMessage).toHaveBeenCalledTimes(2);
    });

    test('a failing broadcast does not fail the sync', async () => {
      Playlist.findByPk.mockResolvedValue(null);
      messageEmitter.emitMessage.mockImplementation(() => {
        throw new Error('no socket server');
      });

      await expect(mediaServerSync.syncPlaylist(7)).resolves.toBeUndefined();
    });
  });
});
