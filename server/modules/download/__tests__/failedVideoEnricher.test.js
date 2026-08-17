/* eslint-env jest */

jest.mock('../../../logger');
jest.mock('../../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlistvideo', () => ({ findAll: jest.fn() }));

const Video = require('../../../models/video');
const Channel = require('../../../models/channel');
const ChannelVideo = require('../../../models/channelvideo');
const PlaylistVideo = require('../../../models/playlistvideo');
const logger = require('../../../logger');
const { enrichFailedVideos } = require('../failedVideoEnricher');

describe('enrichFailedVideos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Video.findAll.mockResolvedValue([]);
    Channel.findAll.mockResolvedValue([]);
    ChannelVideo.findAll.mockResolvedValue([]);
    PlaylistVideo.findAll.mockResolvedValue([]);
  });

  test('fills title and channel from the videos table', async () => {
    Video.findAll.mockResolvedValue([
      { youtubeId: 'abc123def45', youTubeVideoName: 'Real Title', youTubeChannelName: 'Real Channel' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', error: 'HTTP Error 403: Forbidden' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Real Title');
    expect(failed[0].channel).toBe('Real Channel');
  });

  test('falls back to channelvideos with the channel name from channels', async () => {
    ChannelVideo.findAll.mockResolvedValue([
      { youtube_id: 'abc123def45', title: 'Tracked Title', channel_id: 'UCxx' }
    ]);
    Channel.findAll.mockResolvedValue([{ channel_id: 'UCxx', uploader: 'Tracked Channel' }]);
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Tracked Title');
    expect(failed[0].channel).toBe('Tracked Channel');
  });

  test('falls back to playlistvideos title and channel_name', async () => {
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'abc123def45', title: 'Playlist Title', channel_name: 'Playlist Channel' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Playlist Title');
    expect(failed[0].channel).toBe('Playlist Channel');
  });

  test('prefers the videos table over the other sources', async () => {
    Video.findAll.mockResolvedValue([
      { youtubeId: 'abc123def45', youTubeVideoName: 'Video Title', youTubeChannelName: 'Video Channel' }
    ]);
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'abc123def45', title: 'Playlist Title', channel_name: 'Playlist Channel' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Video Title');
    expect(failed[0].channel).toBe('Video Channel');
  });

  test('leaves fields unset when nothing is known', async () => {
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBeUndefined();
    expect(failed[0].channel).toBeUndefined();
  });

  test('does not overwrite fields that are already present', async () => {
    Video.findAll.mockResolvedValue([
      { youtubeId: 'abc123def45', youTubeVideoName: 'DB Title', youTubeChannelName: 'DB Channel' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', title: 'Existing Title', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Existing Title');
    expect(failed[0].channel).toBe('DB Channel');
  });

  test('makes no queries when every record already has title and channel', async () => {
    const failed = [{ youtubeId: 'abc123def45', title: 'T', channel: 'C', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(Video.findAll).not.toHaveBeenCalled();
    expect(ChannelVideo.findAll).not.toHaveBeenCalled();
    expect(PlaylistVideo.findAll).not.toHaveBeenCalled();
  });

  test('ignores the Unknown Channel placeholder from the videos table', async () => {
    Video.findAll.mockResolvedValue([
      { youtubeId: 'abc123def45', youTubeVideoName: 'Video Title', youTubeChannelName: 'Unknown Channel' }
    ]);
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'abc123def45', title: null, channel_name: 'Real Channel' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].title).toBe('Video Title');
    expect(failed[0].channel).toBe('Real Channel');
  });

  test('falls back to channels.title when uploader is null', async () => {
    ChannelVideo.findAll.mockResolvedValue([
      { youtube_id: 'abc123def45', title: 'Tracked Title', channel_id: 'UCxx' }
    ]);
    Channel.findAll.mockResolvedValue([
      { channel_id: 'UCxx', uploader: null, title: 'Channel Title' }
    ]);
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await enrichFailedVideos(failed);

    expect(failed[0].channel).toBe('Channel Title');
  });

  test('survives a query failure without throwing', async () => {
    Video.findAll.mockRejectedValue(new Error('db down'));
    const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

    await expect(enrichFailedVideos(failed)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
    expect(failed[0].title).toBeUndefined();
  });
});
