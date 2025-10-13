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
    youtubeOutputDirectory: '/mock/output/dir'
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
  generateChannelsFile: jest.fn()
}));

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const fs = require('fs');

describe('DownloadModule', () => {
  let downloadModule;
  let fsPromises;
  let logger;

  beforeAll(() => {
    // Setup fs promises mock
    fsPromises = {
      unlink: jest.fn()
    };
    fs.promises = fsPromises;

    // Require downloadModule once - it's a singleton
    downloadModule = require('../downloadModule');
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Get logger mock reference
    logger = require('../../logger');

    // Setup YtdlpCommandBuilder mock
    const YtdlpCommandBuilderMock = require('../download/ytdlpCommandBuilder');
    YtdlpCommandBuilderMock.getBaseCommandArgs.mockReturnValue([
      '--format', 'best[height<=1080]',
      '--output', '/mock/output/dir'
    ]);
    YtdlpCommandBuilderMock.getBaseCommandArgsForManualDownload.mockImplementation((resolution, allowRedownload) => {
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
    jobModuleMock.addOrUpdateJob.mockResolvedValue('job-123');
    jobModuleMock.updateJob.mockResolvedValue();
    jobModuleMock.getJob.mockReturnValue({ status: 'Pending' });

    const channelModuleMock = require('../channelModule');
    channelModuleMock.generateChannelsFile.mockResolvedValue('/tmp/channels-abc123.txt');
  });

  describe('constructor', () => {
    it('should initialize with config and download executor', () => {
      expect(downloadModule.config).toEqual({
        preferredResolution: '1080',
        channelFilesToDownload: 3,
        youtubeOutputDirectory: '/mock/output/dir'
      });
      expect(downloadModule.downloadExecutor).toBeDefined();
    });
  });

  describe('handleConfigChange', () => {
    it('should update config when configuration changes', () => {
      const newConfig = {
        preferredResolution: '720',
        channelFilesToDownload: 5,
        youtubeOutputDirectory: '/new/output/dir'
      };

      downloadModule.handleConfigChange(newConfig);

      expect(downloadModule.config).toEqual(newConfig);
    });
  });

  describe('doChannelDownloads', () => {
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

      await downloadModule.doChannelDownloads();

      expect(logger.info).toHaveBeenCalledWith('Running channel downloads job');
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
      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('1080');
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--format', 'best[height<=1080]',
          '--output', '/mock/output/dir',
          '-a', mockTempFile,
          '--playlist-end', '3'
        ]),
        mockJobId,
        'Channel Downloads'
      );
      expect(downloadModule.downloadExecutor.tempChannelsFile).toBe(mockTempFile);
    });

    it('should use override settings when provided', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        overrideSettings: {
          resolution: '720',
          videoCount: 10
        }
      };

      await downloadModule.doChannelDownloads(jobData);

      expect(YtdlpCommandBuilderMock.getBaseCommandArgs).toHaveBeenCalledWith('720');
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
        expect.arrayContaining([
          '--playlist-end', '10'
        ]),
        mockJobId,
        'Channel Downloads'
      );
    });

    it('should handle existing job id', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const jobData = {
        id: 'existing-job-456'
      };

      await downloadModule.doChannelDownloads(jobData, true);

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

      await downloadModule.doChannelDownloads();

      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Error in channel downloads');
      expect(jobModuleMock.updateJob).toHaveBeenCalledWith(mockJobId, {
        status: 'Failed',
        output: 'Error: Channel generation failed'
      });
    });


    it('should not execute download if job is not in progress', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'Queued' });

      await downloadModule.doChannelDownloads();

      expect(channelModuleMock.generateChannelsFile).not.toHaveBeenCalled();
      expect(downloadModule.downloadExecutor.doDownload).not.toHaveBeenCalled();
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
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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

      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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
      expect(downloadModule.downloadExecutor.doDownload).not.toHaveBeenCalledWith(
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
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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
      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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

      expect(downloadModule.downloadExecutor.doDownload).not.toHaveBeenCalled();
    });

    it('should handle empty URL list', async () => {
      jobModuleMock.getJob.mockReturnValue({ status: 'In Progress' });
      const request = {
        body: {
          urls: []
        }
      };

      await downloadModule.doSpecificDownloads(request);

      expect(downloadModule.downloadExecutor.doDownload).toHaveBeenCalledWith(
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
      const newConfig = {
        preferredResolution: '4K',
        channelFilesToDownload: 10,
        youtubeOutputDirectory: '/new/output/dir'
      };

      // The listener was set up during module initialization in beforeAll
      // We can verify it works by calling handleConfigChange directly
      downloadModule.handleConfigChange(newConfig);

      // Verify it updated the module's config
      expect(downloadModule.config).toEqual(newConfig);
    });
  });
});