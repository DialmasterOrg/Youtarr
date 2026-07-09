jest.mock('axios');
jest.mock('../../../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const axios = require('axios');
const JellyfinAdapter = require('../jellyfinAdapter');

describe('JellyfinAdapter', () => {
  const cfg = { jellyfinUrl: 'http://jf:8096', jellyfinApiKey: 'KEY', jellyfinUserId: 'USR' };

  beforeEach(() => jest.clearAllMocks());

  test('testConnection returns ok on successful ping', async () => {
    axios.get.mockResolvedValueOnce({ data: { Version: '10.9.0' } });
    const adapter = new JellyfinAdapter(cfg);
    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
  });

  test('listUsers returns user list', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ Id: 'u1', Name: 'Alice' }, { Id: 'u2', Name: 'Bob' }] });
    const adapter = new JellyfinAdapter(cfg);
    const users = await adapter.listUsers();
    expect(users).toEqual([{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }]);
  });

  test('createPlaylist POSTs with Name/Ids/UserId/MediaType/IsPublic', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'newplaylistid' } });
    const adapter = new JellyfinAdapter(cfg);
    const result = await adapter.createPlaylist('My PL', ['item1', 'item2'], { public: true });
    expect(result.id).toBe('newplaylistid');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      expect.objectContaining({
        Name: 'My PL',
        Ids: ['item1', 'item2'],
        UserId: 'USR',
        MediaType: 'Video',
        IsPublic: true,
      }),
      expect.any(Object)
    );
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
    const adapter = new JellyfinAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/ChanB/Video 2/v2.mp4');
    expect(id).toBe('B');
  });

  test('resolveItemIdByFilepath matches by basename across different mount prefixes', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        Items: [{ Id: 'X', Path: '/mnt/media/youtube/Creator/Video Title [abc123].mp4' }],
      },
    });
    const adapter = new JellyfinAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath(
      '/usr/src/app/data/Creator/Video Title [abc123] - abc123/Video Title [abc123].mp4'
    );
    expect(id).toBe('X');
  });

  test('replacePlaylistItems deletes old playlist and recreates, returning the new id', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-pl-id' } });
    const adapter = new JellyfinAdapter(cfg);

    const result = await adapter.replacePlaylistItems('old-pl-id', ['i1', 'i2'], {
      name: 'YT: Something', public: false,
    });

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/Items/old-pl-id'),
      expect.any(Object),
    );
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      expect.objectContaining({ Name: 'YT: Something', Ids: ['i1', 'i2'] }),
      expect.any(Object),
    );
    expect(result).toEqual({ id: 'new-pl-id' });
  });

  test('replacePlaylistItems throws when opts.name is missing', async () => {
    const adapter = new JellyfinAdapter(cfg);
    await expect(adapter.replacePlaylistItems('old', ['i1'], {})).rejects.toThrow(/opts\.name/);
  });

  test('applies a request timeout to HTTP calls', async () => {
    const { REQUEST_TIMEOUT_MS } = require('../baseAdapter');
    axios.get.mockResolvedValueOnce({ data: { Version: '10.9.0' } });
    const adapter = new JellyfinAdapter(cfg);
    await adapter.testConnection();
    expect(axios.get).toHaveBeenCalledWith(
      'http://jf:8096/System/Info/Public',
      expect.objectContaining({ timeout: REQUEST_TIMEOUT_MS })
    );
  });

  test('replacePlaylistItems still creates a fresh playlist when DELETE of stored id fails', async () => {
    axios.delete.mockRejectedValueOnce({ response: { status: 404 } });
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-pl-id' } });
    const adapter = new JellyfinAdapter(cfg);
    const result = await adapter.replacePlaylistItems('stale-id', ['i1'], { name: 'PL' });
    expect(axios.post).toHaveBeenCalled();
    expect(result).toEqual({ id: 'new-pl-id' });
  });

  test('resolveItemIdByFilepath throws MediaServerUnavailableError when the server is unreachable', async () => {
    const { MediaServerUnavailableError } = require('../baseAdapter');
    axios.get.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 192.168.1.174:8096' });
    const adapter = new JellyfinAdapter(cfg);
    await expect(adapter.resolveItemIdByFilepath('/x/v.mp4')).rejects.toBeInstanceOf(MediaServerUnavailableError);
  });

  test('resolveItemIdByFilepath throws MediaServerUnavailableError when the server returns 5xx (loading)', async () => {
    const { MediaServerUnavailableError } = require('../baseAdapter');
    axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 }, message: 'Request failed with status code 503' });
    const adapter = new JellyfinAdapter(cfg);
    await expect(adapter.resolveItemIdByFilepath('/x/v.mp4')).rejects.toBeInstanceOf(MediaServerUnavailableError);
  });

  test('resolveItemIdByFilepath returns null and logs without the API token on a non-unavailable error', async () => {
    const logger = require('../../../../logger');
    const adapter = new JellyfinAdapter({ ...cfg, jellyfinApiKey: 'SUPER_SECRET_TOKEN' });
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
    const adapter = new JellyfinAdapter(cfg);
    const id = await adapter.resolveItemIdByFilepath('/youtube/ChanA/Song [aud1].mp3');
    expect(id).toBe('T1');
    expect(axios.get.mock.calls[0][1].params.includeItemTypes).toBe('Audio');
  });

  test('resolveItemIdByFilepath keeps video item types for non-mp3 files', async () => {
    axios.get.mockResolvedValueOnce({ data: { Items: [] } });
    const adapter = new JellyfinAdapter(cfg);
    await adapter.resolveItemIdByFilepath('/youtube/ChanA/Video [v1].mp4');
    expect(axios.get.mock.calls[0][1].params.includeItemTypes).toBe('Video,Movie,Episode');
  });

  test('createPlaylist with mediaType audio sends MediaType Audio', async () => {
    axios.post.mockResolvedValueOnce({ data: { Id: 'pl1' } });
    const adapter = new JellyfinAdapter(cfg);
    await adapter.createPlaylist('YT: Audio PL', ['T1'], { public: false, mediaType: 'audio' });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      expect.objectContaining({ MediaType: 'Audio' }),
      expect.any(Object)
    );
  });

  test('replacePlaylistItems recreates with the given mediaType', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.post.mockResolvedValueOnce({ data: { Id: 'new-id' } });
    const adapter = new JellyfinAdapter(cfg);
    await adapter.replacePlaylistItems('old-id', ['T1'], { name: 'YT: Audio PL', public: false, mediaType: 'audio' });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/Playlists'),
      expect.objectContaining({ MediaType: 'Audio' }),
      expect.any(Object)
    );
  });
});
