/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channelvideo', () => mockFactories.mockChannelVideoModel());
jest.mock('../../../models/video', () => mockFactories.mockVideoModel());
jest.mock('../../mediaServers/watchStatusQueries', () => ({ getWatchedByMap: jest.fn() }));
jest.mock('../../../db', () => mockFactories.mockDb());
jest.mock('../../fileCheckModule', () => mockFactories.mockFileCheckModule());

describe('channelVideoQuery', () => {
  let channelVideoQuery;
  let ChannelVideo;
  let watchStatusQueries;
  let fileCheckModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    ChannelVideo = require('../../../models/channelvideo');
    watchStatusQueries = require('../../mediaServers/watchStatusQueries');
    watchStatusQueries.getWatchedByMap.mockResolvedValue(new Map());
    fileCheckModule = require('../../fileCheckModule');
    channelVideoQuery = require('../channelVideoQuery');
  });

  describe('enrichVideosWithDownloadStatus', () => {
    test('should add download status to videos based on Videos table', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
        { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) },
        { youtube_id: 'video3', toJSON: () => ({ youtube_id: 'video3' }) }
      ];

      // Mock Videos table response - video1 and video2 are downloaded, video2 is removed
      Video.findAll = jest.fn().mockResolvedValue([
        { youtubeId: 'video1', removed: false },
        { youtubeId: 'video2', removed: true }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: ['video1', 'video2', 'video3']
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);
      expect(result[1].added).toBe(true);
      expect(result[1].removed).toBe(true);
      expect(result[2].added).toBe(false);
      expect(result[2].removed).toBe(false);
    });

    test('should handle plain objects without toJSON', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1' },
        { youtube_id: 'video2' }
      ];

      // Mock Videos table response - only video1 is downloaded
      Video.findAll = jest.fn().mockResolvedValue([
        { youtubeId: 'video1', removed: false }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: ['video1', 'video2']
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);
      expect(result[1].added).toBe(false);
      expect(result[1].removed).toBe(false);
    });

    test('should correctly handle removed videos', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
        { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) },
        { youtube_id: 'video3', toJSON: () => ({ youtube_id: 'video3' }) }
      ];

      // Mock Videos table response - video1 active, video2 removed, video3 not downloaded
      Video.findAll = jest.fn().mockResolvedValue([
        { youtubeId: 'video1', removed: false },
        { youtubeId: 'video2', removed: true }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      // Verify Video1 is added and not removed
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);

      // Verify Video2 is added but marked as removed
      expect(result[1].added).toBe(true);
      expect(result[1].removed).toBe(true);

      // Verify Video3 is not downloaded at all
      expect(result[2].added).toBe(false);
      expect(result[2].removed).toBe(false);
    });

    test('should handle videos with youtubeId field instead of youtube_id', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtubeId: 'video1', toJSON: () => ({ youtubeId: 'video1' }) },
        { youtubeId: 'video2', toJSON: () => ({ youtubeId: 'video2' }) }
      ];

      // Mock Videos table response
      Video.findAll = jest.fn().mockResolvedValue([
        { youtubeId: 'video1', removed: false }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: ['video1', 'video2']
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);
      expect(result[1].added).toBe(false);
      expect(result[1].removed).toBe(false);
    });

    test('should handle mixed field names (youtube_id and youtubeId)', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1' },
        { youtubeId: 'video2' },
        { youtube_id: 'video3', toJSON: () => ({ youtube_id: 'video3' }) }
      ];

      // Mock Videos table response
      Video.findAll = jest.fn().mockResolvedValue([
        { youtubeId: 'video2', removed: true },
        { youtubeId: 'video3', removed: false }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: ['video1', 'video2', 'video3']
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });

      // Video1 - not downloaded
      expect(result[0].added).toBe(false);
      expect(result[0].removed).toBe(false);

      // Video2 - downloaded but removed
      expect(result[1].added).toBe(true);
      expect(result[1].removed).toBe(true);

      // Video3 - downloaded and not removed
      expect(result[2].added).toBe(true);
      expect(result[2].removed).toBe(false);
    });

    test('should handle empty video list', async () => {
      const Video = require('../../../models/video');
      const videos = [];

      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: []
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });
      expect(result).toEqual([]);
    });

    test('should check file existence when checkFiles=true', async () => {
      const Video = require('../../../models/video');
      const { sequelize, Sequelize } = require('../../../db');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
        { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) }
      ];

      // Mock Videos table response with file paths
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 2000, filePath: '/path/to/video2.mp4' }
      ]);

      // Mock file check module
      fileCheckModule.checkVideoFiles.mockResolvedValue({
        videos: [
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000 },
          { id: 2, youtubeId: 'video2', removed: true, fileSize: 0 } // File not found
        ],
        updates: [
          { id: 2, removed: true, fileSize: null }
        ]
      });

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos, true);

      expect(fileCheckModule.checkVideoFiles).toHaveBeenCalledWith([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 2000, filePath: '/path/to/video2.mp4' }
      ]);
      expect(fileCheckModule.applyVideoUpdates).toHaveBeenCalledWith(
        sequelize,
        Sequelize,
        [{ id: 2, removed: true, fileSize: null }]
      );
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);
      expect(result[1].added).toBe(true);
      expect(result[1].removed).toBe(true);
    });

    test('should not check files when checkFiles=false', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) }
      ];

      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' }
      ]);

      await channelVideoQuery.enrichVideosWithDownloadStatus(videos, false);

      expect(fileCheckModule.checkVideoFiles).not.toHaveBeenCalled();
      expect(fileCheckModule.applyVideoUpdates).not.toHaveBeenCalled();
    });

    test('should handle fileSize in enriched videos', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) }
      ];

      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 5000, filePath: '/path/to/video1.mp4' }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(result[0].fileSize).toBe(5000);
    });

    test('should expose timeCreated from last_downloaded_at for downloaded videos and omit it for others', async () => {
      const Video = require('../../../models/video');

      const videos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
        { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) },
        { youtube_id: 'video3', toJSON: () => ({ youtube_id: 'video3' }) }
      ];

      const downloadedAt = new Date('2026-04-20T16:20:00Z');

      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, last_downloaded_at: downloadedAt },
        { id: 2, youtubeId: 'video2', removed: false, last_downloaded_at: null }
      ]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(videos);

      expect(result[0].timeCreated).toBe(downloadedAt.toISOString());
      expect(result[1].timeCreated).toBeNull();
      expect(result[2].timeCreated).toBeUndefined();
    });

    test('stamps watchedBy from played watch-status rows onto downloaded videos', async () => {
      const Video = require('../../../models/video');

      const inputVideos = [
        { youtube_id: 'vid1', toJSON: () => ({ youtube_id: 'vid1' }) },
        { youtube_id: 'vid2', toJSON: () => ({ youtube_id: 'vid2' }) }
      ];

      Video.findAll = jest.fn().mockResolvedValue([
        { id: 7, youtubeId: 'vid1', removed: false }
      ]);
      watchStatusQueries.getWatchedByMap.mockResolvedValueOnce(
        new Map([[7, ['plex', 'jellyfin']]])
      );

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(inputVideos);

      expect(watchStatusQueries.getWatchedByMap).toHaveBeenCalledWith([7]);
      expect(result[0].watchedBy).toEqual(['plex', 'jellyfin']);
      expect(result[1].watchedBy).toEqual([]);
    });

    test('stamps empty watchedBy when no videos are downloaded', async () => {
      const Video = require('../../../models/video');

      const inputVideos = [
        { youtube_id: 'vid1', toJSON: () => ({ youtube_id: 'vid1' }) },
        { youtube_id: 'vid2', toJSON: () => ({ youtube_id: 'vid2' }) }
      ];

      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.enrichVideosWithDownloadStatus(inputVideos);

      expect(watchStatusQueries.getWatchedByMap).toHaveBeenCalledWith([]);
      expect(result[0].watchedBy).toEqual([]);
    });
  });

  describe('fetchNewestVideosFromDb', () => {
    test('should fetch videos from database with download status', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
        { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);

      // Mock Videos table response - only video1 is downloaded
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123');

      expect(ChannelVideo.findAll).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'video' },
        order: [['publishedAt', 'DESC']]
      });
      expect(Video.findAll).toHaveBeenCalledWith({
        where: {
          youtubeId: ['video1', 'video2']
        },
        attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source', 'protected', 'last_downloaded_at']
      });
      expect(result[0].added).toBe(true);
      expect(result[0].removed).toBe(false);
      expect(result[1].added).toBe(false);
      expect(result[1].removed).toBe(false);
    });

    test('should filter by mediaType parameter', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'short1', media_type: 'short', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false, 'short');

      expect(ChannelVideo.findAll).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'short' },
        order: [['publishedAt', 'DESC']]
      });
    });

    test('should handle pagination with limit and offset', async () => {
      const Video = require('../../../models/video');
      const mockVideos = Array.from({ length: 100 }, (_, i) => ({
        youtube_id: `video${i}`,
        title: `Video ${i}`,
        publishedAt: new Date(Date.now() - i * 1000).toISOString(),
        toJSON() { return { youtube_id: this.youtube_id, title: this.title, publishedAt: this.publishedAt }; }
      }));
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 10, 20);

      expect(result).toHaveLength(10);
      expect(result[0].youtube_id).toBe('video20');
    });

    test('should blank publishedAt for estimated rows but keep their sort position', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'newest', publishedAt: '2024-05-01T00:00:00.000Z', published_at_source: 'approximate', toJSON() { return { youtube_id: this.youtube_id, publishedAt: this.publishedAt, published_at_source: this.published_at_source }; } },
        { youtube_id: 'undated', publishedAt: '2024-04-30T23:59:59.000Z', published_at_source: 'estimated', toJSON() { return { youtube_id: this.youtube_id, publishedAt: this.publishedAt, published_at_source: this.published_at_source }; } },
        { youtube_id: 'oldest', publishedAt: '2024-04-01T00:00:00.000Z', published_at_source: 'exact', toJSON() { return { youtube_id: this.youtube_id, publishedAt: this.publishedAt, published_at_source: this.published_at_source }; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123');

      // Estimated row keeps its position between the dated rows...
      expect(result.map(v => v.youtube_id)).toEqual(['newest', 'undated', 'oldest']);
      // ...but its placeholder date is not exposed to consumers
      expect(result[0].publishedAt).toBe('2024-05-01T00:00:00.000Z');
      expect(result[1].publishedAt).toBeNull();
      expect(result[2].publishedAt).toBe('2024-04-01T00:00:00.000Z');
    });

    test('should filter out downloaded videos when downloadedFilter="exclude"', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Video 3', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: true, fileSize: null, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, 'exclude');

      // Should only return video2 (removed) and video3 (not downloaded)
      expect(result).toHaveLength(2);
      expect(result.find(v => v.youtube_id === 'video1')).toBeUndefined();
    });

    test('should keep only downloaded videos when downloadedFilter="only"', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Video 3', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: true, fileSize: null, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, 'only');

      // Should only return video1 (downloaded and not removed)
      expect(result).toHaveLength(1);
      expect(result[0].youtube_id).toBe('video1');
    });

    test('should filter by search query', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'How to cook pasta', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Cooking tutorial', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Gaming video', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, 'off', 'cook');

      expect(result).toHaveLength(2);
      expect(result.every(v => v.title.toLowerCase().includes('cook'))).toBe(true);
    });

    test('should sort by title', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Zebra', publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Apple', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Banana', publishedAt: '2024-01-03', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, 'off', '', 'title', 'asc');

      expect(result[0].title).toBe('Apple');
      expect(result[1].title).toBe('Banana');
      expect(result[2].title).toBe('Zebra');
    });

    test('should sort by duration', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', duration: 300, toJSON() { return this; } },
        { youtube_id: 'video2', duration: 100, toJSON() { return this; } },
        { youtube_id: 'video3', duration: 200, toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'duration', 'asc');

      expect(result[0].duration).toBe(100);
      expect(result[1].duration).toBe(200);
      expect(result[2].duration).toBe(300);
    });

    test('should sort by size', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', toJSON() { return this; } },
        { youtube_id: 'video2', toJSON() { return this; } },
        { youtube_id: 'video3', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 3000, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 1000, filePath: '/path' },
        { id: 3, youtubeId: 'video3', removed: false, fileSize: 2000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'size', 'asc');

      expect(result[0].fileSize).toBe(1000);
      expect(result[1].fileSize).toBe(2000);
      expect(result[2].fileSize).toBe(3000);
    });

    test('should check files for paginated videos when checkFiles=true', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: '2024-01-01', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);

      // First call without checkFiles
      Video.findAll = jest.fn()
        .mockResolvedValueOnce([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path1' },
          { id: 2, youtubeId: 'video2', removed: false, fileSize: 2000, filePath: '/path2' }
        ])
        // Second call with checkFiles for paginated videos
        .mockResolvedValueOnce([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path1' },
          { id: 2, youtubeId: 'video2', removed: false, fileSize: 2000, filePath: '/path2' }
        ]);

      fileCheckModule.checkVideoFiles.mockResolvedValue({
        videos: [
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000 },
          { id: 2, youtubeId: 'video2', removed: true, fileSize: 0 }
        ],
        updates: [{ id: 2, removed: true, fileSize: null }]
      });

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', true);

      expect(fileCheckModule.checkVideoFiles).toHaveBeenCalled();
      // video1 is at index 0, video2 is at index 1, and should be marked as removed after file check
      expect(result[1].added).toBe(true);
      expect(result[1].removed).toBe(true);
    });

    test('should include ignored and ignored_at fields in paginated results', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        {
          youtube_id: 'video1',
          title: 'Video 1',
          publishedAt: '2024-01-02',
          ignored: true,
          ignored_at: '2024-01-02T10:00:00Z',
          toJSON() { return this; }
        },
        {
          youtube_id: 'video2',
          title: 'Video 2',
          publishedAt: '2024-01-01',
          ignored: false,
          ignored_at: null,
          toJSON() { return this; }
        }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false);

      expect(result).toHaveLength(2);
      expect(result[0].ignored).toBe(true);
      expect(result[0].ignored_at).toBe('2024-01-02T10:00:00Z');
      expect(result[1].ignored).toBe(false);
      expect(result[1].ignored_at).toBeNull();
    });

    test('should handle videos without ignored fields', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        {
          youtube_id: 'video1',
          title: 'Video 1',
          publishedAt: '2024-01-02',
          toJSON() { return this; }
        }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false);

      expect(result).toHaveLength(1);
      expect(result[0].ignored).toBeUndefined();
      expect(result[0].ignored_at).toBeUndefined();
    });

    test('missingFilter=only keeps only videos that are downloaded and removed', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-03', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Video 3', publishedAt: '2024-01-01', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      // video1: added and removed (missing); video2: added and present (downloaded); video3: never added.
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: true, fileSize: null, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 1000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'off', 'only', 'off'
      );

      expect(result).toHaveLength(1);
      expect(result[0].youtube_id).toBe('video1');
    });

    test('missingFilter=exclude drops videos that are downloaded and removed', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Missing', publishedAt: '2024-01-03', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Downloaded', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Never added', publishedAt: '2024-01-01', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: true, fileSize: null, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 1000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'off', 'exclude', 'off'
      );

      expect(result.map(v => v.youtube_id)).toEqual(['video2', 'video3']);
    });

    test('ignoredFilter=only keeps only videos with ignored=true', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', ignored: true, publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', ignored: false, publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Video 3', publishedAt: '2024-01-03', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'off', 'off', 'only'
      );

      expect(result).toHaveLength(1);
      expect(result[0].youtube_id).toBe('video1');
    });

    test('ignoredFilter=exclude drops videos with ignored=true', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Video 1', ignored: true, publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Video 2', ignored: false, publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Video 3', publishedAt: '2024-01-03', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'off', 'off', 'exclude'
      );

      expect(result.map(v => v.youtube_id).sort()).toEqual(['video2', 'video3']);
    });

    test('protectedFilter=exclude drops videos marked protected', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Protected', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Unprotected', publishedAt: '2024-01-01', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path', protected: true },
        { id: 2, youtubeId: 'video2', removed: false, fileSize: 1000, filePath: '/path', protected: false }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'exclude', 'off', 'off'
      );

      expect(result).toHaveLength(1);
      expect(result[0].youtube_id).toBe('video2');
    });

    test('missingFilter=only and ignoredFilter=only combine with AND semantics', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'Missing + ignored', ignored: true, publishedAt: '2024-01-04', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Missing only', ignored: false, publishedAt: '2024-01-03', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Ignored only', ignored: true, publishedAt: '2024-01-02', toJSON() { return this; } },
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: true, fileSize: null, filePath: '/path' },
        { id: 2, youtubeId: 'video2', removed: true, fileSize: null, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.fetchNewestVideosFromDb(
        'UC123', 50, 0, false, '', 'date', 'desc', false, 'video',
        null, null, null, null, 'off', 'only', 'only'
      );

      expect(result).toHaveLength(1);
      expect(result[0].youtube_id).toBe('video1');
    });
  });

  describe('getChannelVideoStats', () => {
    test('should return totalCount and oldestVideoDate for channel without filters', async () => {
      const oldestDate = '2023-01-01T00:00:00Z';
      ChannelVideo.count.mockResolvedValue(100);
      ChannelVideo.findOne.mockResolvedValue({
        publishedAt: oldestDate
      });

      const result = await channelVideoQuery.getChannelVideoStats('UC123');

      expect(ChannelVideo.count).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'video' }
      });
      expect(ChannelVideo.findOne).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'video' },
        order: [['publishedAt', 'ASC']],
        attributes: ['publishedAt', 'published_at_source']
      });
      expect(result).toEqual({
        totalCount: 100,
        oldestVideoDate: oldestDate
      });
    });

    test('should filter by mediaType parameter', async () => {
      ChannelVideo.count.mockResolvedValue(25);
      ChannelVideo.findOne.mockResolvedValue({ publishedAt: '2024-01-01' });

      await channelVideoQuery.getChannelVideoStats('UC123', 'off', '', 'short');

      expect(ChannelVideo.count).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'short' }
      });
      expect(ChannelVideo.findOne).toHaveBeenCalledWith({
        where: { channel_id: 'UC123', media_type: 'short' },
        order: [['publishedAt', 'ASC']],
        attributes: ['publishedAt', 'published_at_source']
      });
    });

    test('should return null oldestVideoDate when the oldest row is estimated', async () => {
      ChannelVideo.count.mockResolvedValue(10);
      ChannelVideo.findOne.mockResolvedValue({
        publishedAt: '2026-06-12T17:21:21.205Z',
        published_at_source: 'estimated'
      });

      const result = await channelVideoQuery.getChannelVideoStats('UC123');

      expect(result.oldestVideoDate).toBeNull();
    });

    test('should filter by downloadedFilter="exclude" when specified', async () => {
      const Video = require('../../../models/video');
      // Videos should be in DESC order (newest first) as returned by the database
      const mockVideos = [
        { youtube_id: 'video3', publishedAt: '2024-01-03', toJSON() { return this; } },
        { youtube_id: 'video2', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video1', publishedAt: '2024-01-01', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.getChannelVideoStats('UC123', 'exclude');

      expect(result.totalCount).toBe(2); // video2 and video3 are not downloaded
      expect(result.oldestVideoDate).toBe('2024-01-02');
    });

    test('should filter by downloadedFilter="only" when specified', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video3', publishedAt: '2024-01-03', toJSON() { return this; } },
        { youtube_id: 'video2', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video1', publishedAt: '2024-01-01', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.getChannelVideoStats('UC123', 'only');

      expect(result.totalCount).toBe(1); // Only video1 is downloaded and not removed
      expect(result.oldestVideoDate).toBe('2024-01-01');
    });

    test('should filter by search query', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'How to cook', publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Gaming video', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Cooking tips', publishedAt: '2024-01-03', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([]);

      const result = await channelVideoQuery.getChannelVideoStats('UC123', 'off', 'cook');

      expect(result.totalCount).toBe(2); // Only videos with 'cook' in title
    });

    test('should combine downloadedFilter="exclude" and search filters', async () => {
      const Video = require('../../../models/video');
      const mockVideos = [
        { youtube_id: 'video1', title: 'How to cook', publishedAt: '2024-01-01', toJSON() { return this; } },
        { youtube_id: 'video2', title: 'Gaming video', publishedAt: '2024-01-02', toJSON() { return this; } },
        { youtube_id: 'video3', title: 'Cooking tips', publishedAt: '2024-01-03', toJSON() { return this; } }
      ];
      ChannelVideo.findAll.mockResolvedValue(mockVideos);
      Video.findAll = jest.fn().mockResolvedValue([
        { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' }
      ]);

      const result = await channelVideoQuery.getChannelVideoStats('UC123', 'exclude', 'cook');

      expect(result.totalCount).toBe(1); // Only video3 matches both filters
      expect(result.oldestVideoDate).toBe('2024-01-03');
    });

    test('should return null oldestVideoDate when no videos', async () => {
      ChannelVideo.count.mockResolvedValue(0);
      ChannelVideo.findOne.mockResolvedValue(null);

      const result = await channelVideoQuery.getChannelVideoStats('UC123');

      expect(result).toEqual({
        totalCount: 0,
        oldestVideoDate: null
      });
    });
  });
});
