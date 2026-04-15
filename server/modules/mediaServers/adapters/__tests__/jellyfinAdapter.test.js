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
    axios.delete.mockResolvedValueOnce({});
    const adapter = new JellyfinAdapter(cfg);
    await expect(adapter.replacePlaylistItems('old', ['i1'], {})).rejects.toThrow(/opts\.name/);
  });
});
