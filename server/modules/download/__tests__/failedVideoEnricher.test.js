/* eslint-env jest */

jest.mock('../../../logger');
jest.mock('../../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlistvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../videoOembedEnricher', () => ({ enrichByIds: jest.fn() }));

const Video = require('../../../models/video');
const Channel = require('../../../models/channel');
const ChannelVideo = require('../../../models/channelvideo');
const PlaylistVideo = require('../../../models/playlistvideo');
const videoOembedEnricher = require('../../videoOembedEnricher');
const logger = require('../../../logger');
const { enrichFailedVideos, OEMBED_LOOKUP_LIMIT } = require('../failedVideoEnricher');

describe('enrichFailedVideos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Video.findAll.mockResolvedValue([]);
    Channel.findAll.mockResolvedValue([]);
    ChannelVideo.findAll.mockResolvedValue([]);
    PlaylistVideo.findAll.mockResolvedValue([]);
    videoOembedEnricher.enrichByIds.mockResolvedValue({});
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

  describe('oEmbed fallback', () => {
    test('fills title and channel from oEmbed when the database has never seen the video', async () => {
      videoOembedEnricher.enrichByIds.mockResolvedValue({
        abc123def45: { title: 'Fresh Upload', channelName: 'Fresh Channel' }
      });
      const failed = [{ youtubeId: 'abc123def45', error: 'Sign in to confirm you’re not a bot' }];

      await enrichFailedVideos(failed);

      expect(videoOembedEnricher.enrichByIds).toHaveBeenCalledWith(['abc123def45']);
      expect(failed[0].title).toBe('Fresh Upload');
      expect(failed[0].channel).toBe('Fresh Channel');
    });

    test('asks oEmbed only about videos the database could not title', async () => {
      Video.findAll.mockResolvedValue([
        { youtubeId: 'known0000001', youTubeVideoName: 'Known Title', youTubeChannelName: 'Known Channel' }
      ]);
      const failed = [
        { youtubeId: 'known0000001', error: 'err' },
        { youtubeId: 'fresh0000002', error: 'err' }
      ];

      await enrichFailedVideos(failed);

      expect(videoOembedEnricher.enrichByIds).toHaveBeenCalledWith(['fresh0000002']);
    });

    test('skips oEmbed entirely when the database titled every video', async () => {
      Video.findAll.mockResolvedValue([
        { youtubeId: 'abc123def45', youTubeVideoName: 'Known Title', youTubeChannelName: null }
      ]);
      const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

      await enrichFailedVideos(failed);

      expect(videoOembedEnricher.enrichByIds).not.toHaveBeenCalled();
    });

    test('caps the oEmbed lookup at OEMBED_LOOKUP_LIMIT ids per job', async () => {
      const failed = Array.from({ length: OEMBED_LOOKUP_LIMIT + 5 }, (_, i) => ({
        youtubeId: `vid${String(i).padStart(8, '0')}`,
        error: 'err'
      }));

      await enrichFailedVideos(failed);

      const requested = videoOembedEnricher.enrichByIds.mock.calls[0][0];
      expect(requested).toHaveLength(OEMBED_LOOKUP_LIMIT);
      expect(requested[0]).toBe('vid00000000');
    });

    test('keeps the database result when oEmbed also answers for the same id', async () => {
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'abc123def45', title: null, channel_id: 'UCxx' }
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCxx', uploader: 'Tracked Channel' }]);
      videoOembedEnricher.enrichByIds.mockResolvedValue({
        abc123def45: { title: 'Fresh Upload', channelName: 'oEmbed Channel' }
      });
      const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

      await enrichFailedVideos(failed);

      expect(failed[0].title).toBe('Fresh Upload');
      expect(failed[0].channel).toBe('Tracked Channel');
    });

    test('survives an oEmbed failure without throwing', async () => {
      videoOembedEnricher.enrichByIds.mockRejectedValue(new Error('network down'));
      const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

      await expect(enrichFailedVideos(failed)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
      expect(failed[0].title).toBeUndefined();
    });

    test('still asks oEmbed when the database lookup itself failed', async () => {
      Video.findAll.mockRejectedValue(new Error('db down'));
      videoOembedEnricher.enrichByIds.mockResolvedValue({
        abc123def45: { title: 'Fresh Upload', channelName: 'Fresh Channel' }
      });
      const failed = [{ youtubeId: 'abc123def45', error: 'err' }];

      await enrichFailedVideos(failed);

      expect(failed[0].title).toBe('Fresh Upload');
    });
  });
});
