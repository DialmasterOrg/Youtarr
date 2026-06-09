jest.mock('axios');
jest.mock('../../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const axios = require('axios');
const EmbyAdapter = require('../embyAdapter');

describe('EmbyAdapter', () => {
  const cfg = { embyUrl: 'http://emby:8096', embyApiKey: 'KEY', embyUserId: 'USR' };

  beforeEach(() => jest.clearAllMocks());

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
});
