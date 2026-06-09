jest.mock('axios');
jest.mock('../../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../../plexModule', () => ({
  refreshLibrariesForSubfolders: jest.fn(),
}));

const axios = require('axios');
const PlexAdapter = require('../plexAdapter');

describe('PlexAdapter', () => {
  const cfg = {
    plexUrl: 'http://plex:32400',
    plexApiKey: 'TOKEN',
    plexYoutubeLibraryId: '2',
  };

  beforeEach(() => jest.clearAllMocks());

  test('resolveItemIdByFilepath returns ratingKey on match', async () => {
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '42', Media: [{ Part: [{ file: '/youtube/X/v1.mp4' }] }] }] } },
    });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/X/v1.mp4');
    expect(id).toBe('42');
  });

  test('resolveItemIdByFilepath returns null on no match', async () => {
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/X/nope.mp4');
    expect(id).toBeNull();
  });

  test('resolveItemIdByFilepath matches by basename across different mount prefixes', async () => {
    // Youtarr sees /usr/src/app/data/...; Plex sees /mnt/media/youtube/...
    // Same file, same basename. Must still resolve.
    axios.get.mockResolvedValueOnce({
      data: {
        MediaContainer: {
          Metadata: [
            { ratingKey: '99', Media: [{ Part: [{ file: '/mnt/media/youtube/Creator/Video Title [abc123].mp4' }] }] },
          ],
        },
      },
    });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath(
      '/usr/src/app/data/Creator/Video Title [abc123] - abc123/Video Title [abc123].mp4'
    );
    expect(id).toBe('99');
  });

  test('resolveItemIdByFilepath matches Windows-style paths from Plex running on Windows', async () => {
    // Plex on Windows reports file with backslashes; Youtarr in a Linux container sees forward slashes.
    axios.get.mockResolvedValueOnce({
      data: {
        MediaContainer: {
          Metadata: [
            { ratingKey: '77', Media: [{ Part: [{ file: 'Q:\\Youtube_test\\__Default\\Creator\\Video Title [abc123].mp4' }] }] },
          ],
        },
      },
    });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath(
      '/usr/src/app/data/__Default/Creator/Video Title [abc123] - abc123/Video Title [abc123].mp4'
    );
    expect(id).toBe('77');
  });

  test('resolveItemIdByFilepath works symmetrically — Linux Plex with Windows Youtarr path', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        MediaContainer: {
          Metadata: [
            { ratingKey: '55', Media: [{ Part: [{ file: '/mnt/media/Creator/Video Title [xyz789].mp4' }] }] },
          ],
        },
      },
    });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath(
      'C:\\Youtube\\Creator\\Video Title [xyz789].mp4'
    );
    expect(id).toBe('55');
  });

  describe('plexPlaylistToken override', () => {
    test('uses plexApiKey by default (no override set)', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.resolveItemIdByFilepath('/path/v1.mp4');
      const params = axios.get.mock.calls[0][1].params;
      expect(params['X-Plex-Token']).toBe('TOKEN');
    });

    test('uses plexApiKey when plexPlaylistToken is null', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: null });
      await adapter.resolveItemIdByFilepath('/path/v1.mp4');
      const params = axios.get.mock.calls[0][1].params;
      expect(params['X-Plex-Token']).toBe('TOKEN');
    });

    test('uses plexApiKey when plexPlaylistToken is empty string (treated as unset)', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: '' });
      await adapter.resolveItemIdByFilepath('/path/v1.mp4');
      const params = axios.get.mock.calls[0][1].params;
      expect(params['X-Plex-Token']).toBe('TOKEN');
    });

    test('uses override token when plexPlaylistToken is a non-empty, non-sentinel string', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'USER-TOKEN' });
      await adapter.resolveItemIdByFilepath('/path/v1.mp4');
      const params = axios.get.mock.calls[0][1].params;
      expect(params['X-Plex-Token']).toBe('USER-TOKEN');
    });

    test('omits X-Plex-Token entirely when plexPlaylistToken is the UNCLAIMED_SERVER sentinel', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'UNCLAIMED_SERVER' });
      await adapter.resolveItemIdByFilepath('/path/v1.mp4');
      const params = axios.get.mock.calls[0][1].params;
      expect('X-Plex-Token' in params).toBe(false);
    });

    test('createPlaylist respects the override token', async () => {
      // _getMachineId still uses plexApiKey (admin) — first GET returns identity
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
      axios.post.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: '1' }] } } });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'USER-TOKEN' });
      await adapter.createPlaylist('PL', ['1', '2']);
      const postParams = axios.post.mock.calls[0][2].params;
      expect(postParams['X-Plex-Token']).toBe('USER-TOKEN');
    });

    test('testConnection always uses plexApiKey regardless of override', async () => {
      axios.get.mockResolvedValueOnce({ data: {} });
      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'UNCLAIMED_SERVER' });
      await adapter.testConnection();
      const params = axios.get.mock.calls[0][1].params;
      expect(params['X-Plex-Token']).toBe('TOKEN');
    });
  });

  test('createPlaylist POSTs with ratingKey URI', async () => {
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { machineIdentifier: 'MACHINE123' } },
    });
    axios.post.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '100' }] } },
    });
    const adapter = new PlexAdapter(cfg);
    const result = await adapter.createPlaylist('YT: My Playlist', ['42', '43']);
    expect(result.id).toBe('100');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/playlists'),
      null,
      expect.objectContaining({ params: expect.objectContaining({ type: 'video', title: 'YT: My Playlist', smart: 0 }) })
    );
  });

  test('replacePlaylistItems deletes then PUTs and returns the same id (in-place replace)', async () => {
    // Visibility check: the stored id IS present in the current scope.
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '100' }] } },
    });
    axios.delete.mockResolvedValueOnce({});
    // _getMachineId for the PUT uri
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { machineIdentifier: 'MACHINE123' } },
    });
    axios.put.mockResolvedValueOnce({});
    const adapter = new PlexAdapter(cfg);
    const result = await adapter.replacePlaylistItems('100', ['42', '43'], { name: 'PL' });
    expect(axios.delete).toHaveBeenCalled();
    expect(axios.put).toHaveBeenCalled();
    expect(result).toEqual({ id: '100' });
  });

  test('replacePlaylistItems falls back to create-fresh when stored id returns 404', async () => {
    // Visibility check: id present, so we attempt the in-place replace.
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: 'stale-id' }] } },
    });
    // DELETE returns 404 — stale id
    axios.delete.mockRejectedValueOnce({ response: { status: 404 } });
    // Fresh create path: identity + POST
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
    axios.post.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: 'new-id' }] } } });
    const adapter = new PlexAdapter(cfg);
    const result = await adapter.replacePlaylistItems('stale-id', ['42'], { name: 'PL' });
    expect(result).toEqual({ id: 'new-id' });
  });

  test('replacePlaylistItems relocates (deletes stranded + creates fresh) when stored id is not visible', async () => {
    // Current scope listing does NOT contain the stored id (created under a
    // different scope, then plexPlaylistToken switched).
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '999', title: 'Other' }] } },
    });
    // Stranded-playlist cleanup: first DELETE candidate succeeds.
    axios.delete.mockResolvedValueOnce({});
    // No same-named playlist in scope -> createPlaylist: _getMachineId + POST.
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
    axios.post.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: 'fresh-id' }] } } });

    const adapter = new PlexAdapter(cfg);
    const result = await adapter.replacePlaylistItems('stranded-id', ['42'], { name: 'PL' });

    // Deletes the stranded playlist by id (not its items) to remove it from the old scope.
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/playlists/stranded-id'),
      expect.any(Object)
    );
    // No in-place item edit on the stranded id.
    expect(axios.put).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalled();
    expect(result).toEqual({ id: 'fresh-id' });
  });

  test('replacePlaylistItems adopts an existing same-named playlist in scope instead of duplicating', async () => {
    // Stored id absent, but a playlist named 'PL' already exists in this scope.
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '555', title: 'PL' }] } },
    });
    // Stranded cleanup
    axios.delete.mockResolvedValueOnce({});
    // Adopt -> _replaceInPlace('555'): delete items, _getMachineId, put items
    axios.delete.mockResolvedValueOnce({});
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
    axios.put.mockResolvedValueOnce({});

    const adapter = new PlexAdapter(cfg);
    const result = await adapter.replacePlaylistItems('stranded-id', ['42'], { name: 'PL' });

    // Reused the existing id; did not create a duplicate.
    expect(axios.post).not.toHaveBeenCalled();
    expect(result).toEqual({ id: '555' });
  });

  test('replacePlaylistItems throws when stored id not visible and no name to relocate with', async () => {
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
    const adapter = new PlexAdapter(cfg);
    await expect(adapter.replacePlaylistItems('stranded-id', ['42'], {})).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('replacePlaylistItems falls back to in-place when the scope listing fails (transient error)', async () => {
    // Listing the scope errors -> do NOT take the destructive relocate path.
    axios.get.mockRejectedValueOnce(new Error('network'));
    // In-place path: delete items, _getMachineId, put items
    axios.delete.mockResolvedValueOnce({});
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
    axios.put.mockResolvedValueOnce({});

    const adapter = new PlexAdapter(cfg);
    const result = await adapter.replacePlaylistItems('100', ['42'], { name: 'PL' });
    expect(result).toEqual({ id: '100' });
    // No relocation create.
    expect(axios.post).not.toHaveBeenCalled();
  });
});
