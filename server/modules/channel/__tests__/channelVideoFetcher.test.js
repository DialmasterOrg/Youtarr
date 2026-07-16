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

  const mockChannelData = {
    channel_id: 'UC123456',
    title: 'Test Channel',
    description: 'Test Description',
    uploader: 'Test Uploader',
    url: 'https://www.youtube.com/@testchannel',
    lastFetchedByTab: JSON.stringify({ video: new Date('2024-01-01').toISOString() })
  };

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

  describe('shouldRefreshChannelVideos', () => {
    test('should refresh if no channel record', () => {
      const result = channelVideoFetcher.shouldRefreshChannelVideos(null, 10, 'video');
      expect(result).toBe(false);
    });

    test('should refresh if no lastFetchedByTab for this tab', () => {
      const channel = { ...mockChannelData, lastFetchedByTab: null };
      const result = channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'video');
      expect(result).toBe(true);
    });

    test('should refresh if lastFetchedByTab is old for this tab', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
      };
      const result = channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'video');
      expect(result).toBe(true);
    });

    test('should refresh if no videos for this tab', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() })
      };
      const result = channelVideoFetcher.shouldRefreshChannelVideos(channel, 0, 'video');
      expect(result).toBe(true);
    });

    test('should not refresh if recently fetched with videos for this tab', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() })
      };
      const result = channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'video');
      expect(result).toBe(false);
    });

    test('should refresh different tab independently', () => {
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString(), short: null })
      };
      // Video tab was just fetched, should not refresh
      expect(channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'video')).toBe(false);
      // Short tab has never been fetched, should refresh
      expect(channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'short')).toBe(true);
    });

    test('forces a refresh on terminated channels even with a fresh cache', () => {
      // Without the terminated_at short-circuit, a recent fetch would skip
      // yt-dlp on page load and the termination notice would persist.
      const channel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() }),
        terminated_at: new Date('2026-03-01T00:00:00Z')
      };
      expect(channelVideoFetcher.shouldRefreshChannelVideos(channel, 10, 'video')).toBe(true);
    });
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
      ).resolves.toBeUndefined();

      expect(channel.update).toHaveBeenCalledWith({ terminated_at: null });
      const logger = require('../../../logger');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123' }),
        'Failed to clear terminated_at after successful video fetch'
      );
    });
  });
});
