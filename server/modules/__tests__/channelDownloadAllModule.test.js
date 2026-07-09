jest.mock('../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../models', () => ({
  Video: { findAll: jest.fn() },
  Channel: { findOne: jest.fn() },
}));
jest.mock('../downloadModule', () => ({ doSpecificDownloads: jest.fn() }));
jest.mock('../../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const ChannelVideo = require('../../models/channelvideo');
const { Video, Channel } = require('../../models');
const downloadModule = require('../downloadModule');
const channelDownloadAllModule = require('../channelDownloadAllModule');

const CHANNEL_ID = 'UC123';
const channelRow = { channel_id: CHANNEL_ID, title: 'My Channel' };

function cv(youtubeId, overrides = {}) {
  return {
    youtube_id: youtubeId,
    duration: 60,
    availability: null,
    live_status: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  ChannelVideo.findAll.mockResolvedValue([]);
  Video.findAll.mockResolvedValue([]);
  Channel.findOne.mockResolvedValue(channelRow);
  downloadModule.doSpecificDownloads.mockResolvedValue(undefined);
});

describe('getDownloadableVideos', () => {
  it('queries only non-ignored, non-removed rows for the tab media type', async () => {
    await channelDownloadAllModule.getDownloadableVideos(CHANNEL_ID, 'videos');

    expect(ChannelVideo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channel_id: CHANNEL_ID,
          media_type: 'video',
          ignored: false,
          youtube_removed: false,
        },
      })
    );
  });

  it('maps the shorts tab to the short media type', async () => {
    await channelDownloadAllModule.getDownloadableVideos(CHANNEL_ID, 'shorts');

    expect(ChannelVideo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ media_type: 'short' }),
      })
    );
  });

  it('excludes members-only, live, and upcoming videos', async () => {
    ChannelVideo.findAll.mockResolvedValue([
      cv('ok1'),
      cv('members', { availability: 'subscriber_only' }),
      cv('live', { live_status: 'is_live' }),
      cv('upcoming', { live_status: 'is_upcoming' }),
      cv('ok2', { live_status: 'was_live' }),
    ]);

    const result = await channelDownloadAllModule.getDownloadableVideos(CHANNEL_ID, 'videos');

    expect(result.map((v) => v.youtube_id)).toEqual(['ok1', 'ok2']);
  });

  it('excludes every previously downloaded video, including deleted ones', async () => {
    // Deleted videos (removed: true) stay in the yt-dlp archive, so they would
    // be silently skipped anyway; excluding them keeps the preview count honest.
    ChannelVideo.findAll.mockResolvedValue([cv('a'), cv('b'), cv('c')]);
    Video.findAll.mockResolvedValue([
      { youtubeId: 'a', removed: false },
      { youtubeId: 'b', removed: true },
    ]);

    const result = await channelDownloadAllModule.getDownloadableVideos(CHANNEL_ID, 'videos');

    expect(result.map((v) => v.youtube_id)).toEqual(['c']);
    expect(Video.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { youtubeId: ['a', 'b', 'c'] } })
    );
  });

  it('does not query the videos table when no candidates exist', async () => {
    ChannelVideo.findAll.mockResolvedValue([]);

    const result = await channelDownloadAllModule.getDownloadableVideos(CHANNEL_ID, 'videos');

    expect(result).toEqual([]);
    expect(Video.findAll).not.toHaveBeenCalled();
  });
});

describe('getPreview', () => {
  it('returns count, total duration, and missing-duration count', async () => {
    ChannelVideo.findAll.mockResolvedValue([
      cv('a', { duration: 120 }),
      cv('b', { duration: 30 }),
      cv('c', { duration: null }),
    ]);

    const preview = await channelDownloadAllModule.getPreview(CHANNEL_ID, 'videos');

    expect(preview).toEqual({
      count: 3,
      totalDurationSeconds: 150,
      missingDurations: 1,
    });
  });

  it('throws CHANNEL_NOT_FOUND for an unknown channel', async () => {
    Channel.findOne.mockResolvedValue(null);

    await expect(
      channelDownloadAllModule.getPreview('UCmissing', 'videos')
    ).rejects.toThrow('CHANNEL_NOT_FOUND');
  });
});

describe('startDownloadAll', () => {
  it('queues a specific-downloads job with watch URLs, channel id, and job label', async () => {
    ChannelVideo.findAll.mockResolvedValue([cv('a'), cv('b')]);

    const result = await channelDownloadAllModule.startDownloadAll(CHANNEL_ID, 'videos', {
      resolution: '720',
    });

    expect(result).toEqual({ queued: 2 });
    expect(downloadModule.doSpecificDownloads).toHaveBeenCalledWith({
      body: {
        urls: [
          'https://www.youtube.com/watch?v=a',
          'https://www.youtube.com/watch?v=b',
        ],
        overrideSettings: { resolution: '720' },
        channelId: CHANNEL_ID,
        jobLabel: 'Channel Download All: My Channel',
      },
    });
  });

  it('strips allowRedownload from override settings before queueing', async () => {
    ChannelVideo.findAll.mockResolvedValue([cv('a')]);

    await channelDownloadAllModule.startDownloadAll(CHANNEL_ID, 'videos', {
      resolution: '720',
      allowRedownload: true,
    });

    expect(downloadModule.doSpecificDownloads).toHaveBeenCalledWith({
      body: expect.objectContaining({
        overrideSettings: { resolution: '720' },
      }),
    });
  });

  it('does not queue a job when there is nothing to download', async () => {
    ChannelVideo.findAll.mockResolvedValue([]);

    const result = await channelDownloadAllModule.startDownloadAll(CHANNEL_ID, 'videos', {});

    expect(result).toEqual({ queued: 0 });
    expect(downloadModule.doSpecificDownloads).not.toHaveBeenCalled();
  });

  it('throws CHANNEL_NOT_FOUND for an unknown channel', async () => {
    Channel.findOne.mockResolvedValue(null);

    await expect(
      channelDownloadAllModule.startDownloadAll('UCmissing', 'videos', {})
    ).rejects.toThrow('CHANNEL_NOT_FOUND');
  });
});
