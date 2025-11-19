/* eslint-env jest */

// Mock fs first to prevent configModule from reading files
jest.mock('fs');

// Mock all modules before requiring them
jest.mock('../configModule', () => {
  const EventEmitter = require('events');
  const mockConfigModule = new EventEmitter();
  mockConfigModule.getConfig = jest.fn().mockReturnValue({
    preferredResolution: '1080',
    channelFilesToDownload: 3,
  });
  mockConfigModule.config = {
    preferredResolution: '1080',
    channelFilesToDownload: 3
  };
  mockConfigModule.on = jest.fn();
  return mockConfigModule;
});

jest.mock('../jobModule', () => ({
  addOrUpdateJob: jest.fn(),
  updateJob: jest.fn(),
  getJob: jest.fn().mockReturnValue({ status: 'Pending' })
}));

jest.mock('../download/downloadExecutor');
jest.mock('../download/ytdlpCommandBuilder');
jest.mock('../channelModule', () => ({
  generateChannelsFile: jest.fn(),
  resolveChannelUrlFromId: jest.fn()
}));
jest.mock('../../models/channel', () => ({
  findOne: jest.fn()
}));
jest.mock('../channelDownloadGrouper', () => ({
  generateDownloadGroups: jest.fn()
}));
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

const fs = require('fs');

describe('DownloadModule', () => {
  let downloadModule;
  let mockDownloadExecutor;
  let fsPromises;
  let consoleLogSpy;
  let consoleErrorSpy;
  let logger;
  let ChannelModelMock;

  beforeAll(() => {
    // Setup fs promises mock
    fsPromises = {
      unlink: jest.fn(),
      writeFile: jest.fn()
    };
    fs.promises = fsPromises;
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset fs promise mocks
    fsPromises.unlink.mockResolvedValue();
    fsPromises.writeFile.mockResolvedValue();
    // Re-assign fs.promises after clearing mocks to ensure it's available
    fs.promises = fsPromises;

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Clear module cache and require fresh instance
    jest.resetModules();
    // Re-set fs.promises after resetModules
    const fsAfterReset = require('fs');
    fsAfterReset.promises = fsPromises;

    // Re-setup all mocks after resetModules
    const DownloadExecutorMock = require('../download/downloadExecutor');
    mockDownloadExecutor = {
      doDownload: jest.fn(),
      tempChannelsFile: null
    };
    DownloadExecutorMock.mockImplementation(() => mockDownloadExecutor);

    const YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');
    YtdlpCommandBuilderMock.getBaseCommandArgs = jest.fn().mockReturnValue([
      '--format', 'best[height<=1080]',
      '--output', '/mock/output/dir'
    ]);
    YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload = jest.fn().mockImplementation((resolution, allowRedownload) => {
      const res = resolution || '1080';
      const baseArgs = [
        '--format', `best[height<=${res}]`,
        '--output', '/mock/output/dir'
      ];
      // Include download archive flag only when NOT allowing re-downloads
      if (!allowRedownload) {
        baseArgs.push('--download-archive', './config/complete.list');
      }
      return baseArgs;
    });

    const jobModuleMock = require('../jobModule');
    jobModuleMock.addOrUpdateJob = jest.fn().mockResolvedValue('job-123');
    jobModuleMock.updateJob = jest.fn().mockResolvedValue();
    jobModuleMock.getJob = jest.fn().mockReturnValue({ status: 'Pending' });

    const channelModuleMock = require('../channelModule');
    channelModuleMock.generateChannelsFile = jest.fn();
    channelModuleMock.resolveChannelUrlFromId = jest.fn((id) => `https://youtube.com/channel/${id}`);

    ChannelModelMock = require('../../models/channel');
    ChannelModelMock.findOne.mockResolvedValue(null);

    const channelDownloadGrouperMock = require('../channelDownloadGrouper');
    channelDownloadGrouperMock.generateDownloadGroups = jest.fn().mockResolvedValue(null);

    logger = require('../../logger');
    logger.info.mockClear();
    logger.error.mockClear();

    downloadModule = require('../downloadModule');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with config and download executor', () => {
      expect(downloadModule.config).toEqual({
        preferredResolution: '1080',
        channelFilesToDownload: 3,
      });
      expect(downloadModule.downloadExecutor).toBeDefined();
    });
  });

  describe('handleConfigChange', () => {
    it('should update config when configuration changes', () => {
      const newConfig = {
        preferredResolution: '720',
        channelFilesToDownload: 5,
      };

      downloadModule.handleConfigChange(newConfig);

      expect(downloadModule.config).toEqual(newConfig);
    });
  });

  describe('getJobDataValue', () => {
    it('should return value from direct property', () => {
      const jobData = { channelId: 'UC123', someValue: 'test' };
      expect(downloadModule.getJobDataValue(jobData, 'channelId')).toBe('UC123');
      expect(downloadModule.getJobDataValue(jobData, 'someValue')).toBe('test');
    });

    it('should return value from nested data property', () => {
      const jobData = {
        id: 'job-456',
        data: {
          channelId: 'UC789',
          overrideSettings: { resolution: '720' }
        }
      };
      expect(downloadModule.getJobDataValue(jobData, 'channelId')).toBe('UC789');
      expect(downloadModule.getJobDataValue(jobData, 'overrideSettings')).toEqual({ resolution: '720' });
    });

    it('should prioritize direct property over nested data', () => {
      const jobData = {
        channelId: 'UC123',
        data: {
          channelId: 'UC789'
        }
      };
      expect(downloadModule.getJobDataValue(jobData, 'channelId')).toBe('UC123');
    });

    it('should return undefined when property does not exist', () => {
      const jobData = { someValue: 'test' };
      expect(downloadModule.getJobDataValue(jobData, 'nonExistent')).toBeUndefined();
    });

    it('should handle null or undefined jobData', () => {
      expect(downloadModule.getJobDataValue(null, 'channelId')).toBeUndefined();
      expect(downloadModule.getJobDataValue(undefined, 'channelId')).toBeUndefined();
    });

    it('should handle jobData without nested data property', () => {
      const jobData = { channelId: 'UC123' };
      expect(downloadModule.getJobDataValue(jobData, 'channelId')).toBe('UC123');
    });
  });

  describe('setJobDataValue', () => {
    it('should set value on direct property', () => {
      const jobData = {};
      downloadModule.setJobDataValue(jobData, 'channelId', 'UC123');
      expect(jobData.channelId).toBe('UC123');
    });

    it('should set value on both direct and nested data properties', () => {
      const jobData = { data: {} };
      downloadModule.setJobDataValue(jobData, 'effectiveQuality', '720');
      expect(jobData.effectiveQuality).toBe('720');
      expect(jobData.data.effectiveQuality).toBe('720');
    });

    it('should handle null or undefined jobData', () => {
      expect(() => downloadModule.setJobDataValue(null, 'key', 'value')).not.toThrow();
      expect(() => downloadModule.setJobDataValue(undefined, 'key', 'value')).not.toThrow();
    });

    it('should create nested data property if not present', () => {
      const jobData = { channelId: 'UC123' };
      downloadModule.setJobDataValue(jobData, 'effectiveQuality', '1080');
      expect(jobData.effectiveQuality).toBe('1080');
      expect(jobData.data).toBeUndefined();
    });
  });

  describe('getOverrideSettings', () => {
    it('should return override settings from direct property', () => {
      const jobData = {
        overrideSettings: {
          resolution: '720',
          videoCount: 5,
          allowRedownload: true
        }
      };
      const result = downloadModule.getOverrideSettings(jobData);
      expect(result).toEqual({
        resolution: '720',
        videoCount: 5,
        allowRedownload: true
      });
    });

    it('should return override settings from nested data property', () => {
      const jobData = {
        data: {
          overrideSettings: {
            resolution: '480',
            videoCount: 10
          }
        }
      };
      const result = downloadModule.getOverrideSettings(jobData);
      expect(result).toEqual({
        resolution: '480',
        videoCount: 10
      });
    });

    it('should return empty object when no override settings', () => {
      const jobData = { channelId: 'UC123' };
      const result = downloadModule.getOverrideSettings(jobData);
      expect(result).toEqual({});
    });

    it('should return empty object when override settings is not an object', () => {
      const jobData = { overrideSettings: 'invalid' };
      const result = downloadModule.getOverrideSettings(jobData);
      expect(result).toEqual({});
    });

    it('should handle null or undefined jobData', () => {
      expect(downloadModule.getOverrideSettings(null)).toEqual({});
      expect(downloadModule.getOverrideSettings(undefined)).toEqual({});
    });
  });

  describe('doChannelDownloads', () => {
    let channelDownloadGrouperMock;

    beforeEach(() => {
      channelDownloadGrouperMock = require('../channelDownloadGrouper');
    });

    it('should fall back to doSingleChannelDownloadJob when no groups returned', async () => {
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(null);
      const spy = jest.spyOn(downloadModule, 'doSingleChannelDownloadJob').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(channelDownloadGrouperMock.generateDownloadGroups).toHaveBeenCalledWith(null);
      expect(spy).toHaveBeenCalledWith({}, false);
    });

    it('should fall back to doSingleChannelDownloadJob when empty groups array', async () => {
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue([]);
      const spy = jest.spyOn(downloadModule, 'doSingleChannelDownloadJob').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(spy).toHaveBeenCalledWith({}, false);
    });

    it('should call doGroupedChannelDownloads when multiple groups exist', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: null, channels: [{ channel_id: 'UC2' }] }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doGroupedChannelDownloads').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(consoleLogSpy).toHaveBeenCalledWith('Using grouped downloads: 2 group(s) with resolved settings');
      expect(spy).toHaveBeenCalledWith({}, groups, false);
    });

    it('should call doGroupedChannelDownloads when single group has subfolder', async () => {
      const groups = [
        { quality: '1080', subFolder: 'custom', channels: [{ channel_id: 'UC1' }] }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doGroupedChannelDownloads').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(spy).toHaveBeenCalledWith({}, groups, false);
    });

    it('should call doGroupedChannelDownloads when group quality differs from global', async () => {
      const groups = [
        { quality: '720', subFolder: null, channels: [{ channel_id: 'UC1' }] }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doGroupedChannelDownloads').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(spy).toHaveBeenCalledWith({}, groups, false);
    });

    it('should call doGroupedChannelDownloads when group has download filters', async () => {
      const groups = [
        {
          quality: '1080',
          subFolder: null,
          filterConfig: {
            minDuration: 300,
            maxDuration: 3600,
            titleFilterRegex: null,
            hasFilters: jest.fn().mockReturnValue(true)
          },
          channels: [{ channel_id: 'UC1' }]
        }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doGroupedChannelDownloads').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(groups[0].filterConfig.hasFilters).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith({}, groups, false);
    });

    it('should call doSingleChannelDownloadJob with effectiveQuality for single uniform group', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doSingleChannelDownloadJob').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ effectiveQuality: '1080' }), false);
    });

    it('should pass override resolution to generateDownloadGroups', async () => {
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue([]);
      jest.spyOn(downloadModule, 'doSingleChannelDownloadJob').mockResolvedValue();

      const jobData = { overrideSettings: { resolution: '480' } };
      await downloadModule.doChannelDownloads(jobData);

      expect(channelDownloadGrouperMock.generateDownloadGroups).toHaveBeenCalledWith('480');
    });

    it('applies override settings stored in queued job data', async () => {
      const jobModuleMock = require('../jobModule');
      const channelModuleMock = require('../channelModule');
      const YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');

      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(null);
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      channelModuleMock.generateChannelsFile.mockResolvedValue('/tmp/channels.txt');
      YtdlpCommandBuilderMock.getBaseCommandArgs.mockReturnValue(['yt', 'args']);

      const queuedJob = {
        id: 'job-123',
        data: {
          overrideSettings: {
            resolution: '720',
            videoCount: 5,
            allowRedownload: true
          }
        }
      };

      await downloadModule.doChannelDownloads(queuedJob, true);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('720', true);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalled();
      const args = mockDownloadExecutor.doDownload.mock.calls[0][0];
      expect(args).toContain('--playlist-end');
      expect(args).toContain('5');
    });

    it('should fall back to doSingleChannelDownloadJob on error', async () => {
      const error = new Error('Grouper failed');
      channelDownloadGrouperMock.generateDownloadGroups.mockRejectedValue(error);
      const spy = jest.spyOn(downloadModule, 'doSingleChannelDownloadJob').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating channel download groups, falling back to single job:', error);
      expect(spy).toHaveBeenCalledWith({}, false);
    });
  });

  describe('doSingleChannelDownloadJob', () => {
    const mockJobId = 'job-123';
    const mockTempFile = '/tmp/channels-abc123.txt';
    let jobModuleMock;
    let channelModuleMock;
    let YtdlpCommandBuilderMock;

    beforeEach(() => {
      jobModuleMock = require('../jobModule');
      channelModuleMock = require('../channelModule');
      YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');
      jobModuleMock.addOrUpdateJob.mockResolvedValue(mockJobId);
      channelModuleMock.generateChannelsFile.mockResolvedValue(mockTempFile);
    });

    it('should successfully execute channel downloads with default settings', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });

      await downloadModule.doSingleChannelDownloadJob();

      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'Channel Downloads',
          status: '',
          output: '',
          id: '',
          data: {},
          action: expect.any(Function)
        }),
        false
      );
      expect(channelModuleMock.generateChannelsFile).toHaveBeenCalled();
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080', false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=1080]',
          '--output', '/mock/output/dir',
          '-a', mockTempFile,
          '--playlist-end', '3'
        ]),
        mockJobId,
        'Channel Downloads'
      );
      expect(mockDownloadExecutor.tempChannelsFile).toBe(mockTempFile);
    });

    it('should use effectiveQuality when provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = { effectiveQuality: '720' };

      await downloadModule.doSingleChannelDownloadJob(jobData);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('720', false);
    });

    it('should use override settings when provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        overrideSettings: {
          resolution: '720',
          videoCount: 10,
          allowRedownload: true
        }
      };

      await downloadModule.doSingleChannelDownloadJob(jobData);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('720', true);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--playlist-end', '10'
        ]),
        mockJobId,
        'Channel Downloads'
      );
    });

    it('should prioritize effectiveQuality over override resolution', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        effectiveQuality: '480',
        overrideSettings: {
          resolution: '720'
        }
      };

      await downloadModule.doSingleChannelDownloadJob(jobData);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('480', false);
    });

    it('should handle existing job id', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = { id: 'existing-job-456' };

      await downloadModule.doSingleChannelDownloadJob(jobData, true);

      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-job-456',
          data: jobData
        }),
        true
      );
    });

    it('should handle errors and clean up temp file', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const error = new Error('Channel generation failed');
      channelModuleMock.generateChannelsFile.mockRejectedValue(error);

      await downloadModule.doSingleChannelDownloadJob();

      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Error in channel downloads');
      expect(jobModuleMock.updateJob).toHaveBeenCalledWith(mockJobId, {
        status: 'Failed',
        output: 'Error: Channel generation failed'
      });
    });

    it('should not execute download if job is not in progress', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'Queued' });

      await downloadModule.doSingleChannelDownloadJob();

      expect(channelModuleMock.generateChannelsFile).not.toHaveBeenCalled();
      expect(mockDownloadExecutor.doDownload).not.toHaveBeenCalled();
    });
  });

  describe('doGroupedChannelDownloads', () => {
    let jobModuleMock;

    beforeEach(() => {
      jobModuleMock = require('../jobModule');
      jobModuleMock.addOrUpdateJob.mockResolvedValue('job-123');
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      jobModuleMock.startNextJob = jest.fn();
      jobModuleMock.updateJob = jest.fn();
    });

    it('should create single job for all groups', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: 'custom', channels: [{ channel_id: 'UC2' }] }
      ];

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(consoleLogSpy).toHaveBeenCalledWith('Processing 2 channel download groups in a single job');
      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledTimes(1);
      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'Channel Downloads - 2 group(s)',
          data: expect.objectContaining({
            groups,
            totalGroups: 2
          })
        }),
        false
      );
    });

    it('should process all groups sequentially', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: 'custom', channels: [{ channel_id: 'UC2' }] }
      ];
      const executeSpy = jest.spyOn(downloadModule, 'executeGroupDownload').mockResolvedValue();

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(executeSpy).toHaveBeenNthCalledWith(1,
        groups[0],
        'job-123',
        'Channel Downloads - Group 1/2 (1080p)',
        {},
        true
      );
      expect(executeSpy).toHaveBeenNthCalledWith(2,
        groups[1],
        'job-123',
        'Channel Downloads - Group 2/2 (720p, custom)',
        {},
        true
      );
    });

    it('should preserve jobData when executing groups', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] }
      ];
      const jobData = { overrideSettings: { videoCount: 5 } };
      const executeSpy = jest.spyOn(downloadModule, 'executeGroupDownload').mockResolvedValue();

      await downloadModule.doGroupedChannelDownloads(jobData, groups);

      expect(executeSpy).toHaveBeenCalledWith(
        groups[0],
        'job-123',
        'Channel Downloads - Group 1/1 (1080p)',
        jobData,
        true
      );
    });

    it('should stop processing groups on error', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: null, channels: [{ channel_id: 'UC2' }] },
        { quality: '480', subFolder: null, channels: [{ channel_id: 'UC3' }] }
      ];
      const error = new Error('Download failed');
      const executeSpy = jest.spyOn(downloadModule, 'executeGroupDownload')
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(error);

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(jobModuleMock.updateJob).toHaveBeenCalledWith('job-123', {
        status: 'Error',
        output: 'Error in Group 2/3 (720p): Download failed'
      });
    });

    it('should refresh Plex and start next job after all groups complete', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] }
      ];
      const plexModuleMock = require('../plexModule');
      plexModuleMock.refreshLibrary = jest.fn().mockReturnValue(Promise.resolve());

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(plexModuleMock.refreshLibrary).toHaveBeenCalled();
      expect(jobModuleMock.startNextJob).toHaveBeenCalled();
    });

    it('should stop processing groups if job is terminated', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: null, channels: [{ channel_id: 'UC2' }] },
        { quality: '480', subFolder: null, channels: [{ channel_id: 'UC3' }] }
      ];
      const plexModuleMock = require('../plexModule');
      plexModuleMock.refreshLibrary = jest.fn().mockReturnValue(Promise.resolve());

      // Mock executeGroupDownload to simulate the first group completing
      const executeSpy = jest.spyOn(downloadModule, 'executeGroupDownload').mockResolvedValue();

      // First call to getJob returns 'In Progress', second call returns 'Terminated'
      jobModuleMock.getJob
        .mockReturnValueOnce({ status: 'In Progress' }) // Initial check
        .mockReturnValueOnce({ status: 'In Progress' }) // First iteration check
        .mockReturnValueOnce({ status: 'Terminated' }); // Second iteration check (after group 1 completes)

      await downloadModule.doGroupedChannelDownloads({}, groups);

      // Should only execute first group, then stop when it detects termination
      expect(executeSpy).toHaveBeenCalledTimes(1);
      expect(plexModuleMock.refreshLibrary).not.toHaveBeenCalled();
      expect(jobModuleMock.startNextJob).not.toHaveBeenCalled();
    });
  });

  describe('executeGroupDownload', () => {
    const mockJobId = 'job-123';
    let YtdlpCommandBuilderMock;

    beforeEach(() => {
      YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');
    });

    it('should generate channels file from group channels', async () => {
      const group = {
        quality: '1080',
        subFolder: null,
        channels: [
          {
            channel_id: 'UC123',
            auto_download_enabled_tabs: 'video,short'
          },
          {
            channel_id: 'UC456',
            auto_download_enabled_tabs: 'livestream'
          }
        ]
      };

      await downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/1 (1080p)', {}, true);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/channels-group-'),
        'https://youtube.com/channel/UC123/videos\nhttps://youtube.com/channel/UC123/shorts\nhttps://youtube.com/channel/UC456/streams'
      );
    });

    it('should pass quality without subfolder to YtdlpCommandBuilder', async () => {
      const group = {
        quality: '480',
        subFolder: 'lowres',
        channels: [
          {
            channel_id: 'UC789',
            auto_download_enabled_tabs: 'video'
          }
        ]
      };
      const jobData = { overrideSettings: { videoCount: 5 } };

      await downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/1 (480p, lowres)', jobData, true);

      // Subfolder should NOT be passed to download - post-processing handles subfolder routing
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('480', false, null, undefined);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--playlist-end', '5'
        ]),
        mockJobId,
        'Channel Downloads - Group 1/1 (480p, lowres)',
        0,
        null,
        false,
        true
      );
    });

    it('should handle allowRedownload override', async () => {
      const group = {
        quality: '1080',
        subFolder: null,
        channels: [
          {
            channel_id: 'UC123',
            auto_download_enabled_tabs: 'video'
          }
        ]
      };
      const jobData = { overrideSettings: { allowRedownload: true } };

      await downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/1 (1080p)', jobData, true);

      // Subfolder should NOT be passed - post-processing handles it
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080', true, null, undefined);
    });

    it('should pass filterConfig to YtdlpCommandBuilder when group has filters', async () => {
      const mockFilterConfig = {
        minDuration: 300,
        maxDuration: 3600,
        titleFilterRegex: 'test.*',
        hasFilters: jest.fn().mockReturnValue(true)
      };
      const group = {
        quality: '1080',
        subFolder: null,
        filterConfig: mockFilterConfig,
        channels: [
          {
            channel_id: 'UC123',
            auto_download_enabled_tabs: 'video'
          }
        ]
      };

      await downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/1 (1080p)', {}, true);

      // Verify filterConfig is passed as the 4th parameter
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080', false, null, mockFilterConfig);
    });

    it('should pass skipJobTransition flag to doDownload', async () => {
      const group = {
        quality: '720',
        subFolder: null,
        channels: [{ channel_id: 'UC123', auto_download_enabled_tabs: 'video' }]
      };

      await downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/2 (720p)', {}, true);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Channel Downloads - Group 1/2 (720p)',
        0,
        null,
        false,
        true // skipJobTransition
      );
    });

    it('should clean up temp file and rethrow on error', async () => {
      const error = new Error('Write failed');
      fsPromises.writeFile.mockRejectedValue(error);

      const group = {
        quality: '1080',
        subFolder: null,
        channels: [{ channel_id: 'UC123', auto_download_enabled_tabs: 'video' }]
      };

      await expect(
        downloadModule.executeGroupDownload(group, mockJobId, 'Channel Downloads - Group 1/1 (1080p)', {}, true)
      ).rejects.toThrow('Write failed');

      expect(fsPromises.unlink).toHaveBeenCalled();
    });
  });

  describe('doSpecificDownloads', () => {
    const mockJobId = 'job-456';
    let jobModuleMock;
    let YtdlpCommandBuilderMock;

    beforeEach(() => {
      jobModuleMock = require('../jobModule');
      YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');
      jobModuleMock.addOrUpdateJob.mockResolvedValue(mockJobId);
    });

    it('should handle request object with body', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=abc123', 'https://youtube.com/watch?v=def456']
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(logger.info).toHaveBeenCalledWith(
        { jobData: request.body },
        'Running specific downloads job'
      );
      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'Manually Added Urls',
          status: '',
          output: '',
          id: '',
          data: request.body,
          action: expect.any(Function)
        }),
        false
      );
      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=1080]',
          '--output', '/mock/output/dir',
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=abc123',
          'https://youtube.com/watch?v=def456'
        ]),
        mockJobId,
        'Manually Added Urls',
        2,
        ['https://youtube.com/watch?v=abc123', 'https://youtube.com/watch?v=def456'],
        false
      );
    });

    it('should handle job data directly', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        data: {
          urls: ['https://youtube.com/watch?v=xyz789']
        }
      };

      await downloadModule.doSpecificDownloads(jobData);

      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          data: jobData
        }),
        false
      );
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=xyz789'
        ]),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=xyz789'],
        false
      );
    });

    it('should handle URLs starting with dash', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['-abc123', 'https://youtube.com/watch?v=def456']
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--download-archive', './config/complete.list',
          '--', '-abc123',
          'https://youtube.com/watch?v=def456'
        ]),
        mockJobId,
        'Manually Added Urls',
        2,
        ['-abc123', 'https://youtube.com/watch?v=def456'],
        false
      );
    });

    it('should use override settings when provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            resolution: '480'
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('480', false);
    });

    it('should respect channel-level quality override when present', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: '720' });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456'
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(ChannelModelMock.findOne).toHaveBeenCalledWith({
        where: { channel_id: 'UC123456' },
        attributes: ['video_quality']
      });
      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', false);
    });

    it('should handle allowRedownload override setting', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test1', 'https://youtube.com/watch?v=test2'],
          overrideSettings: {
            resolution: '720',
            allowRedownload: true
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', true);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=720]',
          '--output', '/mock/output/dir',
          'https://youtube.com/watch?v=test1',
          'https://youtube.com/watch?v=test2'
        ]),
        mockJobId,
        'Manually Added Urls',
        2,
        ['https://youtube.com/watch?v=test1', 'https://youtube.com/watch?v=test2'],
        true
      );
      // Verify that --download-archive is NOT in the arguments when allowRedownload is true
      expect(mockDownloadExecutor.doDownload).not.toHaveBeenCalledWith(
        expect.arrayContaining(['--download-archive']),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle only resolution override when allowRedownload is false', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            resolution: '480',
            allowRedownload: false
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('480', false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=480]',
          '--output', '/mock/output/dir',
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=test'
        ]),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false
      );
    });

    it('should default allowRedownload to false when not specified in overrideSettings', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=default'],
          overrideSettings: {
            // No allowRedownload specified, should default to false
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=default'
        ]),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=default'],
        false
      );
    });

    it('should handle existing job id', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        id: 'existing-job-789',
        data: {
          urls: ['https://youtube.com/watch?v=test']
        }
      };

      await downloadModule.doSpecificDownloads(jobData, true);

      expect(jobModuleMock.addOrUpdateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-job-789'
        }),
        true
      );
    });

    it('should not execute download if job is not in progress', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'Completed' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test']
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).not.toHaveBeenCalled();
    });

    it('should handle empty URL list', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: []
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=1080]',
          '--output', '/mock/output/dir',
          '--download-archive', './config/complete.list'
        ]),
        mockJobId,
        'Manually Added Urls',
        0,
        [],
        false
      );
    });
  });

  describe('event listener binding', () => {
    it('should properly bind handleConfigChange to this context', () => {
      // Clear module cache and re-require to capture the constructor behavior
      jest.resetModules();

      // Reset the configModule mock to capture the on call
      const configModuleMock = require('../configModule');
      configModuleMock.on.mockClear();

      // Re-require the downloadModule to trigger constructor
      const freshDownloadModule = require('../downloadModule');

      const newConfig = {
        preferredResolution: '4K',
        channelFilesToDownload: 10
      };

      // Verify that 'on' was called
      expect(configModuleMock.on).toHaveBeenCalledWith('change', expect.any(Function));

      // Get the bound function that was passed to configModule.on
      const boundHandler = configModuleMock.on.mock.calls[0][1];

      // Call it directly
      boundHandler(newConfig);

      // Verify it updated the module's config
      expect(freshDownloadModule.config).toEqual(newConfig);
    });
  });
});
