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
});
