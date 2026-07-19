jest.mock('axios');
jest.mock('../../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const axios = require('axios');
const EmbyAdapter = require('../embyAdapter');

describe('EmbyAdapter', () => {
  const cfg = { embyUrl: 'http://emby:8096', embyApiKey: 'KEY', embyUserId: 'USR' };

  beforeEach(() => jest.clearAllMocks());

  test('exposes the serverType contract used by orchestration', () => {
    expect(new EmbyAdapter(cfg).serverType).toBe('emby');
  });

  test('testConnection returns ok on successful ping', async () => {
    axios.get.mockResolvedValueOnce({ data: { Version: '4.8.0' } });
    const adapter = new EmbyAdapter(cfg);
    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
  });

  test('listUsers returns user list', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ Id: 'u1', Name: 'Alice' }, { Id: 'u2', Name: 'Bob' }] });
    const adapter = new EmbyAdapter(cfg);
    const users = await adapter.listUsers();
    expect(users).toEqual([{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }]);
  });

  test('createPlaylist POSTs with query params and CSV Ids (Emby-style)', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'newplaylistid' } });
    const adapter = new EmbyAdapter(cfg);
    const result = await adapter.createPlaylist('My PL', ['item1', 'item2']);
    expect(result.id).toBe('newplaylistid');
    // Emby expects the body to be null and the data in query params with Ids
    // joined by commas. Sending a JSON body (as Jellyfin accepts) yields a 500.
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          Name: 'My PL',
          Ids: 'item1,item2',
          UserId: 'USR',
          MediaType: 'Video',
        }),
      })
    );
  });

  const playlistsCall = () =>
    axios.post.mock.calls.find((c) => String(c[0]).includes('/Playlists'));

  test('createPlaylist with public:false is owner-scoped (UserId present)', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'pl-2' } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.createPlaylist('My PL', ['item1'], { public: false });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      null,
      expect.objectContaining({ params: expect.objectContaining({ UserId: 'USR' }) }),
    );
  });

  test('createPlaylist with public:true omits UserId (server-global playlist)', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'pl-1' } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.createPlaylist('My PL', ['item1'], { public: true });
    expect(playlistsCall()[2].params).not.toHaveProperty('UserId');
  });

  test('replacePlaylistItems with public:true recreates as a server-global playlist', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.post.mockResolvedValueOnce({ data: { Id: 'recreated-id' } });
    const adapter = new EmbyAdapter(cfg);
    const result = await adapter.replacePlaylistItems('old-id', ['i1'], { name: 'YT: PL', public: true });
    expect(playlistsCall()[2].params).not.toHaveProperty('UserId');
    expect(result).toEqual({ id: 'recreated-id' });
  });

  test('resolveItemIdByFilepath matches by Path field', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        Items: [
          { Id: 'A', Path: '/youtube/ChanA/Video 1/v1.mp4' },
          { Id: 'B', Path: '/youtube/ChanB/Video 2/v2.mp4' },
        ],
      },
    });
    const adapter = new EmbyAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/ChanB/Video 2/v2.mp4');
    expect(id).toBe('B');
  });

  test('resolveItemIdByFilepath matches by basename across different mount prefixes', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        Items: [{ Id: 'Y', Path: '/mnt/media/youtube/Creator/Video Title [abc123].mp4' }],
      },
    });
    const adapter = new EmbyAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath(
      '/usr/src/app/data/Creator/Video Title [abc123] - abc123/Video Title [abc123].mp4'
    );
    expect(id).toBe('Y');
  });

  test('replacePlaylistItems deletes old playlist and recreates, returning the new id', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-pl-id' } });
    const adapter = new EmbyAdapter(cfg);

    const result = await adapter.replacePlaylistItems('old-pl-id', ['i1', 'i2'], {
      name: 'YT: Something', public: false,
    });

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/Items/old-pl-id'),
      expect.any(Object),
    );
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      null,
      expect.objectContaining({
        params: expect.objectContaining({ Name: 'YT: Something', Ids: 'i1,i2' }),
      }),
    );
    expect(result).toEqual({ id: 'new-pl-id' });
  });

  test('replacePlaylistItems still creates a fresh playlist when DELETE of stored id fails', async () => {
    axios.delete.mockRejectedValueOnce({ response: { status: 400 } });
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-pl-id' } });
    const adapter = new EmbyAdapter(cfg);
    const result = await adapter.replacePlaylistItems('stale-id', ['i1'], { name: 'PL' });
    expect(axios.post).toHaveBeenCalled();
    expect(result).toEqual({ id: 'new-pl-id' });
  });

  test('applies a request timeout to HTTP calls', async () => {
    const { REQUEST_TIMEOUT_MS } = require('../baseAdapter');
    axios.get.mockResolvedValueOnce({ data: { Version: '4.8' } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.testConnection();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/System/Info/Public'),
      expect.objectContaining({ timeout: REQUEST_TIMEOUT_MS })
    );
  });

  test('resolveItemIdByFilepath throws MediaServerUnavailableError when the server is unreachable', async () => {
    const { MediaServerUnavailableError } = require('../baseAdapter');
    axios.get.mockRejectedValueOnce({ isAxiosError: true, code: 'ETIMEDOUT', message: 'timeout of 30000ms exceeded' });
    const adapter = new EmbyAdapter(cfg);
    await expect(adapter.resolveItemIdByFilepath('/x/v.mp4')).rejects.toBeInstanceOf(MediaServerUnavailableError);
  });

  test('resolveItemIdByFilepath throws MediaServerUnavailableError when the server returns 5xx', async () => {
    const { MediaServerUnavailableError } = require('../baseAdapter');
    axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 }, message: 'Request failed with status code 500' });
    const adapter = new EmbyAdapter(cfg);
    await expect(adapter.resolveItemIdByFilepath('/x/v.mp4')).rejects.toBeInstanceOf(MediaServerUnavailableError);
  });

  test('resolveItemIdByFilepath returns null and logs without the API token on a non-unavailable error', async () => {
    const logger = require('../../../../logger');
    const adapter = new EmbyAdapter({ ...cfg, embyApiKey: 'SUPER_SECRET_TOKEN' });
    axios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
      message: 'Request failed with status code 404',
      config: { headers: { 'X-Emby-Token': 'SUPER_SECRET_TOKEN' } },
    });
    const id = await adapter.resolveItemIdByFilepath('/x/v.mp4');
    expect(id).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [data] = logger.warn.mock.calls[0];
    expect(data).toMatchObject({ status: 404, filepath: '/x/v.mp4' });
    expect(data).not.toHaveProperty('config');
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('SUPER_SECRET_TOKEN');
  });

  test('resolveItemIdByFilepath uses Audio item types for mp3 files', async () => {
    axios.get.mockResolvedValueOnce({
      data: { Items: [{ Id: 'T1', Path: '/mnt/media/ChanA/Song [aud1].mp3' }] },
    });
    const adapter = new EmbyAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/ChanA/Song [aud1].mp3');
    expect(id).toBe('T1');
    expect(axios.get.mock.calls[0][1].params.includeItemTypes).toBe('Audio');
  });

  test('resolveItemIdByFilepath keeps video item types for non-mp3 files', async () => {
    axios.get.mockResolvedValueOnce({ data: { Items: [] } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.resolveItemIdByFilepath('/youtube/ChanA/Video [v1].mp4');
    expect(axios.get.mock.calls[0][1].params.includeItemTypes).toBe('Video,Movie,Episode');
  });

  test('createPlaylist with mediaType audio sends MediaType Audio', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'pl1' } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.createPlaylist('YT: Audio PL', ['T1'], { public: false, mediaType: 'audio' });
    expect(axios.post.mock.calls[0][2].params.MediaType).toBe('Audio');
  });

  test('replacePlaylistItems recreates with the given mediaType', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-id' } });
    const adapter = new EmbyAdapter(cfg);
    await adapter.replacePlaylistItems('old-id', ['T1'], { name: 'YT: Audio PL', public: false, mediaType: 'audio' });
    expect(axios.post.mock.calls[0][2].params.MediaType).toBe('Audio');
  });

  describe('fetchWatchStates', () => {
    // Most tests run in single-user mode to keep one queued /Items response.
    const singleUserCfg = { ...cfg, embyWatchStatusAllUsers: false };

    test('maps UserData fields including ticks-to-ms conversion', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          Items: [
            {
              Id: 'A',
              Path: '/media/Chan/Video A [id1].mp4',
              UserData: { Played: true, PlayCount: 3, PlaybackPositionTicks: 0, LastPlayedDate: '2026-07-10T12:00:00Z' },
            },
            {
              Id: 'B',
              Path: '/media/Chan/Video B [id2].mp4',
              UserData: { Played: false, PlayCount: 0, PlaybackPositionTicks: 1500000000, PlayedPercentage: 25 },
            },
            { Id: 'C', UserData: { Played: true } }, // no Path -> excluded
          ],
        },
      });

      const adapter = new EmbyAdapter(singleUserCfg);
      const { entries, users } = await adapter.fetchWatchStates();

      expect(users).toEqual([]);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        path: '/media/Chan/Video A [id1].mp4',
        serverUserId: 'USR',
        played: true,
        playCount: 3,
        positionMs: 0,
        percentWatched: 100,
        lastWatchedAt: new Date('2026-07-10T12:00:00Z'),
      });
      expect(entries[1].positionMs).toBe(150000);
      expect(entries[1].percentWatched).toBe(25);
      expect(entries[1].played).toBe(false);
    });

    test('requests items with UserData enabled for the configured user', async () => {
      axios.get.mockResolvedValueOnce({ data: { Items: [] } });
      const adapter = new EmbyAdapter(singleUserCfg);
      await adapter.fetchWatchStates();
      expect(axios.get).toHaveBeenCalledTimes(1);
      // Emby list responses drop LastPlayedDate and zero PlayCount unless the
      // UserData* fields are requested explicitly.
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/Items'),
        expect.objectContaining({
          params: expect.objectContaining({
            userId: 'USR',
            enableUserData: true,
            fields: 'Path,UserDataLastPlayedDate,UserDataPlayCount',
          }),
        })
      );
    });

    test('lists every user when all-users is enabled (the default)', async () => {
      axios.get.mockResolvedValueOnce({ data: [{ Id: 'u1', Name: 'Alice' }, { Id: 'u2', Name: 'Bob' }] });
      axios.get.mockResolvedValueOnce({
        data: { Items: [{ Path: '/m/a.mp4', UserData: { Played: true, PlayCount: 2 } }] },
      });
      axios.get.mockResolvedValueOnce({
        data: { Items: [{ Path: '/m/a.mp4', UserData: { Played: false } }] },
      });

      const adapter = new EmbyAdapter(cfg);
      const { entries, users } = await adapter.fetchWatchStates();

      expect(users).toEqual([{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }]);
      expect(entries.map((e) => e.serverUserId)).toEqual(['u1', 'u2']);
      expect(axios.get.mock.calls[0][0]).toContain('/Users');
      expect(axios.get.mock.calls[1][1].params.userId).toBe('u1');
      expect(axios.get.mock.calls[2][1].params.userId).toBe('u2');
    });

    test('fails the fetch when the user listing fails', async () => {
      const forbidden = new Error('Request failed with status code 403');
      forbidden.isAxiosError = true;
      forbidden.response = { status: 403 };
      axios.get.mockRejectedValueOnce(forbidden);
      const adapter = new EmbyAdapter(cfg);
      await expect(adapter.fetchWatchStates()).rejects.toThrow('403');
    });

    test('throws MediaServerUnavailableError when the server is unreachable', async () => {
      const { MediaServerUnavailableError } = require('../baseAdapter');
      const err = new Error('timeout');
      err.isAxiosError = true;
      err.code = 'ETIMEDOUT';
      axios.get.mockRejectedValueOnce(err);
      const adapter = new EmbyAdapter(singleUserCfg);
      await expect(adapter.fetchWatchStates()).rejects.toBeInstanceOf(MediaServerUnavailableError);
    });
  });
});
