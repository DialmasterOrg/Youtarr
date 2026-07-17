/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../../models/channelvideo', () => mockFactories.mockChannelVideoModel());
jest.mock('../../../models/video', () => mockFactories.mockVideoModel());
jest.mock('../../../models/videowatchstatus', () => mockFactories.mockVideoWatchStatusModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../fileCheckModule', () => mockFactories.mockFileCheckModule());
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());
jest.mock('../../../db', () => mockFactories.mockDb());

describe('channelVideosService', () => {
  let channelVideosService;
  let Channel;
  let ChannelVideo;
  let logger;
  let youtubeApi;

  const mockChannelData = {
    channel_id: 'UC123456',
    title: 'Test Channel',
    description: 'Test Description',
    uploader: 'Test Uploader',
    url: 'https://www.youtube.com/@testchannel',
    lastFetchedByTab: JSON.stringify({ video: new Date('2024-01-01').toISOString() })
  };

  const mockVideoData = {
    youtube_id: 'video123',
    title: 'Test Video',
    thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
    duration: 600,
    publishedAt: '2024-01-01T00:00:00Z',
    availability: 'public'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    ChannelVideo = require('../../../models/channelvideo');

    logger = require('../../../logger');

    youtubeApi = require('../../youtubeApi');
    youtubeApi.isAvailable.mockReturnValue(false);
    youtubeApi.getApiKey.mockReturnValue(null);

    channelVideosService = require('../channelVideosService');
  });

  describe('buildChannelVideosResponse', () => {
    test('should build successful response with tab-specific lastFetched', () => {
      const videos = [mockVideoData];
      const channel = mockChannelData;

      const result = channelVideosService.buildChannelVideosResponse(videos, channel, 'yt_dlp', null, false, 'video');

      expect(result).toEqual({
        videos: videos,
        dataSource: 'yt_dlp',
        lastFetched: new Date('2024-01-01'),
        totalCount: videos.length,
        oldestVideoDate: null,
        autoDownloadsEnabled: false,
        availableTabs: []
      });
    });

    test('should build response with empty videos array', () => {
      const result = channelVideosService.buildChannelVideosResponse([], mockChannelData, 'cache', null, false, 'video');

      expect(result).toEqual({
        videos: [],
        dataSource: 'cache',
        lastFetched: new Date('2024-01-01'),
        totalCount: 0,
        oldestVideoDate: null,
        autoDownloadsEnabled: false,
        availableTabs: []
      });
    });

    test('should return null lastFetched for unfetched tab', () => {
      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', null, false, 'short');
      expect(result.lastFetched).toBeNull();
    });

    test('should handle null channel', () => {
      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], null);

      expect(result.lastFetched).toBeNull();
    });

    test('should include stats when provided', () => {
      const stats = {
        totalCount: 150,
        oldestVideoDate: '2023-01-01T00:00:00Z'
      };
      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', stats);

      expect(result.totalCount).toBe(150);
      expect(result.oldestVideoDate).toBe('2023-01-01T00:00:00Z');
    });

    test('should reflect stats totalCount when videos are empty', () => {
      const stats = {
        totalCount: 50,
        oldestVideoDate: '2023-01-01T00:00:00Z'
      };
      const result = channelVideosService.buildChannelVideosResponse([], mockChannelData, 'cache', stats);

      expect(result.totalCount).toBe(50);
      expect(result.oldestVideoDate).toBe('2023-01-01T00:00:00Z');
    });

    test('should include autoDownloadsEnabled parameter', () => {
      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', null, true);

      expect(result.autoDownloadsEnabled).toBe(true);
    });

    test('should default autoDownloadsEnabled to false', () => {
      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache');

      expect(result.autoDownloadsEnabled).toBe(false);
    });
  });

  describe('getChannelVideos', () => {
    test('should return paginated videos with stats', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() }),
        auto_download_enabled_tabs: 'video'
      };
      const mockVideos = [
        { youtube_id: 'video1', publishedAt: new Date().toISOString(), toJSON() { return this; } }
      ];

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      ChannelVideo.count.mockResolvedValue(10);
      ChannelVideo.findOne.mockResolvedValue({ publishedAt: '2023-01-01' });
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideosService.getChannelVideos('UC123', 1, 50);

      expect(result.videos).toBeDefined();
      expect(result.totalCount).toBe(10);
      expect(result.oldestVideoDate).toBe('2023-01-01');
    });

    test('should skip auto-refresh when fetch already in progress', async () => {
      const Video = require('../../../models/video');
      const mockChannel = { ...mockChannelData, lastFetchedByTab: null, auto_download_enabled_tabs: 'video' };

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue([]);
      ChannelVideo.count.mockResolvedValue(0);
      Video.findAll = jest.fn().mockResolvedValue([]);

      // Simulate an active fetch using composite key (channelId:tabType)
      const fetchRegistry = require('../fetchRegistry');
      fetchRegistry.set('UC123:videos', {
        startTime: new Date().toISOString(),
        type: 'fetchAll',
        tabType: 'videos'
      });

      const result = await channelVideosService.getChannelVideos('UC123');

      // Should not throw, should return cached data
      expect(result.videos).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', tabType: 'videos' }),
        'Skipping auto-refresh - fetch already in progress for this tab'
      );

      // Clean up
      fetchRegistry.delete('UC123:videos');
    });

    test('should handle errors and return cached data', async () => {
      const Video = require('../../../models/video');
      const mockChannel = { ...mockChannelData, auto_download_enabled_tabs: 'video' };
      const mockVideos = [
        { youtube_id: 'video1', toJSON() { return this; } }
      ];

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      // Make fetchAndSaveVideosViaYtDlp throw an error
      const channelVideoFetcher = require('../channelVideoFetcher');
      jest.spyOn(channelVideoFetcher, 'fetchAndSaveVideosViaYtDlp').mockRejectedValue(new Error('Network error'));

      const result = await channelVideosService.getChannelVideos('UC123');

      expect(result.videos).toBeDefined();
      // Cached fallback has content, so no user-visible error.
      expect(result.fetchError).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          channelId: 'UC123'
        }),
        'Error fetching channel videos'
      );
    });

    test('should set fetchError=true when catch path yields no cached videos', async () => {
      const Video = require('../../../models/video');
      const mockChannel = { ...mockChannelData, auto_download_enabled_tabs: 'video' };

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue([]);
      ChannelVideo.count.mockResolvedValue(0);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const channelVideoFetcher = require('../channelVideoFetcher');
      jest.spyOn(channelVideoFetcher, 'fetchAndSaveVideosViaYtDlp').mockRejectedValue(new Error('Network error'));

      const result = await channelVideosService.getChannelVideos('UC123');

      expect(result.videos).toEqual([]);
      expect(result.fetchError).toBe(true);
    });

    // freshFetchPerformed is the contract the frontend onFirstLoad latch
    // depends on. It must flip true only when fetchAndSaveVideosViaYtDlp
    // resolves; the cache and cached-fallback paths must NOT set it true.
    // freshFetchPerformed videos are flagged as recently-checked so the
    // post-fetch removal-validation loop short-circuits and we don't hit
    // the unmocked ChannelVideo.update path.
    const freshlyChecked = () => ({
      youtube_id: 'video1',
      youtube_removed: false,
      youtube_removed_checked_at: new Date(),
      toJSON() { return this; }
    });

    test('returns freshFetchPerformed=true when yt-dlp auto-refresh resolves', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        // Stale lastFetched forces shouldRefreshChannelVideos to return true.
        lastFetchedByTab: JSON.stringify({ video: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }),
        auto_download_enabled_tabs: 'video'
      };

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue([freshlyChecked()]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const channelVideoFetcher = require('../channelVideoFetcher');
      jest.spyOn(channelVideoFetcher, 'fetchAndSaveVideosViaYtDlp').mockResolvedValue();

      const result = await channelVideosService.getChannelVideos('UC123');

      expect(channelVideoFetcher.fetchAndSaveVideosViaYtDlp).toHaveBeenCalled();
      expect(result.freshFetchPerformed).toBe(true);
    });

    test('returns freshFetchPerformed=false when cache is fresh enough to skip yt-dlp', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() }),
        auto_download_enabled_tabs: 'video'
      };

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue([freshlyChecked()]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const channelVideoFetcher = require('../channelVideoFetcher');
      const ytdlpSpy = jest.spyOn(channelVideoFetcher, 'fetchAndSaveVideosViaYtDlp').mockResolvedValue();

      const result = await channelVideosService.getChannelVideos('UC123');

      expect(ytdlpSpy).not.toHaveBeenCalled();
      expect(result.freshFetchPerformed).toBe(false);
    });

    test('does not set freshFetchPerformed=true when yt-dlp throws and cache fallback fires', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        lastFetchedByTab: JSON.stringify({ video: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }),
        auto_download_enabled_tabs: 'video'
      };

      Channel.findOne.mockResolvedValue(mockChannel);
      ChannelVideo.findAll.mockResolvedValue([freshlyChecked()]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const channelVideoFetcher = require('../channelVideoFetcher');
      jest.spyOn(channelVideoFetcher, 'fetchAndSaveVideosViaYtDlp').mockRejectedValue(new Error('yt-dlp failed'));

      const result = await channelVideosService.getChannelVideos('UC123');

      expect(result.freshFetchPerformed).toBeFalsy();
    });
  });

  describe('fetchAllChannelVideos', () => {
    test('should fetch all videos and return paginated results', async () => {
      const Video = require('../../../models/video');
      const mockChannel = { ...mockChannelData, save: jest.fn(), reload: jest.fn(), url: 'https://youtube.com/@test' };

      Channel.findOne.mockResolvedValue(mockChannel);

      // Mock executeYtDlpCommand to return video data
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [
          { id: 'video1', title: 'Video 1', timestamp: 1704067200 },
          { id: 'video2', title: 'Video 2', timestamp: 1704067300 }
        ],
        uploader_url: 'https://youtube.com/@test'
      }));

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: '2024-01-02', toJSON() { return this; } }
      ]);
      ChannelVideo.count.mockResolvedValue(2);
      ChannelVideo.findOne.mockResolvedValue({ publishedAt: '2024-01-01' });
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideosService.fetchAllChannelVideos('UC123', 1, 50);

      expect(result.success).toBe(true);
      expect(result.videosFound).toBe(2);
      expect(result.videos).toBeDefined();
      expect(mockChannel.reload).toHaveBeenCalled();
    });

    test('should throw error when fetch already in progress', async () => {
      // Composite key is channelId:tabType
      const fetchRegistry = require('../fetchRegistry');
      fetchRegistry.set('UC123:videos', {
        startTime: new Date().toISOString(),
        type: 'autoRefresh',
        tabType: 'videos'
      });

      await expect(channelVideosService.fetchAllChannelVideos('UC123')).rejects.toThrow('fetch operation is already in progress');

      // Clean up
      fetchRegistry.delete('UC123:videos');
    });

    test('should throw error when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);

      await expect(channelVideosService.fetchAllChannelVideos('UC999')).rejects.toThrow('Channel not found in database');
    });

    test('should clean up activeFetches on error', async () => {
      const fetchRegistry = require('../fetchRegistry');
      const mockChannel = { ...mockChannelData };
      Channel.findOne.mockResolvedValue(mockChannel);

      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockRejectedValue(new Error('yt-dlp error'));

      await expect(channelVideosService.fetchAllChannelVideos('UC123')).rejects.toThrow('yt-dlp error');

      // Verify activeFetches was cleaned up
      expect(fetchRegistry.has('UC123:videos')).toBe(false);
    });

    test('clears terminated_at when a full fetch succeeds on a previously terminated channel', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        save: jest.fn(),
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue(),
        url: 'https://youtube.com/@test',
        terminated_at: new Date('2026-03-01T00:00:00Z')
      };

      Channel.findOne.mockResolvedValue(mockChannel);

      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [{ id: 'v1', title: 'V1', timestamp: 1704067200 }],
        uploader_url: 'https://youtube.com/@test'
      }));

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'v1', toJSON() { return this; } }
      ]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      await channelVideosService.fetchAllChannelVideos('UC123', 1, 50);

      expect(mockChannel.update).toHaveBeenCalledWith({ terminated_at: null });
    });

    test('does not touch terminated_at on a never-terminated channel', async () => {
      const Video = require('../../../models/video');
      const mockChannel = {
        ...mockChannelData,
        save: jest.fn(),
        reload: jest.fn(),
        update: jest.fn().mockResolvedValue(),
        url: 'https://youtube.com/@test',
        terminated_at: null
      };

      Channel.findOne.mockResolvedValue(mockChannel);

      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [{ id: 'v1', title: 'V1', timestamp: 1704067200 }],
        uploader_url: 'https://youtube.com/@test'
      }));

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'v1', toJSON() { return this; } }
      ]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      await channelVideosService.fetchAllChannelVideos('UC123', 1, 50);

      expect(mockChannel.update).not.toHaveBeenCalled();
    });

    test('uses yt-dlp for full fetch even when YouTube API is available', async () => {
      const Video = require('../../../models/video');
      const mockChannel = { ...mockChannelData, save: jest.fn(), reload: jest.fn(), url: 'https://www.youtube.com/@test' };

      Channel.findOne.mockResolvedValue(mockChannel);

      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [{ id: 'yt-v1', title: 'yt-dlp V1', timestamp: 1714521600 }],
        uploader_url: 'https://www.youtube.com/@test',
      }));

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'yt-v1', title: 'yt-dlp V1', toJSON() { return this; } },
      ]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideosService.fetchAllChannelVideos('UC123', 1, 50, 'off', 'videos');

      expect(channelYtdlpExecutor.executeYtDlpCommand).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.videosFound).toBe(1);
    });

    test('should update channel URL if changed', async () => {
      const Video = require('../../../models/video');
      const newUrl = 'https://youtube.com/@newhandle';
      const mockChannel = {
        ...mockChannelData,
        url: 'https://youtube.com/@oldhandle',
        save: jest.fn(),
        reload: jest.fn()
      };

      Channel.findOne.mockResolvedValue(mockChannel);

      const channelYtdlpExecutor = require('../channelYtdlpExecutor');
      jest.spyOn(channelYtdlpExecutor, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
        entries: [{ id: 'video1', title: 'Video 1', timestamp: 1704067200 }],
        uploader_url: newUrl
      }));

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'video1', toJSON() { return this; } }
      ]);
      ChannelVideo.count.mockResolvedValue(1);
      Video.findAll = jest.fn().mockResolvedValue([]);

      await channelVideosService.fetchAllChannelVideos('UC123');

      expect(mockChannel.url).toBe(newUrl);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          channelTitle: expect.any(String),
          oldUrl: expect.any(String),
          newUrl: newUrl
        }),
        'Channel URL updated'
      );
    });
  });

  describe('buildChannelVideosResponse with hidden_tabs', () => {
    test('returns effective availableTabs excluding hidden tabs', () => {
      const channel = {
        ...mockChannelData,
        available_tabs: 'videos,shorts,streams',
        hidden_tabs: 'shorts'
      };

      const result = channelVideosService.buildChannelVideosResponse([mockVideoData], channel, 'cache', null, false, 'video');

      expect(result.availableTabs).toEqual(['videos', 'streams']);
    });
  });
});
