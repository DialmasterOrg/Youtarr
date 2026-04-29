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
  mockConfigModule.getDefaultSubfolder = jest.fn().mockReturnValue(null);
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

      expect(logger.info).toHaveBeenCalledWith({ groupCount: 2 }, 'Using grouped downloads with resolved settings');
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
            hasGroupingCriteria: jest.fn().mockReturnValue(true)
          },
          channels: [{ channel_id: 'UC1' }]
        }
      ];
      channelDownloadGrouperMock.generateDownloadGroups.mockResolvedValue(groups);
      const spy = jest.spyOn(downloadModule, 'doGroupedChannelDownloads').mockResolvedValue();

      await downloadModule.doChannelDownloads();

      expect(groups[0].filterConfig.hasGroupingCriteria).toHaveBeenCalled();
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
      const doDownloadCall = mockDownloadExecutor.doDownload.mock.calls[0];
      const args = doDownloadCall[0];
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

      expect(logger.info).toHaveBeenCalledWith({ groupCount: 2 }, 'Processing channel download groups in a single job');
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

    it('should refresh Plex libraries for each group subfolder after all groups complete', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] }
      ];
      const plexModuleMock = require('../plexModule');
      plexModuleMock.refreshLibrariesForSubfolders = jest.fn().mockReturnValue(Promise.resolve());

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(plexModuleMock.refreshLibrariesForSubfolders).toHaveBeenCalledWith([null]);
      expect(jobModuleMock.startNextJob).toHaveBeenCalled();
    });

    it('should pass all group subfolders to refreshLibrariesForSubfolders', async () => {
      const groups = [
        { quality: '1080', subFolder: 'kids', channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: 'music', channels: [{ channel_id: 'UC2' }] },
      ];
      const plexModuleMock = require('../plexModule');
      plexModuleMock.refreshLibrariesForSubfolders = jest.fn().mockReturnValue(Promise.resolve());

      await downloadModule.doGroupedChannelDownloads({}, groups);

      expect(plexModuleMock.refreshLibrariesForSubfolders).toHaveBeenCalledWith(['kids', 'music']);
    });

    it('should stop processing groups if job is terminated', async () => {
      const groups = [
        { quality: '1080', subFolder: null, channels: [{ channel_id: 'UC1' }] },
        { quality: '720', subFolder: null, channels: [{ channel_id: 'UC2' }] },
        { quality: '480', subFolder: null, channels: [{ channel_id: 'UC3' }] }
      ];
      const plexModuleMock = require('../plexModule');
      plexModuleMock.refreshLibrariesForSubfolders = jest.fn().mockReturnValue(Promise.resolve());

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
      expect(plexModuleMock.refreshLibrariesForSubfolders).not.toHaveBeenCalled();
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
        expect.stringMatching(/channels-group-/),
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
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('480', false, null, undefined, null, false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--playlist-end', '5'
        ]),
        mockJobId,
        'Channel Downloads - Group 1/1 (480p, lowres)',
        0,
        null,
        false,
        true,
        null,
        undefined,
        false
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
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080', true, null, undefined, null, false);
    });

    it('should pass filterConfig to YtdlpCommandBuilder when group has filters', async () => {
      const mockFilterConfig = {
        minDuration: 300,
        maxDuration: 3600,
        titleFilterRegex: 'test.*',
        hasGroupingCriteria: jest.fn().mockReturnValue(true)
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

      // Verify filterConfig is passed as the 4th parameter, audioFormat is null when not in filterConfig
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080', false, null, mockFilterConfig, null, false);
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
        true, // skipJobTransition
        null,
        undefined,
        false // skipVideoFolder
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
      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false, null, false);
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
        false,
        false,
        null,
        undefined,
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
        false,
        false,
        null,
        undefined,
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
        false,
        false,
        null,
        undefined,
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

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('480', false, null, false);
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
        attributes: ['video_quality', 'audio_format', 'skip_video_folder']
      });
      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', false, null, false);
    });

    it('should respect channel-level audio_format when no override provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: '720', audio_format: 'mp3_only' });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456'
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', false, 'mp3_only', false);
    });

    it('should prioritize override audioFormat over channel audio_format', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: '720', audio_format: 'mp3_only' });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456',
          overrideSettings: {
            audioFormat: 'video_mp3'
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', false, 'video_mp3', false);
    });

    it('should allow null audioFormat override to bypass channel mp3_only setting', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: '720', audio_format: 'mp3_only' });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456',
          overrideSettings: {
            audioFormat: null  // Explicitly override to "Video Only"
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', false, null, false);
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

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('720', true, null, false);
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
        true,
        false,
        null,
        undefined,
        false
      );
      // Verify that --download-archive is NOT in the arguments when allowRedownload is true
      const callArgs = mockDownloadExecutor.doDownload.mock.calls[0][0];
      expect(callArgs).not.toContain('--download-archive');
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

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('480', false, null, false);
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
        false,
        false,
        null,
        undefined,
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

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false, null, false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=default'
        ]),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=default'],
        false,
        false,
        null,
        undefined,
        false
      );
    });

    it('should pass subfolder override to doDownload when specified', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            subfolder: 'Movies'
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--download-archive', './config/complete.list',
          'https://youtube.com/watch?v=test'
        ]),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        'Movies',
        undefined,
        false
      );
    });

    it('should pass null subfolder when subfolder is undefined in overrideSettings', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            resolution: '720'
            // subfolder not specified
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        null,
        undefined,
        false
      );
    });

    it('should handle empty string subfolder as empty string', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            subfolder: ''
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        '',
        undefined,
        false
      );
    });

    it('should apply skipVideoFolder from override settings', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          overrideSettings: {
            skipVideoFolder: true
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false, null, true);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        null,
        undefined,
        true
      );
    });

    it('should use channel skip_video_folder when no override provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: null, audio_format: null, skip_video_folder: true });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456'
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false, null, true);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        null,
        undefined,
        true
      );
    });

    it('should prioritize override skipVideoFolder over channel setting', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      ChannelModelMock.findOne.mockResolvedValue({ video_quality: null, audio_format: null, skip_video_folder: true });

      const request = {
        body: {
          urls: ['https://youtube.com/watch?v=test'],
          channelId: 'UC123456',
          overrideSettings: {
            skipVideoFolder: false
          }
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload).toHaveBeenCalledWith('1080', false, null, false);
      expect(mockDownloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobId,
        'Manually Added Urls',
        1,
        ['https://youtube.com/watch?v=test'],
        false,
        false,
        null,
        undefined,
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
        false,
        false,
        null,
        undefined,
        false
      );
    });
  });

  describe('doPlaylistDownloads', () => {
    let PlaylistVideoMock;
    let VideoMock;
    let ChannelMock;
    let playlistModuleMock;

    const mockPlaylist = {
      playlist_id: 'PLtest123',
      title: 'Test Playlist',
      video_quality: null,
      audio_format: null,
      default_sub_folder: null,
    };

    beforeEach(() => {
      jest.doMock('../../models/playlistvideo', () => ({
        findAll: jest.fn(),
      }));
      jest.doMock('../../models/video', () => ({
        findOne: jest.fn(),
      }));
      jest.doMock('../../models/channel', () => ({
        findOne: jest.fn(),
      }));
      jest.doMock('../playlistModule', () => ({
        ensureSourceChannel: jest.fn().mockResolvedValue({}),
      }));

      PlaylistVideoMock = require('../../models/playlistvideo');
      VideoMock = require('../../models/video');
      ChannelMock = require('../../models/channel');
      playlistModuleMock = require('../playlistModule');
    });

    it('returns without calling download machinery when no playlist videos exist', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([]);
      const spy = jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(spy).not.toHaveBeenCalled();
    });

    it('returns without calling download machinery when all videos are already downloaded', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { youtube_id: 'vid001', channel_id: 'UC1' },
        { youtube_id: 'vid002', channel_id: 'UC1' },
      ]);
      VideoMock.findOne.mockResolvedValue({ youtubeId: 'vid001' });
      const spy = jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(spy).not.toHaveBeenCalled();
    });

    it('calls ensureSourceChannel for videos whose source channel is missing', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { youtube_id: 'vid001', channel_id: 'UCmissing' },
        { youtube_id: 'vid002', channel_id: 'UCpresent' },
      ]);
      // vid001 not downloaded, vid002 not downloaded
      VideoMock.findOne.mockResolvedValue(null);
      // UCmissing not in DB, UCpresent is in DB
      ChannelMock.findOne
        .mockResolvedValueOnce(null)   // UCmissing -> missing
        .mockResolvedValueOnce({ channel_id: 'UCpresent' }); // UCpresent -> exists
      jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(playlistModuleMock.ensureSourceChannel).toHaveBeenCalledTimes(1);
      expect(playlistModuleMock.ensureSourceChannel).toHaveBeenCalledWith(
        { channel_id: 'UCmissing' },
        mockPlaylist
      );
    });

    it('does not call ensureSourceChannel when all source channels exist', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { youtube_id: 'vid001', channel_id: 'UCknown' },
      ]);
      VideoMock.findOne.mockResolvedValue(null);
      ChannelMock.findOne.mockResolvedValue({ channel_id: 'UCknown' });
      jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(playlistModuleMock.ensureSourceChannel).not.toHaveBeenCalled();
    });

    it('invokes download machinery with the correct youtube_ids', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { youtube_id: 'vid001', channel_id: 'UC1' },
        { youtube_id: 'vid002', channel_id: 'UC1' },
        { youtube_id: 'vid003', channel_id: 'UC1' },
      ]);
      // vid002 already downloaded, vid001 and vid003 are not
      VideoMock.findOne
        .mockResolvedValueOnce(null)                       // vid001 not downloaded
        .mockResolvedValueOnce({ youtubeId: 'vid002' })   // vid002 already downloaded
        .mockResolvedValueOnce(null);                       // vid003 not downloaded
      ChannelMock.findOne.mockResolvedValue({ channel_id: 'UC1' });
      const spy = jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(spy).toHaveBeenCalledTimes(1);
      const callArg = spy.mock.calls[0][0];
      // doSpecificDownloads expects the Express-request shape (`body.urls`) —
      // passing a bare `{ urls }` crashes at runtime when it tries to read `.body.urls`.
      expect(callArg.body.urls).toEqual([
        'https://www.youtube.com/watch?v=vid001',
        'https://www.youtube.com/watch?v=vid003',
      ]);
    });

    it('filters out already-downloaded videos before invoking download machinery', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { youtube_id: 'alreadyDone', channel_id: 'UC1' },
      ]);
      VideoMock.findOne.mockResolvedValue({ youtubeId: 'alreadyDone' });
      const spy = jest.spyOn(downloadModule, 'doSpecificDownloads').mockResolvedValue();

      await downloadModule.doPlaylistDownloads(mockPlaylist);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('afterDownloadHook', () => {
    let PlaylistVideoMock;
    let PlaylistMock;
    let m3uGeneratorMock;
    let mediaServerSyncMock;

    beforeEach(() => {
      jest.doMock('../../models/playlistvideo', () => ({
        findAll: jest.fn(),
      }));
      jest.doMock('../../models/playlist', () => ({
        findAll: jest.fn(),
      }));
      jest.doMock('../m3uGenerator', () => ({
        generatePlaylistM3U: jest.fn().mockResolvedValue(true),
      }));
      jest.doMock('../mediaServers', () => ({
        mediaServerSync: {
          syncPlaylist: jest.fn().mockResolvedValue(),
        },
      }));

      PlaylistVideoMock = require('../../models/playlistvideo');
      PlaylistMock = require('../../models/playlist');
      m3uGeneratorMock = require('../m3uGenerator');
      const mediaServers = require('../mediaServers');
      mediaServerSyncMock = mediaServers.mediaServerSync;
    });

    it('is a no-op when given an empty list', async () => {
      await downloadModule.afterDownloadHook([]);

      expect(PlaylistVideoMock.findAll).not.toHaveBeenCalled();
    });

    it('is a no-op when given null or undefined', async () => {
      await downloadModule.afterDownloadHook(null);
      await downloadModule.afterDownloadHook(undefined);

      expect(PlaylistVideoMock.findAll).not.toHaveBeenCalled();
    });

    it('is a no-op when no playlists contain the downloaded videos', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([]);

      await downloadModule.afterDownloadHook(['vid001', 'vid002']);

      expect(PlaylistMock.findAll).not.toHaveBeenCalled();
      expect(m3uGeneratorMock.generatePlaylistM3U).not.toHaveBeenCalled();
    });

    it('calls syncPlaylist and generatePlaylistM3U exactly once per affected enabled playlist', async () => {
      // 3 youtube_ids: vid001 and vid002 belong to playlist A, vid003 to playlist B
      PlaylistVideoMock.findAll.mockResolvedValue([
        { playlist_id: 'PLA' },
        { playlist_id: 'PLA' },
        { playlist_id: 'PLB' },
      ]);
      PlaylistMock.findAll.mockResolvedValue([
        { id: 10, playlist_id: 'PLA' },
        { id: 20, playlist_id: 'PLB' },
      ]);

      await downloadModule.afterDownloadHook(['vid001', 'vid002', 'vid003']);

      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledTimes(2);
      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledWith(10);
      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledWith(20);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledTimes(2);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledWith(10);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledWith(20);
    });

    it('deduplicates playlist_ids before querying playlists', async () => {
      // Two rows for the same playlist
      PlaylistVideoMock.findAll.mockResolvedValue([
        { playlist_id: 'PLA' },
        { playlist_id: 'PLA' },
      ]);
      PlaylistMock.findAll.mockResolvedValue([
        { id: 10, playlist_id: 'PLA' },
      ]);

      await downloadModule.afterDownloadHook(['vid001', 'vid002']);

      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledTimes(1);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledTimes(1);
    });

    it('passes enabled:true filter so disabled playlists are excluded', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { playlist_id: 'PLA' },
        { playlist_id: 'PLB' },
      ]);
      // Only playlist A is returned (B is disabled, filtered by the query)
      PlaylistMock.findAll.mockResolvedValue([
        { id: 10, playlist_id: 'PLA' },
      ]);

      await downloadModule.afterDownloadHook(['vid001', 'vid002']);

      expect(PlaylistMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ enabled: true }),
        })
      );
      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledTimes(1);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledTimes(1);
    });

    it('continues processing other playlists when one sync fails', async () => {
      PlaylistVideoMock.findAll.mockResolvedValue([
        { playlist_id: 'PLA' },
        { playlist_id: 'PLB' },
      ]);
      PlaylistMock.findAll.mockResolvedValue([
        { id: 10, playlist_id: 'PLA' },
        { id: 20, playlist_id: 'PLB' },
      ]);
      m3uGeneratorMock.generatePlaylistM3U
        .mockRejectedValueOnce(new Error('M3U generation failed'))
        .mockResolvedValueOnce(true);

      await expect(downloadModule.afterDownloadHook(['vid001', 'vid002'])).resolves.toBeUndefined();

      expect(m3uGeneratorMock.generatePlaylistM3U).toHaveBeenCalledTimes(2);
      expect(mediaServerSyncMock.syncPlaylist).toHaveBeenCalledTimes(1);
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
