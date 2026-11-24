/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../../models/channelvideo', () => mockFactories.mockChannelVideoModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../../db', () => mockFactories.mockDb());
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());

describe('channelVideoFetcher', () => {
  let channelVideoFetcher;
  let Channel;
  let youtubeApi;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    youtubeApi = require('../../youtubeApi');
    youtubeApi.isAvailable.mockReturnValue(false);
    youtubeApi.getApiKey.mockReturnValue(null);

    channelVideoFetcher = require('../channelVideoFetcher');
  });

  describe('fetchChannelVideos - yt-dlp path', () => {
    beforeEach(() => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UCxxx',
        default_rating: null,
        url: 'https://www.youtube.com/@chan',
      });
    });

    test('uses yt-dlp even when YouTube API is available', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [{ id: 'v1id', title: 'V1', duration: 300, timestamp: 1714521600 }],
        uploader_url: 'https://www.youtube.com/@chan',
      }));

      const result = await channelVideoFetcher.fetchChannelVideos('UCxxx', null, 'videos');

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toMatchObject({
        youtube_id: 'v1id',
        title: 'V1',
        duration: 300,
        media_type: 'video',
      });
      expect(channelYtdlpExecutor.executeYtDlpCommand).toHaveBeenCalled();
    });
  });

  describe('fetchAndSaveVideosViaYtDlp - terminated_at clearing', () => {
    let sequelize;

    beforeEach(() => {
      ({ sequelize } = require('../../../db'));
      const channelVideoWriter = require('../channelVideoWriter');
      sequelize.query.mockResolvedValue([]);

      jest.spyOn(channelVideoFetcher, 'fetchChannelVideos').mockResolvedValue({
        videos: [],
        currentChannelUrl: 'https://www.youtube.com/@chan'
      });
      jest.spyOn(channelVideoWriter, 'insertVideosIntoDb').mockResolvedValue();
    });

    test('clears terminated_at when fetch succeeds on a previously terminated channel', async () => {
      const channel = {
        channel_id: 'UC123',
        title: 'Test',
        url: 'https://www.youtube.com/@chan',
        terminated_at: new Date('2026-03-01T00:00:00Z'),
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue()
      };

      await channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel, 'UC123', 'videos', null);

      expect(channel.update).toHaveBeenCalledWith({ terminated_at: null });
    });

    test('does not touch terminated_at on a channel that was never terminated', async () => {
      const channel = {
        channel_id: 'UC123',
        title: 'Test',
        url: 'https://www.youtube.com/@chan',
        terminated_at: null,
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue()
      };

      await channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel, 'UC123', 'videos', null);

      expect(channel.update).not.toHaveBeenCalled();
    });

    test('does not clear terminated_at when fetch throws (channel still unreachable)', async () => {
      channelVideoFetcher.fetchChannelVideos.mockRejectedValueOnce(new Error('yt-dlp failed: account terminated'));

      const channel = {
        channel_id: 'UC123',
        title: 'Test',
        url: 'https://www.youtube.com/@chan',
        terminated_at: new Date('2026-03-01T00:00:00Z'),
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue()
      };

      await expect(
        channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel, 'UC123', 'videos', null)
      ).rejects.toThrow('yt-dlp failed');

      expect(channel.update).not.toHaveBeenCalled();
    });

    test('swallows clear failure so the page load is not broken by a stuck UPDATE', async () => {
      const channel = {
        channel_id: 'UC123',
        title: 'Test',
        url: 'https://www.youtube.com/@chan',
        terminated_at: new Date('2026-03-01T00:00:00Z'),
        reload: jest.fn(),
        update: jest.fn().mockRejectedValue(new Error('db down'))
      };

      // Fetch and timestamp update both succeed; only the clear fails.
      await expect(
        channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel, 'UC123', 'videos', null)
      ).resolves.toEqual({ newVideos: 0 });

      expect(channel.update).toHaveBeenCalledWith({ terminated_at: null });
      const logger = require('../../../logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123' }),
        'Failed to clear terminated_at after successful video fetch'
      );
    });
  });

  describe('fetchAndSaveVideosViaYtDlp - new video count', () => {
    const channel = () => ({
      channel_id: 'UC123',
      title: 'Test',
      url: 'https://www.youtube.com/@chan',
      terminated_at: null,
      reload: jest.fn(),
      update: jest.fn().mockResolvedValue(),
    });

    beforeEach(() => {
      const { sequelize } = require('../../../db');
      sequelize.query.mockResolvedValue([]);
    });

    test('resolves the number of new videos', async () => {
      const channelVideoWriter = require('../channelVideoWriter');
      jest.spyOn(channelVideoFetcher, 'fetchChannelVideos').mockResolvedValue({
        videos: [{ youtube_id: 'a' }, { youtube_id: 'b' }, { youtube_id: 'c' }],
        currentChannelUrl: 'https://www.youtube.com/@chan',
      });
      jest.spyOn(channelVideoWriter, 'insertVideosIntoDb').mockResolvedValue({ created: 2 });

      const result = await channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel(), 'UC123', 'videos', null);

      expect(result).toEqual({ newVideos: 2 });
    });

    test('resolves zero new videos when the tab lists nothing', async () => {
      jest.spyOn(channelVideoFetcher, 'fetchChannelVideos').mockResolvedValue({
        videos: [],
        currentChannelUrl: 'https://www.youtube.com/@chan',
      });

      const result = await channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel(), 'UC123', 'videos', null);

      expect(result).toEqual({ newVideos: 0 });
    });
  });

  describe('refreshTabTracked', () => {
    const KEY = 'UC123:videos';
    let fetchRegistry;
    let channel;

    beforeEach(() => {
      fetchRegistry = require('../fetchRegistry');
      const { sequelize } = require('../../../db');
      sequelize.query.mockResolvedValue([]);
      const channelVideoWriter = require('../channelVideoWriter');
      jest.spyOn(channelVideoWriter, 'insertVideosIntoDb').mockResolvedValue({ created: 2 });
      jest.spyOn(channelVideoFetcher, 'fetchChannelVideos').mockResolvedValue({
        videos: [{ youtube_id: 'a' }, { youtube_id: 'b' }],
        currentChannelUrl: 'https://www.youtube.com/@chan',
      });
      channel = {
        channel_id: 'UC123',
        title: 'Test',
        url: 'https://www.youtube.com/@chan',
        terminated_at: null,
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue(),
      };
    });

    test('resolves the number of new videos', async () => {
      const result = await channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'autoRefresh' });

      expect(result).toEqual({ skipped: false, newVideos: 2 });
    });

    test('records the finished result', async () => {
      await channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'autoRefresh' });

      expect(fetchRegistry.has(KEY)).toBe(false);
      expect(fetchRegistry.getLastResult(KEY)).toEqual(
        expect.objectContaining({ type: 'autoRefresh', newVideos: 2, failed: false })
      );
    });

    test('registers the tab as being fetched while the listing runs', async () => {
      let finishListing;
      channelVideoFetcher.fetchChannelVideos.mockReturnValue(new Promise((resolve) => {
        finishListing = () => resolve({ videos: [], currentChannelUrl: 'https://www.youtube.com/@chan' });
      }));

      const refresh = channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'feedCheck' });

      expect(fetchRegistry.get(KEY)).toEqual({
        startTime: expect.any(String),
        type: 'feedCheck',
        tabType: 'videos',
      });
      finishListing();
      await refresh;
    });

    test('skips a tab that is already being fetched', async () => {
      fetchRegistry.set(KEY, { startTime: 'x', type: 'fetchAll', tabType: 'videos' });

      const result = await channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'autoRefresh' });

      expect(result).toEqual({ skipped: true });
      expect(channelVideoFetcher.fetchChannelVideos).not.toHaveBeenCalled();
      expect(fetchRegistry.get(KEY).type).toBe('fetchAll');
    });

    test('records a failure and rethrows', async () => {
      channelVideoFetcher.fetchChannelVideos.mockRejectedValue(new Error('yt-dlp failed'));

      await expect(
        channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'autoRefresh' })
      ).rejects.toThrow('yt-dlp failed');

      expect(fetchRegistry.has(KEY)).toBe(false);
      expect(fetchRegistry.getLastResult(KEY)).toEqual(
        expect.objectContaining({ type: 'autoRefresh', newVideos: 0, failed: true })
      );
    });

    test('hands the newest known video date to the listing', async () => {
      const newest = new Date('2026-11-10T00:00:00Z');

      await channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', {
        type: 'autoRefresh',
        mostRecentVideoDate: newest,
      });

      expect(channelVideoFetcher.fetchChannelVideos).toHaveBeenCalledWith('UC123', newest, 'videos');
    });

    test('lists without a newest date when none is given', async () => {
      await channelVideoFetcher.refreshTabTracked(channel, 'UC123', 'videos', { type: 'feedCheck' });

      expect(channelVideoFetcher.fetchChannelVideos).toHaveBeenCalledWith('UC123', null, 'videos');
    });
  });
});
