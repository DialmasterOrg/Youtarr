/* eslint-env jest */

jest.mock('fs');
jest.mock('child_process');
jest.mock('node-cron');
jest.mock('uuid');
jest.mock('../messageEmitter.js');
jest.mock('../../models/channel');
jest.mock('../../models/channelvideo');

jest.mock('../configModule', () => {
  const EventEmitter = require('events');
  const mockConfigModule = new EventEmitter();
  mockConfigModule.getConfig = jest.fn().mockReturnValue({
    channelDownloadFrequency: '0 */6 * * *',
    channelAutoDownload: true,
    channelFilesToDownload: 3,
    preferredResolution: '1080'
  });
  mockConfigModule.onConfigChange = jest.fn();
  mockConfigModule.ffmpegPath = '/usr/bin/ffmpeg';
  return mockConfigModule;
});

jest.mock('../downloadModule', () => ({
  doChannelDownloads: jest.fn()
}));

jest.mock('../fileCheckModule', () => ({
  checkVideoFiles: jest.fn(),
  applyVideoUpdates: jest.fn()
}));

describe('ChannelModule', () => {
  let ChannelModule;
  let fs;
  let fsPromises;
  let childProcess;
  let cron;
  let configModule;
  let downloadModule;
  let fileCheckModule;
  let MessageEmitter;
  let Channel;
  let ChannelVideo;
  let uuid;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  const mockChannelData = {
    channel_id: 'UC123456',
    title: 'Test Channel',
    description: 'Test Description',
    uploader: 'Test Uploader',
    url: 'https://www.youtube.com/@testchannel',
    lastFetched: new Date('2024-01-01')
  };

  const mockVideoData = {
    youtube_id: 'video123',
    title: 'Test Video',
    thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
    duration: 600,
    publishedAt: '2024-01-01T00:00:00Z',
    availability: 'public'
  };

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    uuid = require('uuid');
    uuid.v4.mockReturnValue('test-uuid-1234');

    fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.createWriteStream = jest.fn().mockReturnValue({
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    });
    fs.promises = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
      rename: jest.fn()
    };
    fsPromises = fs.promises;

    childProcess = require('child_process');
    childProcess.spawn = jest.fn();
    childProcess.execSync = jest.fn();

    cron = require('node-cron');
    cron.schedule = jest.fn().mockReturnValue({
      stop: jest.fn()
    });

    configModule = require('../configModule');
    downloadModule = require('../downloadModule');
    fileCheckModule = require('../fileCheckModule');
    MessageEmitter = require('../messageEmitter.js');
    MessageEmitter.emitMessage = jest.fn();

    Channel = require('../../models/channel');
    Channel.findOne = jest.fn().mockResolvedValue(null);
    Channel.findOrCreate = jest.fn();

    ChannelVideo = require('../../models/channelvideo');
    ChannelVideo.findAll = jest.fn();
    ChannelVideo.findOrCreate = jest.fn();

    ChannelModule = require('../channelModule');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize and schedule tasks', () => {
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 */6 * * *',
        expect.any(Function)
      );
      expect(configModule.onConfigChange).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    describe('resolveChannelUrlFromId', () => {
      test('builds canonical URL from UC channel id', () => {
        const url = ChannelModule.resolveChannelUrlFromId('UCabc123');
        expect(url).toBe('https://www.youtube.com/channel/UCabc123');
      });

      test('converts UU uploads id to UC channel URL', () => {
        const url = ChannelModule.resolveChannelUrlFromId('UUabc123');
        expect(url).toBe('https://www.youtube.com/channel/UCabc123');
      });
    });
    describe('findChannelByUrlOrId', () => {
      test('should find channel by URL and return canonical URL', async () => {
        const mockChannel = { ...mockChannelData, channel_id: 'UC123456' };
        Channel.findOne.mockResolvedValue(mockChannel);

        const result = await ChannelModule.findChannelByUrlOrId('https://www.youtube.com/@test');

        expect(Channel.findOne).toHaveBeenCalledWith({
          where: { url: 'https://www.youtube.com/@test' }
        });
        expect(result.foundChannel).toBe(mockChannel);
        expect(result.channelId).toBe('UC123456');
        expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC123456');
      });

      test('should find channel by ID', async () => {
        const mockChannel = { ...mockChannelData };
        Channel.findOne.mockResolvedValue(mockChannel);

        const result = await ChannelModule.findChannelByUrlOrId('UC123456');

        expect(Channel.findOne).toHaveBeenCalledWith({
          where: { channel_id: 'UC123456' }
        });
        expect(result.foundChannel).toBe(mockChannel);
        expect(result.channelId).toBe('UC123456');
        expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC123456');
      });

      test('should return null when channel not found', async () => {
        Channel.findOne.mockResolvedValue(null);

        const result = await ChannelModule.findChannelByUrlOrId('UC999999');

        expect(result.foundChannel).toBeNull();
        expect(result.channelUrl).toBe('https://www.youtube.com/channel/UC999999');
      });

      test('should normalize UU uploads id to UC channel URL when not found in DB', async () => {
        Channel.findOne.mockResolvedValue(null);

        const result = await ChannelModule.findChannelByUrlOrId('UUxyz789');

        expect(result.foundChannel).toBeNull();
        expect(result.channelId).toBe('UUxyz789');
        expect(result.channelUrl).toBe('https://www.youtube.com/channel/UCxyz789');
      });

      test('should return original URL when channel not found by URL', async () => {
        Channel.findOne.mockResolvedValue(null);

        const result = await ChannelModule.findChannelByUrlOrId('https://www.youtube.com/@nonexistent');

        expect(result.foundChannel).toBeNull();
        expect(result.channelUrl).toBe('https://www.youtube.com/@nonexistent');
        expect(result.channelId).toBe('');
      });
    });

    describe('mapChannelToResponse', () => {
      test('should map channel database record to response format', () => {
        const channel = {
          channel_id: 'UC123',
          uploader: 'Test User',
          uploader_id: 'UC123',
          title: 'Test Channel',
          description: 'Test Description',
          url: 'https://youtube.com/@test'
        };

        const result = ChannelModule.mapChannelToResponse(channel);

        expect(result).toEqual({
          id: 'UC123',
          uploader: 'Test User',
          uploader_id: 'UC123',
          title: 'Test Channel',
          description: 'Test Description',
          url: 'https://youtube.com/@test'
        });
      });
    });

  });

  describe('Database Operations', () => {
    describe('upsertChannel', () => {
      test('should create new channel if not exists', async () => {
        const mockChannel = { ...mockChannelData };
        Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
        Channel.findOne.mockResolvedValueOnce(null); // Not found by URL
        Channel.create.mockResolvedValue(mockChannel);

        const channelData = {
          id: 'UC123',
          title: 'New Channel',
          description: 'New Description',
          uploader: 'New Uploader',
          url: 'https://youtube.com/@new'
        };

        const result = await ChannelModule.upsertChannel(channelData);

        expect(Channel.findOne).toHaveBeenNthCalledWith(1, {
          where: { channel_id: channelData.id }
        });
        expect(Channel.findOne).toHaveBeenNthCalledWith(2, {
          where: { url: channelData.url }
        });
        expect(Channel.create).toHaveBeenCalledWith({
          channel_id: channelData.id,
          title: channelData.title,
          description: channelData.description,
          uploader: channelData.uploader,
          url: channelData.url,
          enabled: false
        });
        expect(result).toBe(mockChannel);
      });

      test('should update existing channel found by channel_id', async () => {
        const mockChannel = {
          ...mockChannelData,
          update: jest.fn()
        };
        Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by channel_id

        const channelData = {
          id: 'UC123',
          title: 'Updated Channel',
          description: 'Updated Description',
          uploader: 'Updated Uploader',
          url: 'https://youtube.com/@test'
        };

        await ChannelModule.upsertChannel(channelData);

        expect(Channel.findOne).toHaveBeenCalledWith({
          where: { channel_id: channelData.id }
        });
        expect(mockChannel.update).toHaveBeenCalledWith({
          title: channelData.title,
          description: channelData.description,
          uploader: channelData.uploader,
          url: channelData.url,
          enabled: false
        });
      });

      test('should update existing channel found by URL and backfill channel_id', async () => {
        const mockChannel = {
          ...mockChannelData,
          update: jest.fn()
        };
        Channel.findOne.mockResolvedValueOnce(null); // Not found by channel_id
        Channel.findOne.mockResolvedValueOnce(mockChannel); // Found by URL

        const channelData = {
          id: 'UC123',
          title: 'Updated Channel',
          description: 'Updated Description',
          uploader: 'Updated Uploader',
          url: 'https://youtube.com/@test'
        };

        await ChannelModule.upsertChannel(channelData);

        expect(Channel.findOne).toHaveBeenNthCalledWith(1, {
          where: { channel_id: channelData.id }
        });
        expect(Channel.findOne).toHaveBeenNthCalledWith(2, {
          where: { url: channelData.url }
        });
        expect(mockChannel.update).toHaveBeenCalledWith({
          channel_id: channelData.id,
          title: channelData.title,
          description: channelData.description,
          uploader: channelData.uploader,
          url: channelData.url,
          enabled: false
        });
      });
    });

    describe('insertVideosIntoDb', () => {
      test('should insert new videos into database', async () => {
        const videos = [
          { ...mockVideoData, youtube_id: 'video1' },
          { ...mockVideoData, youtube_id: 'video2' }
        ];

        ChannelVideo.findOrCreate
          .mockResolvedValueOnce([{}, true])
          .mockResolvedValueOnce([{}, true]);

        await ChannelModule.insertVideosIntoDb(videos, 'UC123');

        expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(2);
        expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
          where: {
            youtube_id: 'video1',
            channel_id: 'UC123'
          },
          defaults: expect.objectContaining({
            ...videos[0],
            channel_id: 'UC123'
          })
        });
      });

      test('should update existing videos', async () => {
        const mockVideo = {
          update: jest.fn()
        };
        ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

        await ChannelModule.insertVideosIntoDb([mockVideoData], 'UC123');

        expect(mockVideo.update).toHaveBeenCalledWith({
          title: mockVideoData.title,
          thumbnail: mockVideoData.thumbnail,
          duration: mockVideoData.duration,
          media_type: 'video',
          publishedAt: mockVideoData.publishedAt,
          availability: mockVideoData.availability
        });
      });
    });
  });

  describe('Video Operations', () => {
    describe('enrichVideosWithDownloadStatus', () => {
      test('should add download status to videos based on Videos table', async () => {
        const Video = require('../../models/video');

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

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2', 'video3']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
        });
        expect(result[0].added).toBe(true);
        expect(result[0].removed).toBe(false);
        expect(result[1].added).toBe(true);
        expect(result[1].removed).toBe(true);
        expect(result[2].added).toBe(false);
        expect(result[2].removed).toBe(false);
      });

      test('should handle plain objects without toJSON', async () => {
        const Video = require('../../models/video');

        const videos = [
          { youtube_id: 'video1' },
          { youtube_id: 'video2' }
        ];

        // Mock Videos table response - only video1 is downloaded
        Video.findAll = jest.fn().mockResolvedValue([
          { youtubeId: 'video1', removed: false }
        ]);

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
        });
        expect(result[0].added).toBe(true);
        expect(result[0].removed).toBe(false);
        expect(result[1].added).toBe(false);
        expect(result[1].removed).toBe(false);
      });

      test('should correctly handle removed videos', async () => {
        const Video = require('../../models/video');

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

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

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
        const Video = require('../../models/video');

        const videos = [
          { youtubeId: 'video1', toJSON: () => ({ youtubeId: 'video1' }) },
          { youtubeId: 'video2', toJSON: () => ({ youtubeId: 'video2' }) }
        ];

        // Mock Videos table response
        Video.findAll = jest.fn().mockResolvedValue([
          { youtubeId: 'video1', removed: false }
        ]);

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
        });
        expect(result[0].added).toBe(true);
        expect(result[0].removed).toBe(false);
        expect(result[1].added).toBe(false);
        expect(result[1].removed).toBe(false);
      });

      test('should handle mixed field names (youtube_id and youtubeId)', async () => {
        const Video = require('../../models/video');

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

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2', 'video3']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
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
        const Video = require('../../models/video');
        const videos = [];

        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: []
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
        });
        expect(result).toEqual([]);
      });

      test('should check file existence when checkFiles=true', async () => {
        const Video = require('../../models/video');
        const { sequelize, Sequelize } = require('../../db');

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

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos, true);

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
        const Video = require('../../models/video');

        const videos = [
          { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) }
        ];

        Video.findAll = jest.fn().mockResolvedValue([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' }
        ]);

        await ChannelModule.enrichVideosWithDownloadStatus(videos, false);

        expect(fileCheckModule.checkVideoFiles).not.toHaveBeenCalled();
        expect(fileCheckModule.applyVideoUpdates).not.toHaveBeenCalled();
      });

      test('should handle fileSize in enriched videos', async () => {
        const Video = require('../../models/video');

        const videos = [
          { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) }
        ];

        Video.findAll = jest.fn().mockResolvedValue([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 5000, filePath: '/path/to/video1.mp4' }
        ]);

        const result = await ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(result[0].fileSize).toBe(5000);
      });
    });

    describe('fetchNewestVideosFromDb', () => {
      test('should fetch videos from database with download status', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
          { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);

        // Mock Videos table response - only video1 is downloaded
        Video.findAll = jest.fn().mockResolvedValue([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path/to/video1.mp4' }
        ]);

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123');

        expect(ChannelVideo.findAll).toHaveBeenCalledWith({
          where: { channel_id: 'UC123' },
          order: [['publishedAt', 'DESC']]
        });
        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
        });
        expect(result[0].added).toBe(true);
        expect(result[0].removed).toBe(false);
        expect(result[1].added).toBe(false);
        expect(result[1].removed).toBe(false);
      });

      test('should handle pagination with limit and offset', async () => {
        const Video = require('../../models/video');
        const mockVideos = Array.from({ length: 100 }, (_, i) => ({
          youtube_id: `video${i}`,
          title: `Video ${i}`,
          publishedAt: new Date(Date.now() - i * 1000).toISOString(),
          toJSON() { return { youtube_id: this.youtube_id, title: this.title, publishedAt: this.publishedAt }; }
        }));
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 10, 20);

        expect(result).toHaveLength(10);
        expect(result[0].youtube_id).toBe('video20');
      });

      test('should filter out downloaded videos when excludeDownloaded=true', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, true);

        // Should only return video2 (removed) and video3 (not downloaded)
        expect(result).toHaveLength(2);
        expect(result.find(v => v.youtube_id === 'video1')).toBeUndefined();
      });

      test('should filter by search query', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', title: 'How to cook pasta', toJSON() { return this; } },
          { youtube_id: 'video2', title: 'Cooking tutorial', toJSON() { return this; } },
          { youtube_id: 'video3', title: 'Gaming video', toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, 'cook');

        expect(result).toHaveLength(2);
        expect(result.every(v => v.title.toLowerCase().includes('cook'))).toBe(true);
      });

      test('should sort by title', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', title: 'Zebra', publishedAt: '2024-01-01', toJSON() { return this; } },
          { youtube_id: 'video2', title: 'Apple', publishedAt: '2024-01-02', toJSON() { return this; } },
          { youtube_id: 'video3', title: 'Banana', publishedAt: '2024-01-03', toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'title', 'asc');

        expect(result[0].title).toBe('Apple');
        expect(result[1].title).toBe('Banana');
        expect(result[2].title).toBe('Zebra');
      });

      test('should sort by duration', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', duration: 300, toJSON() { return this; } },
          { youtube_id: 'video2', duration: 100, toJSON() { return this; } },
          { youtube_id: 'video3', duration: 200, toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'duration', 'asc');

        expect(result[0].duration).toBe(100);
        expect(result[1].duration).toBe(200);
        expect(result[2].duration).toBe(300);
      });

      test('should sort by size', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'size', 'asc');

        expect(result[0].fileSize).toBe(1000);
        expect(result[1].fileSize).toBe(2000);
        expect(result[2].fileSize).toBe(3000);
      });

      test('should check files for paginated videos when checkFiles=true', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', true);

        expect(fileCheckModule.checkVideoFiles).toHaveBeenCalled();
        // video1 is at index 0, video2 is at index 1, and should be marked as removed after file check
        expect(result[1].added).toBe(true);
        expect(result[1].removed).toBe(true);
      });
    });

    describe('extractPublishedDate', () => {
      test('should extract date from timestamp', () => {
        const entry = { timestamp: 1704067200 };

        const result = ChannelModule.extractPublishedDate(entry);

        expect(result).toBe('2024-01-01T00:00:00.000Z');
      });

      test('should extract date from upload_date', () => {
        const entry = { upload_date: '20240115' };

        const result = ChannelModule.extractPublishedDate(entry);

        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      test('should use fallback date when no date info available', () => {
        const entry = {};

        const result = ChannelModule.extractPublishedDate(entry);

        const resultDate = new Date(result);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        expect(Math.abs(resultDate - ninetyDaysAgo)).toBeLessThan(1000);
      });
    });

    describe('extractThumbnailUrl', () => {
      test('should use thumbnail field if available', () => {
        const entry = {
          id: 'video123',
          thumbnail: 'https://custom.thumbnail.url/image.jpg'
        };

        const result = ChannelModule.extractThumbnailUrl(entry);

        expect(result).toBe('https://custom.thumbnail.url/image.jpg');
      });

      test('should select medium thumbnail from array', () => {
        const entry = {
          id: 'video123',
          thumbnails: [
            { id: 'small', url: 'https://small.jpg' },
            { id: 'medium', url: 'https://medium.jpg' },
            { id: 'large', url: 'https://large.jpg' }
          ]
        };

        const result = ChannelModule.extractThumbnailUrl(entry);

        expect(result).toBe('https://medium.jpg');
      });

      test('should use last thumbnail if no medium found', () => {
        const entry = {
          id: 'video123',
          thumbnails: [
            { id: 'small', url: 'https://small.jpg' },
            { id: 'large', url: 'https://large.jpg' }
          ]
        };

        const result = ChannelModule.extractThumbnailUrl(entry);

        expect(result).toBe('https://large.jpg');
      });

      test('should construct YouTube thumbnail URL from video ID', () => {
        const entry = { id: 'video123' };

        const result = ChannelModule.extractThumbnailUrl(entry);

        expect(result).toBe('https://i.ytimg.com/vi/video123/mqdefault.jpg');
      });

      test('should return empty string when no data available', () => {
        const entry = {};

        const result = ChannelModule.extractThumbnailUrl(entry);

        expect(result).toBe('');
      });
    });

    describe('parseVideoMetadata', () => {
      test('should parse video metadata correctly', () => {
        const entry = {
          id: 'video123',
          title: 'Test Video',
          duration: 300,
          timestamp: 1704067200,
          thumbnail: 'https://thumb.jpg',
          availability: 'public'
        };

        const result = ChannelModule.parseVideoMetadata(entry);

        expect(result).toEqual({
          title: 'Test Video',
          youtube_id: 'video123',
          publishedAt: '2024-01-01T00:00:00.000Z',
          thumbnail: 'https://thumb.jpg',
          duration: 300,
          media_type: 'video',
          availability: 'public'
        });
      });

      test('should handle missing fields with defaults', () => {
        const entry = {
          id: 'video123'
        };

        const result = ChannelModule.parseVideoMetadata(entry);

        expect(result).toEqual({
          title: 'Untitled',
          youtube_id: 'video123',
          publishedAt: expect.any(String),
          thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
          duration: 0,
          media_type: 'video',
          availability: null
        });
      });
    });

    describe('getChannelVideoStats', () => {
      test('should return totalCount and oldestVideoDate for channel without filters', async () => {
        const oldestDate = '2023-01-01T00:00:00Z';
        ChannelVideo.count.mockResolvedValue(100);
        ChannelVideo.findOne.mockResolvedValue({
          publishedAt: oldestDate
        });

        const result = await ChannelModule.getChannelVideoStats('UC123');

        expect(ChannelVideo.count).toHaveBeenCalledWith({
          where: { channel_id: 'UC123' }
        });
        expect(ChannelVideo.findOne).toHaveBeenCalledWith({
          where: { channel_id: 'UC123' },
          order: [['publishedAt', 'ASC']],
          attributes: ['publishedAt']
        });
        expect(result).toEqual({
          totalCount: 100,
          oldestVideoDate: oldestDate
        });
      });

      test('should filter by excludeDownloaded when specified', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.getChannelVideoStats('UC123', true);

        expect(result.totalCount).toBe(2); // video2 and video3 are not downloaded
        expect(result.oldestVideoDate).toBe('2024-01-02');
      });

      test('should filter by search query', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', title: 'How to cook', publishedAt: '2024-01-01', toJSON() { return this; } },
          { youtube_id: 'video2', title: 'Gaming video', publishedAt: '2024-01-02', toJSON() { return this; } },
          { youtube_id: 'video3', title: 'Cooking tips', publishedAt: '2024-01-03', toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.getChannelVideoStats('UC123', false, 'cook');

        expect(result.totalCount).toBe(2); // Only videos with 'cook' in title
      });

      test('should combine excludeDownloaded and search filters', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'video1', title: 'How to cook', publishedAt: '2024-01-01', toJSON() { return this; } },
          { youtube_id: 'video2', title: 'Gaming video', publishedAt: '2024-01-02', toJSON() { return this; } },
          { youtube_id: 'video3', title: 'Cooking tips', publishedAt: '2024-01-03', toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([
          { id: 1, youtubeId: 'video1', removed: false, fileSize: 1000, filePath: '/path' }
        ]);

        const result = await ChannelModule.getChannelVideoStats('UC123', true, 'cook');

        expect(result.totalCount).toBe(1); // Only video3 matches both filters
        expect(result.oldestVideoDate).toBe('2024-01-03');
      });

      test('should return null oldestVideoDate when no videos', async () => {
        ChannelVideo.count.mockResolvedValue(0);
        ChannelVideo.findOne.mockResolvedValue(null);

        const result = await ChannelModule.getChannelVideoStats('UC123');

        expect(result).toEqual({
          totalCount: 0,
          oldestVideoDate: null
        });
      });
    });
  });

  describe('Channel Management', () => {
    describe('scheduleTask', () => {
      test('should schedule task when auto-download enabled', () => {
        configModule.getConfig.mockReturnValue({
          channelAutoDownload: true,
          channelDownloadFrequency: '0 */12 * * *'
        });

        ChannelModule.scheduleTask();

        expect(cron.schedule).toHaveBeenCalledWith(
          '0 */12 * * *',
          expect.any(Function)
        );
      });

      test('should not schedule task when auto-download disabled', () => {
        configModule.getConfig.mockReturnValue({
          channelAutoDownload: false,
          channelDownloadFrequency: '0 */12 * * *'
        });
        cron.schedule.mockClear();

        ChannelModule.scheduleTask();

        expect(cron.schedule).not.toHaveBeenCalled();
      });

      test('should stop old task before scheduling new one', () => {
        const mockTask = { stop: jest.fn() };
        ChannelModule.task = mockTask;

        ChannelModule.scheduleTask();

        expect(mockTask.stop).toHaveBeenCalled();
      });
    });

    describe('readChannels', () => {
      test('should read channels from file and fetch from database', async () => {
        const mockChannels = [
          {
            url: 'https://youtube.com/@channel1',
            uploader: 'Channel 1',
            channel_id: 'UC111',
            enabled: true
          },
          {
            url: 'https://youtube.com/@channel2',
            uploader: 'Channel 2',
            channel_id: 'UC222',
            enabled: true
          }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);

        const result = await ChannelModule.readChannels();

        expect(Channel.findAll).toHaveBeenCalledWith({
          where: { enabled: true }
        });

        expect(result).toEqual([
          {
            url: 'https://youtube.com/@channel1',
            uploader: 'Channel 1',
            channel_id: 'UC111'
          },
          {
            url: 'https://youtube.com/@channel2',
            uploader: 'Channel 2',
            channel_id: 'UC222'
          }
        ]);
      });

      test('should handle missing channel in database', async () => {
        Channel.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.readChannels();

        expect(result).toEqual([]);
      });
    });

    describe('writeChannels', () => {
      test('enables only newly added and disables removed channels', async () => {
        const channelUrls = [
          'https://youtube.com/@channel1',
          'https://youtube.com/@channel2'
        ];

        Channel.findAll = jest.fn().mockResolvedValue([
          { url: 'https://youtube.com/@channel1', enabled: true },
          { url: 'https://youtube.com/@channel3', enabled: true }
        ]);

        Channel.update = jest.fn().mockResolvedValue([1]);
        jest.spyOn(ChannelModule, 'getChannelInfo').mockResolvedValue({
          id: 'UC_channel2_id'
        });

        await ChannelModule.writeChannels(channelUrls);

        expect(ChannelModule.getChannelInfo).toHaveBeenCalledTimes(1);
        expect(ChannelModule.getChannelInfo).toHaveBeenCalledWith(
          'https://youtube.com/@channel2',
          false,
          true
        );

        expect(Channel.update).toHaveBeenCalledWith(
          { enabled: true },
          { where: { channel_id: 'UC_channel2_id' } }
        );

        expect(Channel.update).toHaveBeenCalledWith(
          { enabled: false },
          { where: { url: ['https://youtube.com/@channel3'] } }
        );
      });

      test('should handle write error gracefully', async () => {
        Channel.findAll = jest
          .fn()
          .mockResolvedValue([{ url: 'https://youtube.com/@old', enabled: true }]);

        Channel.update = jest.fn().mockRejectedValue(new Error('DB Error'));

        await ChannelModule.writeChannels(['https://youtube.com/@new']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error updating channels in database:',
          expect.any(Error)
        );
      });
    });

    describe('generateChannelsFile', () => {
      test('should generate temp file with enabled channel URLs', async () => {
        const mockChannels = [
          { url: 'https://youtube.com/@channel1' },
          { url: 'https://youtube.com/@channel2' }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);
        fsPromises.writeFile.mockResolvedValue();

        const tempPath = await ChannelModule.generateChannelsFile();

        expect(Channel.findAll).toHaveBeenCalledWith({
          where: { enabled: true },
          attributes: ['channel_id', 'url']
        });

        expect(fsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('channels-temp-'),
          'https://youtube.com/@channel1\nhttps://youtube.com/@channel2'
        );

        expect(tempPath).toContain('channels-temp-');
      });

      test('should handle error and cleanup temp file', async () => {
        Channel.findAll = jest.fn().mockRejectedValue(new Error('DB Error'));
        fsPromises.unlink.mockResolvedValue();

        await expect(ChannelModule.generateChannelsFile()).rejects.toThrow('DB Error');
      });
    });

    describe('channelAutoDownload', () => {
      test('should trigger channel downloads', () => {
        ChannelModule.channelAutoDownload();

        expect(downloadModule.doChannelDownloads).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Running new Channel Downloads'));
      });
    });
  });

  describe('Response Builders', () => {
    describe('shouldRefreshChannelVideos', () => {
      test('should refresh if no channel record', () => {
        const result = ChannelModule.shouldRefreshChannelVideos(null, 10);
        expect(result).toBe(false);
      });

      test('should refresh if no lastFetched', () => {
        const channel = { ...mockChannelData, lastFetched: null };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10);
        expect(result).toBe(true);
      });

      test('should refresh if lastFetched is old', () => {
        const channel = {
          ...mockChannelData,
          lastFetched: new Date(Date.now() - 2 * 60 * 60 * 1000)
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10);
        expect(result).toBe(true);
      });

      test('should refresh if no videos', () => {
        const channel = {
          ...mockChannelData,
          lastFetched: new Date()
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 0);
        expect(result).toBe(true);
      });

      test('should not refresh if recently fetched with videos', () => {
        const channel = {
          ...mockChannelData,
          lastFetched: new Date()
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10);
        expect(result).toBe(false);
      });
    });

    describe('buildChannelVideosResponse', () => {
      test('should build successful response', () => {
        const videos = [mockVideoData];
        const channel = mockChannelData;

        const result = ChannelModule.buildChannelVideosResponse(videos, channel, 'yt_dlp');

        expect(result).toEqual({
          videos: videos,
          videoFail: false,
          failureReason: null,
          dataSource: 'yt_dlp',
          lastFetched: channel.lastFetched,
          totalCount: videos.length,
          oldestVideoDate: null
        });
      });

      test('should build failure response when no videos', () => {
        const result = ChannelModule.buildChannelVideosResponse([], mockChannelData, 'cache');

        expect(result).toEqual({
          videos: [],
          videoFail: true,
          failureReason: 'fetch_error',
          dataSource: 'cache',
          lastFetched: mockChannelData.lastFetched,
          totalCount: 0,
          oldestVideoDate: null
        });
      });

      test('should handle null channel', () => {
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], null);

        expect(result.lastFetched).toBeNull();
      });

      test('should include stats when provided', () => {
        const stats = {
          totalCount: 150,
          oldestVideoDate: '2023-01-01T00:00:00Z'
        };
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', stats);

        expect(result.totalCount).toBe(150);
        expect(result.oldestVideoDate).toBe('2023-01-01T00:00:00Z');
      });

      test('should not fail when videos empty but stats show totalCount > 0', () => {
        const stats = {
          totalCount: 50,
          oldestVideoDate: '2023-01-01T00:00:00Z'
        };
        const result = ChannelModule.buildChannelVideosResponse([], mockChannelData, 'cache', stats);

        expect(result.videoFail).toBe(false);
        expect(result.failureReason).toBeNull();
      });
    });

    describe('getChannelVideos', () => {
      test('should return paginated videos with stats', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, lastFetched: new Date() };
        const mockVideos = [
          { youtube_id: 'video1', publishedAt: new Date().toISOString(), toJSON() { return this; } }
        ];

        Channel.findOne.mockResolvedValue(mockChannel);
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        ChannelVideo.count.mockResolvedValue(10);
        ChannelVideo.findOne.mockResolvedValue({ publishedAt: '2023-01-01' });
        Video.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.getChannelVideos('UC123', 1, 50);

        expect(result.videos).toBeDefined();
        expect(result.totalCount).toBe(10);
        expect(result.oldestVideoDate).toBe('2023-01-01');
      });

      test('should skip auto-refresh when fetch already in progress', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, lastFetched: null };

        Channel.findOne.mockResolvedValue(mockChannel);
        ChannelVideo.findAll.mockResolvedValue([]);
        ChannelVideo.count.mockResolvedValue(0);
        Video.findAll = jest.fn().mockResolvedValue([]);

        // Simulate an active fetch
        ChannelModule.activeFetches.set('UC123', {
          startTime: new Date().toISOString(),
          type: 'fetchAll'
        });

        const result = await ChannelModule.getChannelVideos('UC123');

        // Should not throw, should return cached data
        expect(result.videos).toBeDefined();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping auto-refresh'));

        // Clean up
        ChannelModule.activeFetches.delete('UC123');
      });

      test('should handle errors and return cached data', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData };
        const mockVideos = [
          { youtube_id: 'video1', toJSON() { return this; } }
        ];

        Channel.findOne.mockResolvedValue(mockChannel);
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        ChannelVideo.count.mockResolvedValue(1);
        Video.findAll = jest.fn().mockResolvedValue([]);

        // Make fetchAndSaveVideosViaYtDlp throw an error
        jest.spyOn(ChannelModule, 'fetchAndSaveVideosViaYtDlp').mockRejectedValue(new Error('Network error'));

        const result = await ChannelModule.getChannelVideos('UC123');

        expect(result.videos).toBeDefined();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching channel videos:', 'Network error');
      });
    });

    describe('fetchAllChannelVideos', () => {
      test('should fetch all videos and return paginated results', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, save: jest.fn(), url: 'https://youtube.com/@test' };

        Channel.findOne.mockResolvedValue(mockChannel);

        // Mock executeYtDlpCommand to return video data
        jest.spyOn(ChannelModule, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
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

        const result = await ChannelModule.fetchAllChannelVideos('UC123', 1, 50);

        expect(result.success).toBe(true);
        expect(result.videosFound).toBe(2);
        expect(result.videos).toBeDefined();
        expect(mockChannel.save).toHaveBeenCalled();
      });

      test('should throw error when fetch already in progress', async () => {
        ChannelModule.activeFetches.set('UC123', {
          startTime: new Date().toISOString(),
          type: 'autoRefresh'
        });

        await expect(ChannelModule.fetchAllChannelVideos('UC123')).rejects.toThrow('fetch operation is already in progress');

        // Clean up
        ChannelModule.activeFetches.delete('UC123');
      });

      test('should throw error when channel not found', async () => {
        Channel.findOne.mockResolvedValue(null);

        await expect(ChannelModule.fetchAllChannelVideos('UC999')).rejects.toThrow('Channel not found in database');
      });

      test('should clean up activeFetches on error', async () => {
        const mockChannel = { ...mockChannelData };
        Channel.findOne.mockResolvedValue(mockChannel);

        jest.spyOn(ChannelModule, 'executeYtDlpCommand').mockRejectedValue(new Error('yt-dlp error'));

        await expect(ChannelModule.fetchAllChannelVideos('UC123')).rejects.toThrow('yt-dlp error');

        // Verify activeFetches was cleaned up
        expect(ChannelModule.activeFetches.has('UC123')).toBe(false);
      });

      test('should update channel URL if changed', async () => {
        const Video = require('../../models/video');
        const newUrl = 'https://youtube.com/@newhandle';
        const mockChannel = {
          ...mockChannelData,
          url: 'https://youtube.com/@oldhandle',
          save: jest.fn()
        };

        Channel.findOne.mockResolvedValue(mockChannel);

        jest.spyOn(ChannelModule, 'executeYtDlpCommand').mockResolvedValue(JSON.stringify({
          entries: [{ id: 'video1', title: 'Video 1', timestamp: 1704067200 }],
          uploader_url: newUrl
        }));

        ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);
        ChannelVideo.findAll.mockResolvedValue([
          { youtube_id: 'video1', toJSON() { return this; } }
        ]);
        ChannelVideo.count.mockResolvedValue(1);
        Video.findAll = jest.fn().mockResolvedValue([]);

        await ChannelModule.fetchAllChannelVideos('UC123');

        expect(mockChannel.url).toBe(newUrl);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Channel URL updated'));
      });
    });
  });
});
