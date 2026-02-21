/* eslint-env jest */

const { Op } = require('sequelize');
const realHttps = require('https');

jest.mock('fs');
jest.mock('child_process');
jest.mock('node-cron');
jest.mock('uuid');
jest.mock('../messageEmitter.js');
jest.mock('../../logger');
jest.mock('../../models/channel', () => {
  const { Model } = require('sequelize');
  class MockChannel extends Model {}
  MockChannel.findOne = jest.fn();
  MockChannel.findOrCreate = jest.fn();
  MockChannel.create = jest.fn();
  MockChannel.findAll = jest.fn();
  MockChannel.update = jest.fn();
  MockChannel.init = jest.fn(() => MockChannel);
  return MockChannel;
});

jest.mock('../../models/channelvideo', () => {
  const { Model } = require('sequelize');
  class MockChannelVideo extends Model {}
  MockChannelVideo.findAll = jest.fn();
  MockChannelVideo.findOrCreate = jest.fn();
  MockChannelVideo.count = jest.fn();
  MockChannelVideo.findOne = jest.fn();
  MockChannelVideo.init = jest.fn(() => MockChannelVideo);
  return MockChannelVideo;
});

jest.mock('../../models/video', () => {
  const { Model } = require('sequelize');
  class MockVideo extends Model {}
  MockVideo.findAll = jest.fn();
  MockVideo.init = jest.fn(() => MockVideo);
  return MockVideo;
});

jest.mock('../configModule', () => {
  const EventEmitter = require('events');
  const mockConfigModule = new EventEmitter();
  mockConfigModule.getConfig = jest.fn().mockReturnValue({
    channelDownloadFrequency: '0 */6 * * *',
    channelAutoDownload: true,
    channelFilesToDownload: 3,
    preferredResolution: '1080',
    writeChannelPosters: true
  });
  mockConfigModule.onConfigChange = jest.fn();
  mockConfigModule.ffmpegPath = '/usr/bin/ffmpeg';
  mockConfigModule.getImagePath = jest.fn().mockReturnValue('/path/to/images');
  mockConfigModule.directoryPath = '/path/to/videos';
  mockConfigModule.getCookiesPath = jest.fn().mockReturnValue(null);
  return mockConfigModule;
});

jest.mock('../downloadModule', () => ({
  doChannelDownloads: jest.fn()
}));

jest.mock('../fileCheckModule', () => ({
  checkVideoFiles: jest.fn(),
  applyVideoUpdates: jest.fn()
}));

jest.mock('../jobModule', () => ({
  getAllJobs: jest.fn().mockReturnValue({})
}));

jest.mock('../ytDlpRunner', () => ({
  run: jest.fn()
}));

jest.mock('../filesystem', () => ({
  sanitizeNameLikeYtDlp: jest.fn((name) => name) // Pass through by default
}));

jest.mock('../../db', () => {
  const mockSequelize = {
    query: jest.fn().mockResolvedValue([]),
    define: jest.fn(() => {
      return class MockModel {
        static init() { return this; }
      };
    }),
    models: {},
    authenticate: jest.fn().mockResolvedValue(),
  };
  return {
    sequelize: mockSequelize,
    Sequelize: require('sequelize').Sequelize
  };
});

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
  let logger;
  let filesystem;

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

  beforeAll(() => {
    // No console spies needed anymore - using logger
  });

  afterAll(() => {
    // No console spies to restore
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    uuid = require('uuid');
    uuid.v4.mockReturnValue('test-uuid-1234');

    fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.copySync = jest.fn();
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
    Channel.findOne.mockResolvedValue(null);

    ChannelVideo = require('../../models/channelvideo');

    logger = require('../../logger');

    filesystem = require('../filesystem');

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
    describe('getLastFetchedForTab', () => {
      test('should return last fetched timestamp for a specific tab', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({
            video: '2024-01-01T00:00:00.000Z',
            short: '2024-01-02T00:00:00.000Z'
          })
        };

        const result = ChannelModule.getLastFetchedForTab(channel, 'video');
        expect(result).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      });

      test('should return null when tab has never been fetched', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({
            video: '2024-01-01T00:00:00.000Z'
          })
        };

        const result = ChannelModule.getLastFetchedForTab(channel, 'short');
        expect(result).toBeNull();
      });

      test('should return null when channel has no lastFetchedByTab', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: null
        };

        const result = ChannelModule.getLastFetchedForTab(channel, 'video');
        expect(result).toBeNull();
      });

      test('should return null when channel is null', () => {
        const result = ChannelModule.getLastFetchedForTab(null, 'video');
        expect(result).toBeNull();
      });

      test('should handle invalid JSON gracefully', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: 'invalid json'
        };

        const result = ChannelModule.getLastFetchedForTab(channel, 'video');
        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            err: expect.any(Error),
            channelId: mockChannelData.channel_id,
            mediaType: 'video'
          }),
          'Error parsing lastFetchedByTab'
        );
      });
    });

    describe('setLastFetchedForTab', () => {
      test('should update last fetched timestamp for a specific tab', async () => {
        const { sequelize } = require('../../db');
        const mockChannel = {
          ...mockChannelData,
          channel_id: 'UC123',
          reload: jest.fn()
        };
        const timestamp = new Date('2024-01-15T12:00:00.000Z');

        sequelize.query.mockResolvedValue([]);

        await ChannelModule.setLastFetchedForTab(mockChannel, 'video', timestamp);

        expect(sequelize.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE channels'),
          {
            replacements: {
              jsonPath: '$.video',
              timestamp: '2024-01-15T12:00:00.000Z',
              channelId: 'UC123'
            }
          }
        );
        expect(mockChannel.reload).toHaveBeenCalled();
      });

      test('should handle null channel gracefully', async () => {
        const { sequelize } = require('../../db');
        const timestamp = new Date();

        await ChannelModule.setLastFetchedForTab(null, 'video', timestamp);

        expect(sequelize.query).not.toHaveBeenCalled();
      });

      test('should handle channel without channel_id', async () => {
        const { sequelize } = require('../../db');
        const mockChannel = {
          ...mockChannelData,
          channel_id: null,
          reload: jest.fn()
        };
        const timestamp = new Date();

        await ChannelModule.setLastFetchedForTab(mockChannel, 'video', timestamp);

        expect(sequelize.query).not.toHaveBeenCalled();
      });

      test('should use atomic JSON_SET for concurrent updates', async () => {
        const { sequelize } = require('../../db');
        const mockChannel = {
          ...mockChannelData,
          channel_id: 'UC123',
          reload: jest.fn()
        };
        const timestamp = new Date('2024-01-15T12:00:00.000Z');

        sequelize.query.mockResolvedValue([]);

        await ChannelModule.setLastFetchedForTab(mockChannel, 'short', timestamp);

        // Verify it uses JSON_SET with COALESCE to handle NULL
        const sqlQuery = sequelize.query.mock.calls[0][0];
        expect(sqlQuery).toContain('JSON_SET');
        expect(sqlQuery).toContain('COALESCE(lastFetchedByTab, \'{}\')');
        expect(sequelize.query).toHaveBeenCalledWith(
          expect.any(String),
          {
            replacements: {
              jsonPath: '$.short',
              timestamp: '2024-01-15T12:00:00.000Z',
              channelId: 'UC123'
            }
          }
        );
      });
    });

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
          url: 'https://youtube.com/@test',
          auto_download_enabled_tabs: 'video,short'
        };

        const result = ChannelModule.mapChannelToResponse(channel);

        expect(result).toEqual({
          id: 'UC123',
          uploader: 'Test User',
          uploader_id: 'UC123',
          title: 'Test Channel',
          description: 'Test Description',
          url: 'https://youtube.com/@test',
          auto_download_enabled_tabs: 'video,short',
          available_tabs: null,
          sub_folder: null,
          video_quality: null,
          audio_format: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null,
        });
      });

      test('should use default value for auto_download_enabled_tabs when null', () => {
        const channel = {
          channel_id: 'UC123',
          uploader: 'Test User',
          uploader_id: 'UC123',
          title: 'Test Channel',
          description: 'Test Description',
          url: 'https://youtube.com/@test',
          auto_download_enabled_tabs: null
        };

        const result = ChannelModule.mapChannelToResponse(channel);

        expect(result.auto_download_enabled_tabs).toBe('video');
        expect(result.available_tabs).toBeNull();
        expect(result.sub_folder).toBeNull();
        expect(result.video_quality).toBeNull();
        expect(result.min_duration).toBeNull();
        expect(result.max_duration).toBeNull();
        expect(result.title_filter_regex).toBeNull();
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
          channel_id: channelData.id,
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
          availability: mockVideoData.availability,
          live_status: null
        });
      });

      test('should insert videos with live_status field', async () => {
        const videoWithLiveStatus = {
          ...mockVideoData,
          live_status: 'was_live'
        };

        ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);

        await ChannelModule.insertVideosIntoDb([videoWithLiveStatus], 'UC123');

        expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
          where: {
            youtube_id: videoWithLiveStatus.youtube_id,
            channel_id: 'UC123'
          },
          defaults: expect.objectContaining({
            live_status: 'was_live'
          })
        });
      });

      test('should generate synthetic publishedAt for videos without dates', async () => {
        const videosWithoutDates = [
          { youtube_id: 'video1', title: 'Video 1', publishedAt: null },
          { youtube_id: 'video2', title: 'Video 2', publishedAt: null },
          { youtube_id: 'video3', title: 'Video 3', publishedAt: null }
        ];

        ChannelVideo.findOrCreate
          .mockResolvedValueOnce([{}, true])
          .mockResolvedValueOnce([{}, true])
          .mockResolvedValueOnce([{}, true]);

        const beforeTime = Date.now();
        await ChannelModule.insertVideosIntoDb(videosWithoutDates, 'UC123');
        const afterTime = Date.now();

        // Verify all videos got synthetic timestamps
        expect(ChannelVideo.findOrCreate).toHaveBeenCalledTimes(3);

        // First video should have the most recent synthetic timestamp
        const firstCall = ChannelVideo.findOrCreate.mock.calls[0][0];
        const firstTimestamp = new Date(firstCall.defaults.publishedAt).getTime();
        expect(firstTimestamp).toBeGreaterThanOrEqual(beforeTime - 1000);
        expect(firstTimestamp).toBeLessThanOrEqual(afterTime + 1000);

        // Second video should be 1 second earlier
        const secondCall = ChannelVideo.findOrCreate.mock.calls[1][0];
        const secondTimestamp = new Date(secondCall.defaults.publishedAt).getTime();
        expect(secondTimestamp).toBe(firstTimestamp - 1000);

        // Third video should be 2 seconds earlier
        const thirdCall = ChannelVideo.findOrCreate.mock.calls[2][0];
        const thirdTimestamp = new Date(thirdCall.defaults.publishedAt).getTime();
        expect(thirdTimestamp).toBe(firstTimestamp - 2000);
      });

      test('should preserve publishedAt when provided', async () => {
        const videosWithDates = [
          { youtube_id: 'video1', title: 'Video 1', publishedAt: '2024-01-01T00:00:00Z' },
          { youtube_id: 'video2', title: 'Video 2', publishedAt: '2024-01-02T00:00:00Z' }
        ];

        ChannelVideo.findOrCreate
          .mockResolvedValueOnce([{}, true])
          .mockResolvedValueOnce([{}, true]);

        await ChannelModule.insertVideosIntoDb(videosWithDates, 'UC123');

        const firstCall = ChannelVideo.findOrCreate.mock.calls[0][0];
        expect(firstCall.defaults.publishedAt).toBe('2024-01-01T00:00:00Z');

        const secondCall = ChannelVideo.findOrCreate.mock.calls[1][0];
        expect(secondCall.defaults.publishedAt).toBe('2024-01-02T00:00:00Z');
      });

      test('should update publishedAt with synthetic date when not provided on existing videos', async () => {
        const mockVideo = {
          publishedAt: '2024-01-01T00:00:00Z',
          update: jest.fn()
        };

        const videoWithoutDate = {
          ...mockVideoData,
          publishedAt: null
        };

        ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

        const beforeTime = Date.now();
        await ChannelModule.insertVideosIntoDb([videoWithoutDate], 'UC123');
        const afterTime = Date.now();

        // Should always update publishedAt (with synthetic date if not provided)
        const updateCall = mockVideo.update.mock.calls[0][0];
        expect(updateCall.publishedAt).toBeDefined();
        const timestamp = new Date(updateCall.publishedAt).getTime();
        expect(timestamp).toBeGreaterThanOrEqual(beforeTime - 1000);
        expect(timestamp).toBeLessThanOrEqual(afterTime + 1000);
      });

      test('should set synthetic publishedAt on existing videos without dates', async () => {
        const mockVideo = {
          publishedAt: null,
          update: jest.fn()
        };

        const videoWithoutDate = {
          ...mockVideoData,
          publishedAt: null
        };

        ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

        const beforeTime = Date.now();
        await ChannelModule.insertVideosIntoDb([videoWithoutDate], 'UC123');
        const afterTime = Date.now();

        // Should set synthetic publishedAt when existing video has no date
        const updateCall = mockVideo.update.mock.calls[0][0];
        expect(updateCall.publishedAt).toBeDefined();
        const timestamp = new Date(updateCall.publishedAt).getTime();
        expect(timestamp).toBeGreaterThanOrEqual(beforeTime - 1000);
        expect(timestamp).toBeLessThanOrEqual(afterTime + 1000);
      });

      test('should update publishedAt when new date is provided for existing video', async () => {
        const mockVideo = {
          publishedAt: '2024-01-01T00:00:00Z',
          update: jest.fn()
        };

        const videoWithNewDate = {
          ...mockVideoData,
          publishedAt: '2024-01-15T00:00:00Z'
        };

        ChannelVideo.findOrCreate.mockResolvedValue([mockVideo, false]);

        await ChannelModule.insertVideosIntoDb([videoWithNewDate], 'UC123');

        expect(mockVideo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            publishedAt: '2024-01-15T00:00:00Z'
          })
        );
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
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
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
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
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
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
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
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
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
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
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
          where: { channel_id: 'UC123', media_type: 'video' },
          order: [['publishedAt', 'DESC']]
        });
        expect(Video.findAll).toHaveBeenCalledWith({
          where: {
            youtubeId: ['video1', 'video2']
          },
          attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating', 'rating_source']
        });
        expect(result[0].added).toBe(true);
        expect(result[0].removed).toBe(false);
        expect(result[1].added).toBe(false);
        expect(result[1].removed).toBe(false);
      });

      test('should filter by mediaType parameter', async () => {
        const Video = require('../../models/video');
        const mockVideos = [
          { youtube_id: 'short1', media_type: 'short', toJSON() { return this; } }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        Video.findAll = jest.fn().mockResolvedValue([]);

        await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false, 'short');

        expect(ChannelVideo.findAll).toHaveBeenCalledWith({
          where: { channel_id: 'UC123', media_type: 'short' },
          order: [['publishedAt', 'DESC']]
        });
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

      test('should include ignored and ignored_at fields in paginated results', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false);

        expect(result).toHaveLength(2);
        expect(result[0].ignored).toBe(true);
        expect(result[0].ignored_at).toBe('2024-01-02T10:00:00Z');
        expect(result[1].ignored).toBe(false);
        expect(result[1].ignored_at).toBeNull();
      });

      test('should handle videos without ignored fields', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123', 50, 0, false, '', 'date', 'desc', false);

        expect(result).toHaveLength(1);
        expect(result[0].ignored).toBeUndefined();
        expect(result[0].ignored_at).toBeUndefined();
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

      test('should return null when no date info available', () => {
        const entry = {};

        const result = ChannelModule.extractPublishedDate(entry);

        expect(result).toBeNull();
      });

      test('should extract date from release_timestamp', () => {
        const entry = { release_timestamp: 1704067200 };

        const result = ChannelModule.extractPublishedDate(entry);

        expect(result).toBe('2024-01-01T00:00:00.000Z');
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
          availability: 'public',
          live_status: 'not_live'
        };

        const result = ChannelModule.parseVideoMetadata(entry);

        expect(result).toEqual({
          title: 'Test Video',
          youtube_id: 'video123',
          publishedAt: '2024-01-01T00:00:00.000Z',
          thumbnail: 'https://thumb.jpg',
          duration: 300,
          media_type: 'video',
          availability: 'public',
          live_status: 'not_live'
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
          publishedAt: null,
          thumbnail: 'https://i.ytimg.com/vi/video123/mqdefault.jpg',
          duration: 0,
          media_type: 'video',
          availability: null,
          live_status: null
        });
      });

      test('should include live_status field when provided', () => {
        const entry = {
          id: 'video123',
          title: 'Live Stream',
          live_status: 'was_live'
        };

        const result = ChannelModule.parseVideoMetadata(entry);

        expect(result.live_status).toBe('was_live');
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
          where: { channel_id: 'UC123', media_type: 'video' }
        });
        expect(ChannelVideo.findOne).toHaveBeenCalledWith({
          where: { channel_id: 'UC123', media_type: 'video' },
          order: [['publishedAt', 'ASC']],
          attributes: ['publishedAt']
        });
        expect(result).toEqual({
          totalCount: 100,
          oldestVideoDate: oldestDate
        });
      });

      test('should filter by mediaType parameter', async () => {
        ChannelVideo.count.mockResolvedValue(25);
        ChannelVideo.findOne.mockResolvedValue({ publishedAt: '2024-01-01' });

        await ChannelModule.getChannelVideoStats('UC123', false, '', 'short');

        expect(ChannelVideo.count).toHaveBeenCalledWith({
          where: { channel_id: 'UC123', media_type: 'short' }
        });
        expect(ChannelVideo.findOne).toHaveBeenCalledWith({
          where: { channel_id: 'UC123', media_type: 'short' },
          order: [['publishedAt', 'ASC']],
          attributes: ['publishedAt']
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
            enabled: true,
            auto_download_enabled_tabs: 'video,short',
            available_tabs: 'videos,shorts,livestream',
            sub_folder: null,
            video_quality: null,
          },
          {
            url: 'https://youtube.com/@channel2',
            uploader: 'Channel 2',
            channel_id: 'UC222',
            enabled: true,
            auto_download_enabled_tabs: 'video',
            available_tabs: 'videos,shorts',
            sub_folder: null,
            video_quality: null,
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
            channel_id: 'UC111',
            auto_download_enabled_tabs: 'video,short',
            available_tabs: 'videos,shorts,livestream',
            sub_folder: null,
            video_quality: null,
            min_duration: null,
            max_duration: null,
            title_filter_regex: null,
            audio_format: null,
          },
          {
            url: 'https://youtube.com/@channel2',
            uploader: 'Channel 2',
            channel_id: 'UC222',
            auto_download_enabled_tabs: 'video',
            available_tabs: 'videos,shorts',
            sub_folder: null,
            video_quality: null,
            min_duration: null,
            max_duration: null,
            title_filter_regex: null,
            audio_format: null,
          }
        ]);
      });

      test('should handle missing channel in database', async () => {
        Channel.findAll = jest.fn().mockResolvedValue([]);

        const result = await ChannelModule.readChannels();

        expect(result).toEqual([]);
      });

      test('should use default value for auto_download_enabled_tabs when null', async () => {
        const mockChannels = [
          {
            url: 'https://youtube.com/@channel1',
            uploader: 'Channel 1',
            channel_id: 'UC111',
            enabled: true,
            auto_download_enabled_tabs: null
          }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);

        const result = await ChannelModule.readChannels();

        expect(result[0].auto_download_enabled_tabs).toBe('video');
      });
    });

    describe('getChannelsPaginated', () => {
      beforeEach(() => {
        Channel.findAndCountAll = jest.fn().mockResolvedValue({
          rows: [],
          count: 0
        });
        Channel.findAll = jest.fn().mockResolvedValue([]);
      });

      test('returns paginated data with defaults applied', async () => {
        const mockChannels = [
          {
            url: 'https://youtube.com/@channel1',
            uploader: 'Channel 1',
            channel_id: 'UC111',
            auto_download_enabled_tabs: 'video'
          }
        ];

        Channel.findAndCountAll.mockResolvedValueOnce({
          rows: mockChannels,
          count: 25
        });
        Channel.findAll.mockResolvedValueOnce([
          { sub_folder: null },
          { sub_folder: '_Kids' },
        ]);

        const result = await ChannelModule.getChannelsPaginated({
          page: 2,
          pageSize: 10,
          sortBy: 'name',
          sortOrder: 'desc'
        });

        expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
          limit: 10,
          offset: 10,
          order: [['uploader', 'DESC']]
        }));

        expect(result).toEqual({
          channels: [
            {
              url: 'https://youtube.com/@channel1',
              uploader: 'Channel 1',
              channel_id: 'UC111',
              auto_download_enabled_tabs: 'video',
              available_tabs: null,
              sub_folder: null,
              video_quality: null,
              min_duration: null,
              max_duration: null,
              title_filter_regex: null,
              audio_format: null,
            }
          ],
          total: 25,
          page: 2,
          pageSize: 10,
          totalPages: 3,
          subFolders: ['__default__', '_Kids']
        });
      });

      test('applies search filtering when a term is provided', async () => {
        await ChannelModule.getChannelsPaginated({ searchTerm: 'Tech' });

        expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            enabled: true,
            [Op.or]: expect.any(Array)
          })
        }));
      });

      test('applies sub-folder filtering for default folder key', async () => {
        await ChannelModule.getChannelsPaginated({ subFolder: '__default__' });

        expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            sub_folder: expect.objectContaining({ [Op.or]: [null, ''] })
          })
        }));
      });

      test('applies sub-folder filtering for specific folder name', async () => {
        await ChannelModule.getChannelsPaginated({ subFolder: '_Kids' });

        expect(Channel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            sub_folder: '_Kids'
          })
        }));
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

        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            err: expect.any(Error)
          }),
          'Error updating channels in database'
        );
      });
    });

    describe('updateChannelsByDelta', () => {
      test('enables existing channel without fetching from YouTube', async () => {
        // Mock existing channel
        const mockChannel = {
          channel_id: 'UCexisting',
          url: 'https://youtube.com/@existingChannel',
          update: jest.fn().mockResolvedValue(true)
        };

        Channel.findOne = jest.fn().mockResolvedValue(mockChannel);
        Channel.update = jest.fn().mockResolvedValue([1]);
        jest.spyOn(ChannelModule, 'getChannelInfo');

        await ChannelModule.updateChannelsByDelta({
          enableUrls: ['https://youtube.com/@existingChannel'],
          disableUrls: ['https://youtube.com/@oldChannel']
        });

        // Should find channel by URL
        expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@existingChannel' } });

        // Should NOT call getChannelInfo since channel exists
        expect(ChannelModule.getChannelInfo).not.toHaveBeenCalled();

        // Should update the existing channel
        expect(mockChannel.update).toHaveBeenCalledWith({ enabled: true });

        // Should disable old channel
        expect(Channel.update).toHaveBeenCalledWith(
          { enabled: false },
          { where: { url: ['https://youtube.com/@oldChannel'] } }
        );
      });

      test('enables channel by channel_id when URL not found', async () => {
        // Mock channel found by channel_id, not URL
        const mockChannel = {
          channel_id: 'UCexisting',
          url: 'https://youtube.com/@differentUrl',
          update: jest.fn().mockResolvedValue(true)
        };

        Channel.findOne = jest.fn()
          .mockResolvedValueOnce(null) // Not found by URL
          .mockResolvedValueOnce(mockChannel); // Found by channel_id
        jest.spyOn(ChannelModule, 'getChannelInfo');

        await ChannelModule.updateChannelsByDelta({
          enableUrls: [{ url: 'https://youtube.com/@userInputUrl', channel_id: 'UCexisting' }]
        });

        // Should try to find by URL first
        expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@userInputUrl' } });

        // Should try to find by channel_id second
        expect(Channel.findOne).toHaveBeenCalledWith({ where: { channel_id: 'UCexisting' } });

        // Should NOT call getChannelInfo since channel exists
        expect(ChannelModule.getChannelInfo).not.toHaveBeenCalled();

        // Should update the existing channel
        expect(mockChannel.update).toHaveBeenCalledWith({ enabled: true });
      });

      test('fetches from YouTube when channel not found', async () => {
        Channel.findOne = jest.fn().mockResolvedValue(null);
        Channel.update = jest.fn().mockResolvedValue([1]);
        jest.spyOn(ChannelModule, 'getChannelInfo').mockResolvedValue({
          id: 'UCnew'
        });

        await ChannelModule.updateChannelsByDelta({
          enableUrls: ['https://youtube.com/@newChannel']
        });

        // Should try to find channel
        expect(Channel.findOne).toHaveBeenCalledWith({ where: { url: 'https://youtube.com/@newChannel' } });

        // Should call getChannelInfo as fallback
        expect(ChannelModule.getChannelInfo).toHaveBeenCalledWith(
          'https://youtube.com/@newChannel',
          false,
          true
        );

        // Should update with the fetched channel_id
        expect(Channel.update).toHaveBeenCalledWith(
          { enabled: true },
          { where: { channel_id: 'UCnew' } }
        );
      });

      test('propagates errors from getChannelInfo', async () => {
        Channel.findOne = jest.fn().mockResolvedValue(null); // Channel not found
        Channel.update = jest.fn();
        jest.spyOn(ChannelModule, 'getChannelInfo').mockRejectedValueOnce(new Error('Failed'));

        await expect(
          ChannelModule.updateChannelsByDelta({ enableUrls: ['https://youtube.com/@new'] })
        ).rejects.toThrow('Failed');
      });
    });

    describe('generateChannelsFile', () => {
      test('should generate temp file with enabled channel URLs for videos tab only', async () => {
        const mockChannels = [
          { channel_id: 'UC111', url: 'https://youtube.com/@channel1', auto_download_enabled_tabs: 'video' },
          { channel_id: 'UC222', url: 'https://youtube.com/@channel2', auto_download_enabled_tabs: 'video' }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);
        fsPromises.writeFile.mockResolvedValue();

        const tempPath = await ChannelModule.generateChannelsFile();

        expect(Channel.findAll).toHaveBeenCalledWith({
          where: { enabled: true },
          attributes: ['channel_id', 'url', 'auto_download_enabled_tabs']
        });

        expect(fsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('channels-temp-'),
          'https://www.youtube.com/channel/UC111/videos\nhttps://www.youtube.com/channel/UC222/videos'
        );

        expect(tempPath).toContain('channels-temp-');
      });

      test('should generate URLs for multiple enabled tabs', async () => {
        const mockChannels = [
          { channel_id: 'UC111', url: 'https://youtube.com/@channel1', auto_download_enabled_tabs: 'video,short,livestream' }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);
        fsPromises.writeFile.mockResolvedValue();

        await ChannelModule.generateChannelsFile();

        expect(fsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('channels-temp-'),
          'https://www.youtube.com/channel/UC111/videos\nhttps://www.youtube.com/channel/UC111/shorts\nhttps://www.youtube.com/channel/UC111/streams'
        );
      });

      test('should handle channels without channel_id', async () => {
        const mockChannels = [
          { channel_id: null, url: 'https://youtube.com/@channel1', auto_download_enabled_tabs: 'video' }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);
        fsPromises.writeFile.mockResolvedValue();

        await ChannelModule.generateChannelsFile();

        expect(fsPromises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('channels-temp-'),
          'https://youtube.com/@channel1'
        );
      });

      test('should throw error when auto_download_enabled_tabs is null', async () => {
        const mockChannels = [
          { channel_id: 'UC111', url: 'https://youtube.com/@channel1', auto_download_enabled_tabs: null }
        ];

        Channel.findAll = jest.fn().mockResolvedValue(mockChannels);
        fsPromises.writeFile.mockResolvedValue();

        await expect(ChannelModule.generateChannelsFile()).rejects.toThrow('No valid channel URLs to download');

        expect(logger.warn).toHaveBeenCalledWith('No URLs generated for channel downloads - all enabled channels have disabled tabs');
      });

      test('should handle error and cleanup temp file', async () => {
        Channel.findAll = jest.fn().mockRejectedValue(new Error('DB Error'));
        fsPromises.unlink.mockResolvedValue();

        await expect(ChannelModule.generateChannelsFile()).rejects.toThrow('DB Error');
      });
    });

    describe('channelAutoDownload', () => {
      let jobModule;

      beforeEach(() => {
        jobModule = require('../jobModule');
        jobModule.getAllJobs.mockReturnValue({});
        downloadModule.doChannelDownloads.mockClear();
      });

      test('should trigger channel downloads when no job is running', () => {
        jobModule.getAllJobs.mockReturnValue({});

        ChannelModule.channelAutoDownload();

        expect(downloadModule.doChannelDownloads).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            currentTime: expect.any(Date),
            interval: expect.any(String)
          }),
          'Running scheduled channel downloads'
        );
      });

      test('should skip channel downloads when job is in progress', () => {
        jobModule.getAllJobs.mockReturnValue({
          'job-123': { jobType: 'Channel Downloads', status: 'In Progress' }
        });

        ChannelModule.channelAutoDownload();

        expect(downloadModule.doChannelDownloads).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith('Skipping scheduled channel download - previous download still in progress');
      });

      test('should skip channel downloads when job is pending', () => {
        jobModule.getAllJobs.mockReturnValue({
          'job-456': { jobType: 'Channel Downloads', status: 'Pending' }
        });

        ChannelModule.channelAutoDownload();

        expect(downloadModule.doChannelDownloads).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith('Skipping scheduled channel download - previous download still in progress');
      });

      test('should trigger downloads when other job types are running', () => {
        jobModule.getAllJobs.mockReturnValue({
          'job-789': { jobType: 'Manually Added Urls', status: 'In Progress' }
        });

        ChannelModule.channelAutoDownload();

        expect(downloadModule.doChannelDownloads).toHaveBeenCalled();
      });
    });
  });

  describe('Response Builders', () => {
    describe('shouldRefreshChannelVideos', () => {
      test('should refresh if no channel record', () => {
        const result = ChannelModule.shouldRefreshChannelVideos(null, 10, 'video');
        expect(result).toBe(false);
      });

      test('should refresh if no lastFetchedByTab for this tab', () => {
        const channel = { ...mockChannelData, lastFetchedByTab: null };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10, 'video');
        expect(result).toBe(true);
      });

      test('should refresh if lastFetchedByTab is old for this tab', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({ video: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10, 'video');
        expect(result).toBe(true);
      });

      test('should refresh if no videos for this tab', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() })
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 0, 'video');
        expect(result).toBe(true);
      });

      test('should not refresh if recently fetched with videos for this tab', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({ video: new Date().toISOString() })
        };
        const result = ChannelModule.shouldRefreshChannelVideos(channel, 10, 'video');
        expect(result).toBe(false);
      });

      test('should refresh different tab independently', () => {
        const channel = {
          ...mockChannelData,
          lastFetchedByTab: JSON.stringify({ video: new Date().toISOString(), short: null })
        };
        // Video tab was just fetched, should not refresh
        expect(ChannelModule.shouldRefreshChannelVideos(channel, 10, 'video')).toBe(false);
        // Short tab has never been fetched, should refresh
        expect(ChannelModule.shouldRefreshChannelVideos(channel, 10, 'short')).toBe(true);
      });
    });

    describe('buildChannelVideosResponse', () => {
      test('should build successful response with tab-specific lastFetched', () => {
        const videos = [mockVideoData];
        const channel = mockChannelData;

        const result = ChannelModule.buildChannelVideosResponse(videos, channel, 'yt_dlp', null, false, 'video');

        expect(result).toEqual({
          videos: videos,
          videoFail: false,
          failureReason: null,
          dataSource: 'yt_dlp',
          lastFetched: new Date('2024-01-01'),
          totalCount: videos.length,
          oldestVideoDate: null,
          autoDownloadsEnabled: false,
          availableTabs: []
        });
      });

      test('should build failure response when no videos', () => {
        const result = ChannelModule.buildChannelVideosResponse([], mockChannelData, 'cache', null, false, 'video');

        expect(result).toEqual({
          videos: [],
          videoFail: true,
          failureReason: 'fetch_error',
          dataSource: 'cache',
          lastFetched: new Date('2024-01-01'),
          totalCount: 0,
          oldestVideoDate: null,
          autoDownloadsEnabled: false,
          availableTabs: []
        });
      });

      test('should return null lastFetched for unfetched tab', () => {
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', null, false, 'short');
        expect(result.lastFetched).toBeNull();
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

      test('should include autoDownloadsEnabled parameter', () => {
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache', null, true);

        expect(result.autoDownloadsEnabled).toBe(true);
      });

      test('should default autoDownloadsEnabled to false', () => {
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], mockChannelData, 'cache');

        expect(result.autoDownloadsEnabled).toBe(false);
      });
    });

    describe('getChannelVideos', () => {
      test('should return paginated videos with stats', async () => {
        const Video = require('../../models/video');
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

        const result = await ChannelModule.getChannelVideos('UC123', 1, 50);

        expect(result.videos).toBeDefined();
        expect(result.totalCount).toBe(10);
        expect(result.oldestVideoDate).toBe('2023-01-01');
      });

      test('should skip auto-refresh when fetch already in progress', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, lastFetchedByTab: null, auto_download_enabled_tabs: 'video' };

        Channel.findOne.mockResolvedValue(mockChannel);
        ChannelVideo.findAll.mockResolvedValue([]);
        ChannelVideo.count.mockResolvedValue(0);
        Video.findAll = jest.fn().mockResolvedValue([]);

        // Simulate an active fetch using composite key (channelId:tabType)
        ChannelModule.activeFetches.set('UC123:videos', {
          startTime: new Date().toISOString(),
          type: 'fetchAll',
          tabType: 'videos'
        });

        const result = await ChannelModule.getChannelVideos('UC123');

        // Should not throw, should return cached data
        expect(result.videos).toBeDefined();
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ channelId: 'UC123', tabType: 'videos' }),
          'Skipping auto-refresh - fetch already in progress for this tab'
        );

        // Clean up
        ChannelModule.activeFetches.delete('UC123:videos');
      });

      test('should handle errors and return cached data', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, auto_download_enabled_tabs: 'video' };
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
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            err: expect.any(Error),
            channelId: 'UC123'
          }),
          'Error fetching channel videos'
        );
      });
    });

    describe('fetchAllChannelVideos', () => {
      test('should fetch all videos and return paginated results', async () => {
        const Video = require('../../models/video');
        const mockChannel = { ...mockChannelData, save: jest.fn(), reload: jest.fn(), url: 'https://youtube.com/@test' };

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
        expect(mockChannel.reload).toHaveBeenCalled();
      });

      test('should throw error when fetch already in progress', async () => {
        // Use composite key (channelId:tabType) since we now track per-tab
        ChannelModule.activeFetches.set('UC123:videos', {
          startTime: new Date().toISOString(),
          type: 'autoRefresh',
          tabType: 'videos'
        });

        await expect(ChannelModule.fetchAllChannelVideos('UC123')).rejects.toThrow('fetch operation is already in progress');

        // Clean up
        ChannelModule.activeFetches.delete('UC123:videos');
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
          save: jest.fn(),
          reload: jest.fn()
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

    describe('getChannelAvailableTabs', () => {
      test('should return cached available tabs if already stored', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: 'videos,shorts'
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        const result = await ChannelModule.getChannelAvailableTabs('UC123');

        expect(result).toEqual({ availableTabs: ['videos', 'shorts'] });
        expect(Channel.findOne).toHaveBeenCalledWith({
          where: { channel_id: 'UC123' }
        });
      });

      test('should detect tabs when not cached and return results', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: null,
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        // Spy on detectAndSaveChannelTabs to return detected tabs
        const detectSpy = jest.spyOn(ChannelModule, 'detectAndSaveChannelTabs')
          .mockResolvedValue({ availableTabs: ['videos', 'shorts'], autoDownloadEnabledTabs: 'video' });

        const result = await ChannelModule.getChannelAvailableTabs('UC123');

        // Should await detection and return results
        expect(result).toEqual({ availableTabs: ['videos', 'shorts'] });
        expect(detectSpy).toHaveBeenCalledWith('UC123');

        detectSpy.mockRestore();
      });

      test('should throw error when channel not found', async () => {
        Channel.findOne.mockResolvedValue(null);

        await expect(ChannelModule.getChannelAvailableTabs('UC999')).rejects.toThrow('Channel not found in database');
      });

      test('should return empty array when detection returns null', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: null,
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        // Spy on detectAndSaveChannelTabs to return null (detection failed/skipped)
        const detectSpy = jest.spyOn(ChannelModule, 'detectAndSaveChannelTabs').mockResolvedValue(null);

        const result = await ChannelModule.getChannelAvailableTabs('UC123');

        // Should return empty array when detection fails
        expect(result).toEqual({ availableTabs: [] });
        expect(detectSpy).toHaveBeenCalledWith('UC123');

        detectSpy.mockRestore();
      });
    });

    describe('detectAndSaveChannelTabs', () => {
      test('should detect and save available tabs and return results', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: null,
          title: 'Test Channel'
        };
        Channel.findOne.mockResolvedValue(mockChannel);
        Channel.update.mockResolvedValue([1]);

        // Mock fetch responses for RSS feed checks:
        // - videos tab exists (200 OK)
        // - shorts tab exists (200 OK)
        // - streams tab doesn't exist (404)
        const originalFetch = global.fetch;
        global.fetch = jest.fn((url) => {
          if (url.includes('UULF')) {
            // Videos tab - exists
            return Promise.resolve({ status: 200 });
          } else if (url.includes('UUSH')) {
            // Shorts tab - exists
            return Promise.resolve({ status: 200 });
          } else if (url.includes('UULV')) {
            // Streams tab - doesn't exist
            return Promise.resolve({ status: 404 });
          }
          return Promise.resolve({ status: 404 });
        });

        try {
          const result = await ChannelModule.detectAndSaveChannelTabs('UC123');

          expect(Channel.update).toHaveBeenCalledWith(
            expect.objectContaining({
              available_tabs: 'videos,shorts',
              auto_download_enabled_tabs: 'video'
            }),
            { where: { channel_id: 'UC123' } }
          );

          // Should return detected tabs
          expect(result).toEqual({
            availableTabs: ['videos', 'shorts'],
            autoDownloadEnabledTabs: 'video'
          });
        } finally {
          global.fetch = originalFetch;
        }
      });

      test('should return null if already detecting', async () => {
        // Simulate already detecting
        ChannelModule.activeFetches.set('tabs-UC123', { startTime: new Date().toISOString(), type: 'tabDetection' });

        const result = await ChannelModule.detectAndSaveChannelTabs('UC123');

        // Should not call Channel.findOne since we skipped
        expect(Channel.findOne).not.toHaveBeenCalled();
        // Should return null
        expect(result).toBeNull();

        // Cleanup
        ChannelModule.activeFetches.delete('tabs-UC123');
      });

      test('should return cached values if tabs already populated', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: 'videos,shorts', // Already populated
          auto_download_enabled_tabs: 'video,short'
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        const result = await ChannelModule.detectAndSaveChannelTabs('UC123');

        // Should not call Channel.update since tabs already exist
        expect(Channel.update).not.toHaveBeenCalled();
        // Should return cached values
        expect(result).toEqual({
          availableTabs: ['videos', 'shorts'],
          autoDownloadEnabledTabs: 'video,short'
        });
      });

      test('should fallback to videos tab when all RSS checks fail', async () => {
        const mockChannel = {
          ...mockChannelData,
          available_tabs: null, // Not yet populated
          auto_download_enabled_tabs: null
        };
        Channel.findOne.mockResolvedValue(mockChannel);
        Channel.update.mockResolvedValue([1]);

        // Mock fetch to always reject (simulating network timeout/failure)
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

        try {
          const result = await ChannelModule.detectAndSaveChannelTabs('UC123');

          // Should fallback to videos tab
          expect(result).toEqual({
            availableTabs: ['videos'],
            autoDownloadEnabledTabs: 'video'
          });

          // Should save the fallback to the database
          expect(Channel.update).toHaveBeenCalledWith(
            expect.objectContaining({
              available_tabs: 'videos',
              auto_download_enabled_tabs: 'video'
            }),
            expect.anything()
          );
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('buildRssFeedUrl', () => {
      test('should build correct URL for videos tab', () => {
        const url = ChannelModule.buildRssFeedUrl('UCwaNuezahYT3BOjfXsne2mg', 'videos');
        expect(url).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=UULFwaNuezahYT3BOjfXsne2mg');
      });

      test('should build correct URL for shorts tab', () => {
        const url = ChannelModule.buildRssFeedUrl('UCwaNuezahYT3BOjfXsne2mg', 'shorts');
        expect(url).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=UUSHwaNuezahYT3BOjfXsne2mg');
      });

      test('should build correct URL for streams tab', () => {
        const url = ChannelModule.buildRssFeedUrl('UCwaNuezahYT3BOjfXsne2mg', 'streams');
        expect(url).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=UULVwaNuezahYT3BOjfXsne2mg');
      });

      test('should throw error for unknown tab type', () => {
        expect(() => ChannelModule.buildRssFeedUrl('UCwaNuezahYT3BOjfXsne2mg', 'unknown'))
          .toThrow('Unknown tab type: unknown');
      });
    });

    describe('checkTabExistsViaRss', () => {
      test('should return true when RSS feed returns 200', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({ status: 200 });

        try {
          const exists = await ChannelModule.checkTabExistsViaRss('UC123', 'videos');
          expect(exists).toBe(true);
          expect(global.fetch).toHaveBeenCalledWith(
            'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF123',
            expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
          );
        } finally {
          global.fetch = originalFetch;
        }
      });

      test('should return false when RSS feed returns 404', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({ status: 404 });

        try {
          const exists = await ChannelModule.checkTabExistsViaRss('UC123', 'videos');
          expect(exists).toBe(false);
        } finally {
          global.fetch = originalFetch;
        }
      });

      test('should return false on network error', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        try {
          const exists = await ChannelModule.checkTabExistsViaRss('UC123', 'videos');
          expect(exists).toBe(false);
        } finally {
          global.fetch = originalFetch;
        }
      });

      test('should return true for non-404 error codes (e.g., 500)', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({ status: 500 });

        try {
          const exists = await ChannelModule.checkTabExistsViaRss('UC123', 'videos');
          expect(exists).toBe(true); // Non-404 means the feed exists, even if there's an error
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('updateAutoDownloadForTab', () => {
      test('should enable auto download for a tab type', async () => {
        const mockChannel = {
          ...mockChannelData,
          auto_download_enabled_tabs: 'video',
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        await ChannelModule.updateAutoDownloadForTab('UC123', 'shorts', true);

        expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
        expect(mockChannel.save).toHaveBeenCalled();
      });

      test('should disable auto download for a tab type', async () => {
        const mockChannel = {
          ...mockChannelData,
          auto_download_enabled_tabs: 'video,short,livestream',
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        await ChannelModule.updateAutoDownloadForTab('UC123', 'shorts', false);

        expect(mockChannel.auto_download_enabled_tabs).toBe('video,livestream');
        expect(mockChannel.save).toHaveBeenCalled();
      });

      test('should not duplicate tab types when already enabled', async () => {
        const mockChannel = {
          ...mockChannelData,
          auto_download_enabled_tabs: 'video,short',
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        await ChannelModule.updateAutoDownloadForTab('UC123', 'shorts', true);

        expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
        expect(mockChannel.save).toHaveBeenCalled();
      });

      test('should handle null auto_download_enabled_tabs', async () => {
        const mockChannel = {
          ...mockChannelData,
          auto_download_enabled_tabs: null,
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        await ChannelModule.updateAutoDownloadForTab('UC123', 'shorts', true);

        expect(mockChannel.auto_download_enabled_tabs).toBe('video,short');
        expect(mockChannel.save).toHaveBeenCalled();
      });

      test('should throw error when channel not found', async () => {
        Channel.findOne.mockResolvedValue(null);

        await expect(ChannelModule.updateAutoDownloadForTab('UC999', 'videos', true)).rejects.toThrow('Channel not found in database');
      });

      test('should handle disabling all tabs', async () => {
        const mockChannel = {
          ...mockChannelData,
          auto_download_enabled_tabs: 'video',
          save: jest.fn()
        };
        Channel.findOne.mockResolvedValue(mockChannel);

        await ChannelModule.updateAutoDownloadForTab('UC123', 'videos', false);

        expect(mockChannel.auto_download_enabled_tabs).toBe('');
        expect(mockChannel.save).toHaveBeenCalled();
      });
    });
  });

  describe('resolveChannelFolderName', () => {
    let originalFetchChannelMetadata;

    beforeEach(() => {
      // Store original method so we can mock it per-test
      originalFetchChannelMetadata = ChannelModule.fetchChannelMetadata;
    });

    afterEach(() => {
      // Restore original method
      ChannelModule.fetchChannelMetadata = originalFetchChannelMetadata;
    });

    test('should return folder_name when available (fast path)', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: 'Sanitized Channel Name',
        uploader: 'Original Uploader Name'
      };

      // Mock fetchChannelMetadata to verify it's not called
      const mockFetchChannelMetadata = jest.fn();
      ChannelModule.fetchChannelMetadata = mockFetchChannelMetadata;

      const result = await ChannelModule.resolveChannelFolderName(channel);

      expect(result).toBe('Sanitized Channel Name');
      // Should not call fetchChannelMetadata when folder_name exists
      expect(mockFetchChannelMetadata).not.toHaveBeenCalled();
    });

    test('should call fetchChannelMetadata and save result when folder_name is null', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Original Uploader'
      };

      // Mock fetchChannelMetadata to return folder_name
      ChannelModule.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: 'Sanitized Folder Name'
      });

      Channel.update.mockResolvedValue([1]);

      const result = await ChannelModule.resolveChannelFolderName(channel);

      expect(result).toBe('Sanitized Folder Name');
      expect(ChannelModule.fetchChannelMetadata).toHaveBeenCalledWith(
        'https://www.youtube.com/channel/UC123'
      );
      expect(Channel.update).toHaveBeenCalledWith(
        { folder_name: 'Sanitized Folder Name' },
        { where: { channel_id: 'UC123' } }
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', folderName: 'Sanitized Folder Name' }),
        'Populated folder_name via yt-dlp fallback'
      );
    });

    test('should fallback to uploader when fetchChannelMetadata fails', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Fallback Uploader Name'
      };

      // Mock fetchChannelMetadata failing
      ChannelModule.fetchChannelMetadata = jest.fn().mockRejectedValue(new Error('yt-dlp failed'));

      // Mock sanitizeNameLikeYtDlp to return the uploader as-is for this test
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Uploader Name');

      const result = await ChannelModule.resolveChannelFolderName(channel);

      expect(result).toBe('Fallback Uploader Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', uploader: 'Fallback Uploader Name' }),
        'Could not determine folder_name via yt-dlp, using uploader as fallback'
      );
    });

    test('should handle empty string folder_name as missing', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: '', // Empty string should be treated as falsy
        uploader: 'Fallback Uploader'
      };

      // Mock fetchChannelMetadata failing to trigger fallback
      ChannelModule.fetchChannelMetadata = jest.fn().mockRejectedValue(new Error('yt-dlp failed'));

      // Mock sanitizeNameLikeYtDlp to return the uploader as-is for this test
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Uploader');

      const result = await ChannelModule.resolveChannelFolderName(channel);

      // Empty string is falsy, so should try fetchChannelMetadata and fall back to uploader
      expect(result).toBe('Fallback Uploader');
      expect(ChannelModule.fetchChannelMetadata).toHaveBeenCalled();
    });

    test('should continue even if database update fails', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Original Uploader'
      };

      // Mock successful fetchChannelMetadata
      ChannelModule.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: 'Sanitized Name'
      });

      // Mock database update failing
      Channel.update.mockRejectedValue(new Error('Database error'));

      const result = await ChannelModule.resolveChannelFolderName(channel);

      // Should still return the folder name even if DB update fails
      expect(result).toBe('Sanitized Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123' }),
        'Failed to save folder_name to database'
      );
    });

    test('should fallback to uploader when fetchChannelMetadata returns no folder_name', async () => {
      const channel = {
        channel_id: 'UC123',
        folder_name: null,
        uploader: 'Fallback Name'
      };

      // Mock fetchChannelMetadata returning metadata without folder_name
      ChannelModule.fetchChannelMetadata = jest.fn().mockResolvedValue({
        uploader: 'Channel Uploader',
        folder_name: null
      });

      // Mock sanitizeNameLikeYtDlp
      filesystem.sanitizeNameLikeYtDlp.mockReturnValue('Fallback Name');

      const result = await ChannelModule.resolveChannelFolderName(channel);

      expect(result).toBe('Fallback Name');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC123', uploader: 'Fallback Name' }),
        'Could not determine folder_name via yt-dlp, using uploader as fallback'
      );
    });
  });

  describe('extractAvatarThumbnailUrl', () => {
    test('should return null when thumbnails is not an array', () => {
      const channelData = { channel_id: 'UC123', thumbnails: null };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should return null when thumbnails is undefined', () => {
      const channelData = { channel_id: 'UC123' };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should prefer 900x900 thumbnail', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/small.jpg', width: 100, height: 100 },
          { url: 'https://example.com/large.jpg', width: 900, height: 900 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/large.jpg');
    });

    test('should fallback to any square thumbnail', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/square.jpg', width: 200, height: 200 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/square.jpg');
    });

    test('should fallback to avatar_uncropped as last resort', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/non-square.jpg', width: 100, height: 200 },
          { url: 'https://example.com/avatar.jpg', id: 'avatar_uncropped' }
        ]
      };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBe('https://example.com/avatar.jpg');
    });

    test('should return null when no suitable thumbnail found', () => {
      const channelData = {
        channel_id: 'UC123',
        thumbnails: [
          { url: 'https://example.com/non-square.jpg', width: 100, height: 200 }
        ]
      };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });

    test('should return null when thumbnails array is empty', () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const result = ChannelModule.extractAvatarThumbnailUrl(channelData);
      expect(result).toBeNull();
    });
  });

  describe('processChannelThumbnail', () => {
    let originalExtractAvatarThumbnailUrl;
    let originalDownloadChannelThumbnailFromUrl;
    let originalDownloadChannelThumbnailViaYtdlp;
    let originalResizeChannelThumbnail;

    beforeEach(() => {
      originalExtractAvatarThumbnailUrl = ChannelModule.extractAvatarThumbnailUrl;
      originalDownloadChannelThumbnailFromUrl = ChannelModule.downloadChannelThumbnailFromUrl;
      originalDownloadChannelThumbnailViaYtdlp = ChannelModule.downloadChannelThumbnailViaYtdlp;
      originalResizeChannelThumbnail = ChannelModule.resizeChannelThumbnail;
    });

    afterEach(() => {
      ChannelModule.extractAvatarThumbnailUrl = originalExtractAvatarThumbnailUrl;
      ChannelModule.downloadChannelThumbnailFromUrl = originalDownloadChannelThumbnailFromUrl;
      ChannelModule.downloadChannelThumbnailViaYtdlp = originalDownloadChannelThumbnailViaYtdlp;
      ChannelModule.resizeChannelThumbnail = originalResizeChannelThumbnail;
    });

    test('should download from URL when avatar thumbnail is found', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      ChannelModule.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      ChannelModule.downloadChannelThumbnailFromUrl = jest.fn().mockResolvedValue();
      ChannelModule.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await ChannelModule.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(ChannelModule.extractAvatarThumbnailUrl).toHaveBeenCalledWith(channelData);
      expect(ChannelModule.downloadChannelThumbnailFromUrl).toHaveBeenCalledWith('https://example.com/avatar.jpg', channelId);
      expect(ChannelModule.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });

    test('should fallback to yt-dlp when URL download fails', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      ChannelModule.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      ChannelModule.downloadChannelThumbnailFromUrl = jest.fn().mockRejectedValue(new Error('Download failed'));
      ChannelModule.downloadChannelThumbnailViaYtdlp = jest.fn().mockResolvedValue();
      ChannelModule.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await ChannelModule.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(ChannelModule.downloadChannelThumbnailFromUrl).toHaveBeenCalled();
      expect(ChannelModule.downloadChannelThumbnailViaYtdlp).toHaveBeenCalledWith(channelUrl);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId }),
        'Failed to download thumbnail via HTTP, falling back to yt-dlp'
      );
    });

    test('should use yt-dlp when no avatar thumbnail URL found', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      ChannelModule.extractAvatarThumbnailUrl = jest.fn().mockReturnValue(null);
      ChannelModule.downloadChannelThumbnailViaYtdlp = jest.fn().mockResolvedValue();
      ChannelModule.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await ChannelModule.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(ChannelModule.downloadChannelThumbnailViaYtdlp).toHaveBeenCalledWith(channelUrl);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ channelId }),
        'No avatar thumbnail URL found in metadata, using yt-dlp'
      );
    });

    test('should always call resizeChannelThumbnail at the end', async () => {
      const channelData = { channel_id: 'UC123', thumbnails: [] };
      const channelId = 'UC123';
      const channelUrl = 'https://www.youtube.com/@testchannel';

      ChannelModule.extractAvatarThumbnailUrl = jest.fn().mockReturnValue('https://example.com/avatar.jpg');
      ChannelModule.downloadChannelThumbnailFromUrl = jest.fn().mockResolvedValue();
      ChannelModule.resizeChannelThumbnail = jest.fn().mockResolvedValue();

      await ChannelModule.processChannelThumbnail(channelData, channelId, channelUrl);

      expect(ChannelModule.resizeChannelThumbnail).toHaveBeenCalledWith(channelId);
    });
  });

  describe('downloadChannelThumbnailFromUrl', () => {
    let fsExtra;
    let mockWriteStream;
    let mockRequest;
    let mockResponse;
    let originalGet;
    let originalCreateWriteStream;

    beforeEach(() => {
      originalGet = realHttps.get;
      fsExtra = require('fs-extra');
      originalCreateWriteStream = fsExtra.createWriteStream;

      mockWriteStream = {
        on: jest.fn(),
        close: jest.fn(),
      };
      fsExtra.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);

      mockRequest = {
        on: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
      };

      mockResponse = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };
    });

    afterEach(() => {
      realHttps.get = originalGet;
      fsExtra.createWriteStream = originalCreateWriteStream;
    });

    test('should pass timeout option to protocol.get', async () => {
      realHttps.get = jest.fn((url, opts, cb) => {
        cb(mockResponse);
        const finishCb = mockWriteStream.on.mock.calls.find(c => c[0] === 'finish')[1];
        finishCb();
        return mockRequest;
      });

      await ChannelModule.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

      expect(realHttps.get).toHaveBeenCalledWith(
        'https://example.com/thumb.jpg',
        expect.objectContaining({ timeout: 15000 }),
        expect.any(Function)
      );
    });

    test('should reject and clean up partial file on timeout', async () => {
      fsExtra.existsSync = jest.fn().mockReturnValue(true);
      fsExtra.unlinkSync = jest.fn();

      realHttps.get = jest.fn(() => {
        return mockRequest;
      });

      const promise = ChannelModule.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

      const timeoutHandler = mockRequest.on.mock.calls.find(c => c[0] === 'timeout')[1];
      timeoutHandler();

      await expect(promise).rejects.toThrow('Thumbnail download timed out');
      expect(mockRequest.destroy).toHaveBeenCalled();
      expect(mockWriteStream.close).toHaveBeenCalled();
      expect(fsExtra.unlinkSync).toHaveBeenCalled();
    });

    test('should reject on network error and clean up', async () => {
      fsExtra.existsSync = jest.fn().mockReturnValue(true);
      fsExtra.unlinkSync = jest.fn();

      realHttps.get = jest.fn(() => {
        return mockRequest;
      });

      const promise = ChannelModule.downloadChannelThumbnailFromUrl('https://example.com/thumb.jpg', 'UC123');

      const errorHandler = mockRequest.on.mock.calls.find(c => c[0] === 'error')[1];
      errorHandler(new Error('ECONNREFUSED'));

      await expect(promise).rejects.toThrow('ECONNREFUSED');
      expect(mockWriteStream.close).toHaveBeenCalled();
      expect(fsExtra.unlinkSync).toHaveBeenCalled();
    });
  });
});
