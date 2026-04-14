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

  test('replacePlaylistItems deletes then PUTs', async () => {
    axios.delete.mockResolvedValueOnce({});
    axios.get.mockResolvedValueOnce({
      data: { MediaContainer: { machineIdentifier: 'MACHINE123' } },
    });
    axios.put.mockResolvedValueOnce({});
    const adapter = new PlexAdapter(cfg);
    await adapter.replacePlaylistItems('100', ['42', '43']);
    expect(axios.delete).toHaveBeenCalled();
    expect(axios.put).toHaveBeenCalled();
  });
});
