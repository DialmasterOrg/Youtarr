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

describe('ChannelModule', () => {
  let ChannelModule;
  let fs;
  let fsPromises;
  let childProcess;
  let cron;
  let configModule;
  let downloadModule;
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

    describe('readCompleteList', () => {
      test('should read and parse complete.list file', () => {
        const mockCompleteList = 'youtube video1\nyoutube video2\n\nyoutube video3';
        fs.readFileSync.mockReturnValue(mockCompleteList);

        const result = ChannelModule.readCompleteList();

        expect(fs.readFileSync).toHaveBeenCalledWith(
          expect.stringContaining('complete.list'),
          'utf-8'
        );
        expect(result).toEqual(['youtube video1', 'youtube video2', 'youtube video3']);
      });

      test('should handle empty complete.list', () => {
        fs.readFileSync.mockReturnValue('');

        const result = ChannelModule.readCompleteList();

        expect(result).toEqual([]);
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
          url: channelData.url
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
          url: channelData.url
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
          url: channelData.url
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
          publishedAt: mockVideoData.publishedAt,
          availability: mockVideoData.availability
        });
      });
    });
  });

  describe('Video Operations', () => {
    describe('enrichVideosWithDownloadStatus', () => {
      test('should add download status to videos', () => {
        fs.readFileSync.mockReturnValue('youtube video1\nyoutube video2');

        const videos = [
          { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
          { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) },
          { youtube_id: 'video3', toJSON: () => ({ youtube_id: 'video3' }) }
        ];

        const result = ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(result[0].added).toBe(true);
        expect(result[1].added).toBe(true);
        expect(result[2].added).toBe(false);
      });

      test('should handle plain objects without toJSON', () => {
        fs.readFileSync.mockReturnValue('youtube video1');

        const videos = [
          { youtube_id: 'video1' },
          { youtube_id: 'video2' }
        ];

        const result = ChannelModule.enrichVideosWithDownloadStatus(videos);

        expect(result[0].added).toBe(true);
        expect(result[1].added).toBe(false);
      });
    });

    describe('fetchNewestVideosFromDb', () => {
      test('should fetch videos from database with download status', async () => {
        const mockVideos = [
          { youtube_id: 'video1', toJSON: () => ({ youtube_id: 'video1' }) },
          { youtube_id: 'video2', toJSON: () => ({ youtube_id: 'video2' }) }
        ];
        ChannelVideo.findAll.mockResolvedValue(mockVideos);
        fs.readFileSync.mockReturnValue('youtube video1');

        const result = await ChannelModule.fetchNewestVideosFromDb('UC123');

        expect(ChannelVideo.findAll).toHaveBeenCalledWith({
          where: { channel_id: 'UC123' },
          order: [['publishedAt', 'DESC']],
          limit: 50
        });
        expect(result[0].added).toBe(true);
        expect(result[1].added).toBe(false);
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
          availability: null
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
        jest.spyOn(ChannelModule, 'getChannelInfo').mockResolvedValue({});

        await ChannelModule.writeChannels(channelUrls);

        expect(ChannelModule.getChannelInfo).toHaveBeenCalledTimes(1);
        expect(ChannelModule.getChannelInfo).toHaveBeenCalledWith(
          'https://youtube.com/@channel2'
        );

        expect(Channel.update).toHaveBeenCalledWith(
          { enabled: true },
          { where: { url: 'https://youtube.com/@channel2' } }
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
          lastFetched: channel.lastFetched
        });
      });

      test('should build failure response when no videos', () => {
        const result = ChannelModule.buildChannelVideosResponse([], mockChannelData, 'cache');

        expect(result).toEqual({
          videos: [],
          videoFail: true,
          failureReason: 'fetch_error',
          dataSource: 'cache',
          lastFetched: mockChannelData.lastFetched
        });
      });

      test('should handle null channel', () => {
        const result = ChannelModule.buildChannelVideosResponse([mockVideoData], null);

        expect(result.lastFetched).toBeNull();
      });
    });
  });
});
