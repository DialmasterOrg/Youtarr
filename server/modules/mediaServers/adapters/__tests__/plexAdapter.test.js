jest.mock('axios');
jest.mock('../../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../../plexModule', () => ({
  refreshLibrariesForSubfolders: jest.fn(),
  refreshLibrary: jest.fn(),
}));

const axios = require('axios');
const plexModule = require('../../../plexModule');
const PlexAdapter = require('../plexAdapter');

describe('PlexAdapter', () => {
  const cfg = {
    plexUrl: 'http://plex:32400',
    plexApiKey: 'TOKEN',
    plexYoutubeLibraryId: '2',
  };

  beforeEach(() => jest.clearAllMocks());

  test('exposes the serverType contract used by orchestration', () => {
    expect(new PlexAdapter(cfg).serverType).toBe('plex');
  });

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

  describe('audio (music library) support', () => {
    const VIDEO_AND_MUSIC = [
      { key: '2', type: 'movie', title: 'YouTube' },
      { key: '40', type: 'artist', title: 'Music' },
    ];

    test('an mp3 in the batch searches music sections with type=10 and resolves the track', async () => {
      mockSections(VIDEO_AND_MUSIC);
      // Video section '2': no match.
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      // Music section '40' (tracks listing) has it.
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ ratingKey: '900', Media: [{ Part: [{ file: '/plex/ChanA/Song [aud1].mp3' }] }] }] } },
      });
      const adapter = new PlexAdapter(cfg);
      const id = await adapter.resolveItemIdByFilepath('/data/ChanA/Song [aud1].mp3');
      expect(id).toBe('900');
      const musicCall = axios.get.mock.calls.find((c) => c[0].includes('/library/sections/40/all'));
      expect(musicCall[1].params.type).toBe(10);
    });

    test('a batch with no mp3 does not query music sections', async () => {
      mockSections(VIDEO_AND_MUSIC);
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.resolveItemIdByFilepath('/data/ChanA/Video [v1].mp4');
      const queried = axios.get.mock.calls.map((c) => c[0]);
      expect(queried.some((u) => u.includes('/library/sections/40/all'))).toBe(false);
    });

    test('video sections are queried without a type filter even when the batch has mp3s', async () => {
      mockSections(VIDEO_AND_MUSIC);
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.resolveItemIdByFilepath('/data/ChanA/Song [aud1].mp3');
      const videoCall = axios.get.mock.calls.find((c) => c[0].includes('/library/sections/2/all'));
      expect(videoCall[1].params.type).toBeUndefined();
    });

    test('createPlaylist with mediaType audio posts type=audio', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
      axios.post.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: 'p1' }] } } });
      const adapter = new PlexAdapter(cfg);
      const result = await adapter.createPlaylist('YT: Audio PL', ['900'], { mediaType: 'audio' });
      expect(result.id).toBe('p1');
      expect(axios.post.mock.calls[0][2].params.type).toBe('audio');
    });

    test('createPlaylist defaults to type=video when mediaType is absent', async () => {
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
      axios.post.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: 'p1' }] } } });
      const adapter = new PlexAdapter(cfg);
      await adapter.createPlaylist('YT: Video PL', ['1']);
      expect(axios.post.mock.calls[0][2].params.type).toBe('video');
    });

    test('replacePlaylistItems checks scope against audio playlists when mediaType is audio', async () => {
      // Scope listing: the stored id is visible.
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [{ ratingKey: 'p1', title: 'YT: Audio PL' }] } } });
      axios.delete.mockResolvedValueOnce({});
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { machineIdentifier: 'MID' } } });
      axios.put.mockResolvedValueOnce({});
      const adapter = new PlexAdapter(cfg);
      await adapter.replacePlaylistItems('p1', ['900'], { name: 'YT: Audio PL', mediaType: 'audio' });
      expect(axios.get.mock.calls[0][1].params.playlistType).toBe('audio');
    });

    test('triggerLibraryScan with mediaType audio refreshes each music section', async () => {
      mockSections(VIDEO_AND_MUSIC);
      const adapter = new PlexAdapter(cfg);
      await adapter.triggerLibraryScan(null, { mediaType: 'audio' });
      expect(plexModule.refreshLibrary).toHaveBeenCalledTimes(1);
      expect(plexModule.refreshLibrary).toHaveBeenCalledWith('40');
      // Existing subfolder-based video refresh delegation is preserved.
      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledWith([]);
    });

    test('triggerLibraryScan without an audio mediaType does not touch music sections', async () => {
      const adapter = new PlexAdapter(cfg);
      await adapter.triggerLibraryScan(null, { mediaType: 'video' });
      await adapter.triggerLibraryScan();
      expect(plexModule.refreshLibrary).not.toHaveBeenCalled();
      // No section enumeration needed for video scans.
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('triggerLibraryScan audio degrades to no music refresh when enumeration fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('boom'));
      const adapter = new PlexAdapter(cfg);
      await expect(adapter.triggerLibraryScan(null, { mediaType: 'audio' })).resolves.not.toThrow();
      expect(plexModule.refreshLibrary).not.toHaveBeenCalled();
    });
  });

  describe('fetchWatchStates', () => {
    // Single-user mode for most tests so the queued responses stay minimal;
    // all-users behavior gets its own tests below.
    const cfg = { plexUrl: 'http://plex:32400', plexApiKey: 'TOKEN', plexYoutubeLibraryId: '1', plexWatchStatusAllUsers: false };
    const allUsersCfg = { plexUrl: 'http://plex:32400', plexApiKey: 'TOKEN', plexYoutubeLibraryId: '1' };

    test('maps viewCount/viewOffset/lastViewedAt to watch state entries', async () => {
      // _getSectionIds enumerates /library/sections first
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      // section /all listing
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [
              {
                ratingKey: '11',
                viewCount: 2,
                lastViewedAt: 1752624000,
                duration: 600000,
                Media: [{ Part: [{ file: '/media/Chan/Video A [id1].mp4' }] }],
              },
              {
                ratingKey: '12',
                viewOffset: 150000,
                duration: 600000,
                Media: [{ Part: [{ file: '/media/Chan/Video B [id2].mp4' }] }],
              },
              {
                ratingKey: '13',
                duration: 600000,
                Media: [{ Part: [{ file: '/media/Chan/Video C [id3].mp4' }] }],
              },
            ],
          },
        },
      });

      const adapter = new PlexAdapter(cfg);
      const { entries } = await adapter.fetchWatchStates();

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        path: '/media/Chan/Video A [id1].mp4',
        serverUserId: '1',
        played: true,
        playCount: 2,
        positionMs: null,
        percentWatched: 100,
        lastWatchedAt: new Date(1752624000 * 1000),
      });
      expect(entries[1].played).toBe(false);
      expect(entries[1].positionMs).toBe(150000);
      expect(entries[1].percentWatched).toBe(25);
      expect(entries[2].played).toBe(false);
      expect(entries[2].percentWatched).toBeNull();
    });

    test('uses the admin token, not the playlist token', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'OTHER' });
      await adapter.fetchWatchStates();

      // first call is the /library/sections enumeration; it must carry the admin token too
      const enumCall = axios.get.mock.calls[0];
      expect(enumCall[1].params['X-Plex-Token']).toBe('TOKEN');
      // second call is the section listing; it must carry the admin token
      const sectionCall = axios.get.mock.calls[1];
      expect(sectionCall[1].params['X-Plex-Token']).toBe('TOKEN');
    });

    test('omits X-Plex-Token on all watch-state requests when plexPlaylistToken is the UNCLAIMED_SERVER sentinel', async () => {
      // /library/sections enumeration, then the section /all listing
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter({ ...cfg, plexPlaylistToken: 'UNCLAIMED_SERVER' });
      await adapter.fetchWatchStates();

      expect(axios.get).toHaveBeenCalledTimes(2);
      for (const call of axios.get.mock.calls) {
        expect(call[1].params).not.toHaveProperty('X-Plex-Token');
      }
    });

    test('throws MediaServerUnavailableError when the server is unreachable', async () => {
      const { MediaServerUnavailableError } = require('../baseAdapter');
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      const err = new Error('connect ECONNREFUSED');
      err.isAxiosError = true;
      err.code = 'ECONNREFUSED';
      axios.get.mockRejectedValueOnce(err);

      const adapter = new PlexAdapter(cfg);
      await expect(adapter.fetchWatchStates()).rejects.toBeInstanceOf(MediaServerUnavailableError);
    });

    test('lists show sections with type=4 so episode files are enumerated', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }, { type: 'show', key: '5' }] } },
      });
      // movie section listing: plain /all
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      // show section listing: episode leaves
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [
              { ratingKey: '51', viewCount: 1, Media: [{ Part: [{ file: '/tv/Chan/S01E01 [vid1].mp4' }] }] },
            ],
          },
        },
      });

      const adapter = new PlexAdapter(cfg);
      const { entries } = await adapter.fetchWatchStates();

      const movieCall = axios.get.mock.calls[1];
      expect(movieCall[1].params).not.toHaveProperty('type');
      const showCall = axios.get.mock.calls[2];
      expect(showCall[0]).toBe('http://plex:32400/library/sections/5/all');
      expect(showCall[1].params.type).toBe(4);
      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe('/tv/Chan/S01E01 [vid1].mp4');
      expect(entries[0].played).toBe(true);
    });

    test('throws when every section listing fails (e.g. expired admin token)', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }, { type: 'movie', key: '2' }] } },
      });
      const unauthorized = new Error('Request failed with status code 401');
      unauthorized.isAxiosError = true;
      unauthorized.response = { status: 401 };
      axios.get.mockRejectedValueOnce(unauthorized);
      axios.get.mockRejectedValueOnce(unauthorized);

      const adapter = new PlexAdapter(cfg);
      await expect(adapter.fetchWatchStates()).rejects.toThrow(
        /could not list any Plex library section \(HTTP 401\)/
      );
    });

    test('throws when enumeration fails and no fallback library is configured', async () => {
      const { WatchStateFetchError } = require('../baseAdapter');
      // serverRegistry enables Plex on URL + API key alone, so the configured
      // library id can legitimately be absent.
      const unauthorized = new Error('Request failed with status code 401');
      unauthorized.isAxiosError = true;
      unauthorized.response = { status: 401 };
      axios.get.mockRejectedValueOnce(unauthorized);

      const adapter = new PlexAdapter({ plexUrl: 'http://plex:32400', plexApiKey: 'TOKEN' });
      await expect(adapter.fetchWatchStates()).rejects.toThrow(WatchStateFetchError);
    });

    test('throws MediaServerUnavailableError when enumeration fails with a network error and no library is configured', async () => {
      const { MediaServerUnavailableError } = require('../baseAdapter');
      const err = new Error('connect ECONNREFUSED');
      err.isAxiosError = true;
      err.code = 'ECONNREFUSED';
      axios.get.mockRejectedValueOnce(err);

      const adapter = new PlexAdapter({ plexUrl: 'http://plex:32400', plexApiKey: 'TOKEN' });
      await expect(adapter.fetchWatchStates()).rejects.toBeInstanceOf(MediaServerUnavailableError);
    });

    test('returns empty success when enumeration succeeds but the server has no video sections', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'artist', key: '40' }] } },
      });

      const adapter = new PlexAdapter({ plexUrl: 'http://plex:32400', plexApiKey: 'TOKEN', plexWatchStatusAllUsers: false });
      await expect(adapter.fetchWatchStates()).resolves.toEqual({ entries: [], users: [], historyCursor: null });
    });

    test('a single failed section does not abort the others', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }, { type: 'movie', key: '2' }] } },
      });
      const notFound = new Error('Request failed with status code 404');
      notFound.isAxiosError = true;
      notFound.response = { status: 404 };
      axios.get.mockRejectedValueOnce(notFound);
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Metadata: [{ viewCount: 1, Media: [{ Part: [{ file: '/media/Chan/V [x1].mp4' }] }] }] } },
      });

      const adapter = new PlexAdapter(cfg);
      const { entries } = await adapter.fetchWatchStates();
      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe('/media/Chan/V [x1].mp4');
    });

    test('makes no accounts or history requests when all-users is disabled', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(cfg);
      await adapter.fetchWatchStates();

      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('pulls history for non-owner accounts and maps it through ratingKeys', async () => {
      // enumeration + one movie section listing
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [
              { ratingKey: '11', duration: 600000, Media: [{ Part: [{ file: '/m/a.mp4' }] }] },
            ],
          },
        },
      });
      // /accounts
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Account: [{ id: 1, name: 'chris' }, { id: 55, name: 'kid1' }] } },
      });
      // history (single short page)
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [
              { accountID: 55, ratingKey: '11', viewedAt: 1752624000 },
              { accountID: 55, ratingKey: '11', viewedAt: 1752624100 }, // dedupe, keep max
              { accountID: 1, ratingKey: '11', viewedAt: 1752624200 },  // owner: listing covers it
              { accountID: 55, ratingKey: '99', viewedAt: 1752624300 }, // unknown ratingKey
            ],
          },
        },
      });

      const adapter = new PlexAdapter(allUsersCfg);
      const { entries, users, historyCursor } = await adapter.fetchWatchStates();

      expect(users).toEqual([{ id: '1', name: 'chris' }, { id: '55', name: 'kid1' }]);
      const kid = entries.find((e) => e.serverUserId === '55');
      expect(kid).toMatchObject({
        path: '/m/a.mp4',
        played: true,
        playCount: 1,
        positionMs: null,
        percentWatched: 100,
      });
      expect(kid.lastWatchedAt).toEqual(new Date(1752624100 * 1000));
      // Owner comes from the listing, never duplicated from history.
      expect(entries.filter((e) => e.serverUserId === '1')).toHaveLength(1);
      // The cursor reflects the newest SCANNED event, matched or not: the
      // unknown-ratingKey event at 1752624300 counts.
      expect(historyCursor).toEqual(new Date(1752624300 * 1000));
    });

    test('performs a full history pull when an account unknown to the caller appears', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Account: [{ id: 1, name: 'chris' }, { id: 99, name: 'newkid' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(allUsersCfg);
      await adapter.fetchWatchStates({
        since: new Date(1752620000 * 1000),
        knownUserIds: ['55'],
      });

      const historyCall = axios.get.mock.calls[3];
      expect(historyCall[1].params).not.toHaveProperty('viewedAt>');
    });

    test('keeps the incremental window when all accounts are already known', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Account: [{ id: 1, name: 'chris' }, { id: 55, name: 'kid1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(allUsersCfg);
      await adapter.fetchWatchStates({
        since: new Date(1752620000 * 1000),
        knownUserIds: ['55'],
      });

      const historyCall = axios.get.mock.calls[3];
      expect(historyCall[1].params['viewedAt>']).toBe(1752620000);
    });

    test('does not advance the cursor when a section listing fails', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }, { type: 'movie', key: '2' }] } },
      });
      // Section 1 lists fine; section 2 fails with a 404.
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [{ ratingKey: '11', Media: [{ Part: [{ file: '/m/a.mp4' }] }] }],
          },
        },
      });
      const notFound = new Error('Request failed with status code 404');
      notFound.isAxiosError = true;
      notFound.response = { status: 404 };
      axios.get.mockRejectedValueOnce(notFound);
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Account: [] } } });
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [{ accountID: 55, ratingKey: '11', viewedAt: 1752624000 }],
          },
        },
      });

      const adapter = new PlexAdapter(allUsersCfg);
      const { entries, historyCursor } = await adapter.fetchWatchStates();

      // History entries still flow, but the cursor must not advance: skipped
      // events may belong to the failed section's items.
      expect(entries.some((e) => e.serverUserId === '55')).toBe(true);
      expect(historyCursor).toBeNull();
    });

    test('withholds a new account from the user list when a section listing fails', async () => {
      // Pre-existing cursor + new account 99 -> full backfill pull, but one
      // section fails mid-scan. If 99 were reported (and stored as known),
      // the next sync would resume from the old cursor and permanently skip
      // 99's pre-cursor events for the failed section's items.
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }, { type: 'movie', key: '2' }] } },
      });
      axios.get.mockResolvedValueOnce({
        data: {
          MediaContainer: {
            Metadata: [{ ratingKey: '11', Media: [{ Part: [{ file: '/m/a.mp4' }] }] }],
          },
        },
      });
      const notFound = new Error('Request failed with status code 404');
      notFound.isAxiosError = true;
      notFound.response = { status: 404 };
      axios.get.mockRejectedValueOnce(notFound);
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Account: [{ id: 1, name: 'chris' }, { id: 55, name: 'kid1' }, { id: 99, name: 'newkid' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(allUsersCfg);
      const { users, historyCursor } = await adapter.fetchWatchStates({
        since: new Date(1752620000 * 1000),
        knownUserIds: ['55'],
      });

      // The full pull still ran (new account detected)...
      const historyCall = axios.get.mock.calls[4];
      expect(historyCall[1].params).not.toHaveProperty('viewedAt>');
      // ...but the unknown account is not reported, so the caller cannot mark
      // it known off an incomplete scan; owner and known accounts still flow.
      expect(users).toEqual([{ id: '1', name: 'chris' }, { id: '55', name: 'kid1' }]);
      expect(historyCursor).toBeNull();
    });

    test('advances the cursor to the last scanned event when the page cap truncates', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Account: [] } } });
      const fullPage = Array.from({ length: 1000 }, (_, i) => ({
        accountID: 55, ratingKey: '99', viewedAt: 1752600000 + i,
      }));
      for (let page = 0; page < 50; page++) {
        axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: fullPage } } });
      }

      const adapter = new PlexAdapter(allUsersCfg);
      const { historyCursor } = await adapter.fetchWatchStates();

      // 50 pages scanned, then capped; the cursor records the newest scanned
      // event so the next sync resumes instead of refetching the same window.
      expect(axios.get).toHaveBeenCalledTimes(3 + 50);
      expect(historyCursor).toEqual(new Date((1752600000 + 999) * 1000));
    });

    test('passes the since watermark to the history request', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Account: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(allUsersCfg);
      await adapter.fetchWatchStates({ since: new Date(1752620000 * 1000) });

      const historyCall = axios.get.mock.calls[3];
      expect(historyCall[0]).toBe('http://plex:32400/status/sessions/history/all');
      expect(historyCall[1].params['viewedAt>']).toBe(1752620000);
      expect(historyCall[1].params.sort).toBe('viewedAt:asc');
    });

    test('pages history until a short page', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Account: [] } } });
      const fullPage = Array.from({ length: 1000 }, (_, i) => ({
        accountID: 55, ratingKey: '99', viewedAt: 1752620000 + i,
      }));
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: fullPage } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter(allUsersCfg);
      await adapter.fetchWatchStates();

      const firstHistory = axios.get.mock.calls[3][1].params;
      const secondHistory = axios.get.mock.calls[4][1].params;
      expect(firstHistory['X-Plex-Container-Start']).toBe(0);
      expect(secondHistory['X-Plex-Container-Start']).toBe(1000);
      expect(axios.get).toHaveBeenCalledTimes(5);
    });

    test('throws WatchStateFetchError when the history request fails', async () => {
      const { WatchStateFetchError } = require('../baseAdapter');
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Account: [] } } });
      const unauthorized = new Error('Request failed with status code 401');
      unauthorized.isAxiosError = true;
      unauthorized.response = { status: 401 };
      axios.get.mockRejectedValueOnce(unauthorized);

      const adapter = new PlexAdapter(allUsersCfg);
      await expect(adapter.fetchWatchStates()).rejects.toThrow(WatchStateFetchError);
    });

    test('skips accounts and history on unclaimed (anonymous) servers even with all-users on', async () => {
      axios.get.mockResolvedValueOnce({
        data: { MediaContainer: { Directory: [{ type: 'movie', key: '1' }] } },
      });
      axios.get.mockResolvedValueOnce({ data: { MediaContainer: { Metadata: [] } } });

      const adapter = new PlexAdapter({ ...allUsersCfg, plexPlaylistToken: 'UNCLAIMED_SERVER' });
      const { users } = await adapter.fetchWatchStates();

      expect(users).toEqual([]);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
});
