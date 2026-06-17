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

  // resolveItemIdByFilepath first enumerates video sections via /library/sections,
  // then queries each section's /all. This helper queues the enumeration response.
  const mockSections = (sections) =>
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Directory: sections } } });
  const ONE_SECTION = [{ key: '2', type: 'movie', title: 'YouTube' }];

  test('resolveItemIdByFilepath returns ratingKey on match', async () => {
    mockSections(ONE_SECTION);
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { Metadata: [{ ratingKey: '42', Media: [{ Part: [{ file: '/youtube/X/v1.mp4' }] }] }] } },
    });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/X/v1.mp4');
    expect(id).toBe('42');
  });

  test('resolveItemIdByFilepath returns null on no match', async () => {
    mockSections(ONE_SECTION);
    axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
    const adapter = new PlexAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/X/nope.mp4');
    expect(id).toBeNull();
  });

  test('resolveItemIdByFilepath matches by basename across different mount prefixes', async () => {
    // Youtarr sees /usr/src/app/data/...; Plex sees /mnt/media/youtube/...
    // Same file, same basename. Must still resolve.
    mockSections(ONE_SECTION);
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
    mockSections(ONE_SECTION);
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
    mockSections(ONE_SECTION);
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

  describe('cross-library resolution', () => {
    // A playlist's videos can be scattered across multiple Plex libraries. The
    // adapter discovers the video sections from the server (/library/sections),
    // not from Youtarr config, then searches each one.
    const THREE_SECTIONS = [
      { key: '37', type: 'movie', title: 'GlobalDefault' },
      { key: '38', type: 'movie', title: 'Library1' },
      { key: '39', type: 'movie', title: 'Library2' },
    ];

    test('finds an item in a section other than the configured library', async () => {
      mockSections(THREE_SECTIONS);
      // Configured library '2' (added first) has no match...
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      // section 37 no match...
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      // section 38 (Library1) has it.
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '321', Media: [{ Part: [{ file: '/plex/__Library1/Creator/Song [vid9].mp4' }] }] }] } },
      });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath('/data/__Library1/Creator/Song [vid9].mp4');
      expect(id).toBe('321');
      // Configured library searched first, then the enumerated sections.
      expect(axios.get.mock.calls[1][0]).toContain('/library/sections/2/all');
      expect(axios.get.mock.calls[2][0]).toContain('/library/sections/37/all');
      expect(axios.get.mock.calls[3][0]).toContain('/library/sections/38/all');
    });

    test('prefers the item whose path best matches the real location when a stale item lingers in another library', async () => {
      // A video moved from __GlobalDefault (section 37) to __Library2 (section 39).
      // Plex still lists the stale item in 37 (same basename). The resolver must
      // pick the Library2 item, whose path shares a longer trailing run with the
      // real (current) file path.
      mockSections(THREE_SECTIONS);
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } }); // section 2 (configured) empty
      axios.get.mockResolvedValueOnce({ // section 37: stale GlobalDefault item
        data: { MediaContainer: { Metadata: [{ ratingKey: '19850', Media: [{ Part: [{ file: 'Q:\\YT\\__GlobalDefault\\Little Mix\\Black Magic - MkElfR_NPBI\\Black Magic [MkElfR_NPBI].mp4' }] }] }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } }); // section 38 empty
      axios.get.mockResolvedValueOnce({ // section 39: correct Library2 item
        data: { MediaContainer: { Metadata: [{ ratingKey: '19855', Media: [{ Part: [{ file: 'Q:\\YT\\__Library2\\Little Mix\\Black Magic - MkElfR_NPBI\\Black Magic [MkElfR_NPBI].mp4' }] }] }] } },
      });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath(
        '/usr/src/app/data/__Library2/Little Mix/Black Magic - MkElfR_NPBI/Black Magic [MkElfR_NPBI].mp4'
      );
      expect(id).toBe('19855');
    });

    test('searches every video section and returns null when none has the file', async () => {
      mockSections(THREE_SECTIONS);
      axios.get.mockResolvedValue({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath('/data/Missing [zzz].mp4');
      expect(id).toBeNull();
      // 1 enumeration + sections 2 (configured), 37, 38, 39 = 5 total.
      expect(axios.get).toHaveBeenCalledTimes(5);
    });

    test('a failing section query does not abort the search of later sections', async () => {
      mockSections(THREE_SECTIONS);
      axios.get.mockRejectedValueOnce(new Error('section 2 down'));
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '777', Media: [{ Part: [{ file: '/plex/m/Found [bbb].mp4' }] }] }] } },
      });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath('/data/Found [bbb].mp4');
      expect(id).toBe('777');
    });

    test('only searches video-bearing sections (skips music/photo)', async () => {
      mockSections([
        { key: '37', type: 'movie', title: 'Videos' },
        { key: '40', type: 'artist', title: 'Music' },
        { key: '41', type: 'photo', title: 'Photos' },
        { key: '42', type: 'show', title: 'Shows' },
      ]);
      axios.get.mockResolvedValue({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.resolveItemIdByFilepath('/data/x.mp4');
      // enumeration + sections: 2 (configured), 37 (movie), 42 (show). Music/photo skipped.
      expect(axios.get).toHaveBeenCalledTimes(4);
      const queried = axios.get.mock.calls.slice(1).map((c) => c[0]);
      expect(queried.some((u) => u.includes('/library/sections/40/all'))).toBe(false);
      expect(queried.some((u) => u.includes('/library/sections/41/all'))).toBe(false);
    });

    test('falls back to the configured library when section enumeration fails', async () => {
      // Enumeration request errors; we still search the configured library.
      axios.get.mockRejectedValueOnce(new Error('sections down'));
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '5', Media: [{ Part: [{ file: '/plex/yt/Only [ccc].mp4' }] }] }] } },
      });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath('/data/Only [ccc].mp4');
      expect(id).toBe('5');
      expect(axios.get.mock.calls[1][0]).toContain('/library/sections/2/all');
    });

    test('caches the section list across multiple resolve calls in one sync', async () => {
      mockSections(THREE_SECTIONS);
      axios.get.mockResolvedValue({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.resolveItemIdByFilepath('/data/a.mp4');
      await adapter.resolveItemIdByFilepath('/data/b.mp4');
      // Enumeration happens once; section listing not re-fetched on the 2nd call.
      const enumCalls = axios.get.mock.calls.filter((c) => c[0].endsWith('/library/sections'));
      expect(enumCalls.length).toBe(1);
    });
  });

  describe('batch resolution', () => {
    const THREE_SECTIONS = [
      { key: '37', type: 'movie', title: 'GlobalDefault' },
      { key: '38', type: 'movie', title: 'Library1' },
      { key: '39', type: 'movie', title: 'Library2' },
    ];

    test('fetches each section once for the whole batch', async () => {
      mockSections(THREE_SECTIONS);
      // Section 2 (configured) holds v1; section 38 holds v2; the rest are empty.
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '11', Media: [{ Part: [{ file: '/plex/X/v1 [aaa].mp4' }] }] }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '22', Media: [{ Part: [{ file: '/plex/Y/v2 [bbb].mp4' }] }] }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(cfg);
      const resolved = await adapter.resolveItemIdsByFilepaths([
        '/data/X/v1 [aaa].mp4',
        '/data/Y/v2 [bbb].mp4',
        '/data/Z/missing [ccc].mp4',
      ]);

      expect(resolved.get('/data/X/v1 [aaa].mp4')).toBe('11');
      expect(resolved.get('/data/Y/v2 [bbb].mp4')).toBe('22');
      expect(resolved.get('/data/Z/missing [ccc].mp4')).toBeNull();
      // 1 enumeration + 4 section fetches, regardless of batch size.
      expect(axios.get).toHaveBeenCalledTimes(5);
    });

    test('still disambiguates a stale duplicate within a batch', async () => {
      mockSections(THREE_SECTIONS);
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } }); // section 2
      axios.get.mockResolvedValueOnce({ // section 37: stale copy in the old library
        data: { MediaContainer: { Metadata: [{ ratingKey: '100', Media: [{ Part: [{ file: '/plex/__Old/Ch/v [aaa].mp4' }] }] }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } }); // section 38
      axios.get.mockResolvedValueOnce({ // section 39: current location
        data: { MediaContainer: { Metadata: [{ ratingKey: '200', Media: [{ Part: [{ file: '/plex/__New/Ch/v [aaa].mp4' }] }] }] } },
      });

      const adapter = new PlexAdapter(cfg);
      const resolved = await adapter.resolveItemIdsByFilepaths(['/data/__New/Ch/v [aaa].mp4']);
      expect(resolved.get('/data/__New/Ch/v [aaa].mp4')).toBe('200');
    });

    test('makes no requests for an empty batch', async () => {
      const adapter = new PlexAdapter(cfg);
      const resolved = await adapter.resolveItemIdsByFilepaths([]);
      expect(resolved.size).toBe(0);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('throws MediaServerUnavailableError when a section query reports the server unreachable', async () => {
      const { MediaServerUnavailableError } = require('../baseAdapter');
      mockSections(ONE_SECTION);
      axios.get.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
      const adapter = new PlexAdapter(cfg);
      await expect(adapter.resolveItemIdsByFilepaths(['/data/x.mp4'])).rejects.toBeInstanceOf(MediaServerUnavailableError);
    });

    test('throws MediaServerUnavailableError on a 5xx section response', async () => {
      const { MediaServerUnavailableError } = require('../baseAdapter');
      mockSections(ONE_SECTION);
      axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 }, message: 'Request failed with status code 503' });
      const adapter = new PlexAdapter(cfg);
      await expect(adapter.resolveItemIdsByFilepaths(['/data/x.mp4'])).rejects.toBeInstanceOf(MediaServerUnavailableError);
    });
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

  test('applies a request timeout to HTTP calls', async () => {
    const { REQUEST_TIMEOUT_MS } = require('../baseAdapter');
    axios.get.mockResolvedValueOnce({ data: {} });
    const adapter = new PlexAdapter(cfg);
    await adapter.testConnection();
    expect(axios.get).toHaveBeenCalledWith(
      'http://plex:32400/identity',
      expect.objectContaining({ timeout: REQUEST_TIMEOUT_MS })
    );
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
