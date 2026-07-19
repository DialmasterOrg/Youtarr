/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('node-cron');
jest.mock('uuid');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../downloadModule', () => ({
  doChannelDownloads: jest.fn(),
  doChannelAndPlaylistDownloads: jest.fn()
}));
jest.mock('../../jobModule', () => ({
  getAllJobs: jest.fn().mockReturnValue({})
}));

describe('autoDownloadScheduler', () => {
  let autoDownloadScheduler;
  let fs;
  let fsPromises;
  let cron;
  let configModule;
  let downloadModule;
  let Channel;
  let uuid;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    uuid = require('uuid');
    uuid.v4.mockReturnValue('test-uuid-1234');

    fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.promises = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
      rename: jest.fn()
    };
    fsPromises = fs.promises;

    cron = require('node-cron');
    cron.schedule = jest.fn().mockReturnValue({
      stop: jest.fn()
    });

    configModule = require('../../configModule');
    downloadModule = require('../../downloadModule');

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    logger = require('../../../logger');

    autoDownloadScheduler = require('../autoDownloadScheduler');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleTask', () => {
    test('should schedule task when auto-download enabled', () => {
      configModule.getConfig.mockReturnValue({
        channelAutoDownload: true,
        channelDownloadFrequency: '0 */12 * * *'
      });

      autoDownloadScheduler.scheduleTask();

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

      autoDownloadScheduler.scheduleTask();

      expect(cron.schedule).not.toHaveBeenCalled();
    });

    test('should stop old task before scheduling new one', () => {
      const mockTask = { stop: jest.fn() };
      autoDownloadScheduler.task = mockTask;

      autoDownloadScheduler.scheduleTask();

      expect(mockTask.stop).toHaveBeenCalled();
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

      const tempPath = await autoDownloadScheduler.generateChannelsFile();

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

      await autoDownloadScheduler.generateChannelsFile();

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

      await autoDownloadScheduler.generateChannelsFile();

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

      await expect(autoDownloadScheduler.generateChannelsFile()).rejects.toThrow('No valid channel URLs to download');

      expect(logger.warn).toHaveBeenCalledWith('No URLs generated for channel downloads - all enabled channels have disabled tabs');
    });

    test('should handle error and cleanup temp file', async () => {
      Channel.findAll = jest.fn().mockRejectedValue(new Error('DB Error'));
      fsPromises.unlink.mockResolvedValue();

      await expect(autoDownloadScheduler.generateChannelsFile()).rejects.toThrow('DB Error');
    });
  });

  describe('getEnabledChannelDownloadUrls', () => {
    it('returns one URL per enabled tab, mapping tab names to URL suffixes', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'UC1', url: 'https://www.youtube.com/@one', auto_download_enabled_tabs: 'video,short' },
      ]);

      const urls = await autoDownloadScheduler.getEnabledChannelDownloadUrls();

      expect(urls).toEqual([
        expect.stringMatching(/UC1\/videos$/),
        expect.stringMatching(/UC1\/shorts$/),
      ]);
    });

    it('returns an empty array when every enabled channel has no enabled tabs', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'UC1', url: 'https://www.youtube.com/@one', auto_download_enabled_tabs: '' },
      ]);

      await expect(autoDownloadScheduler.getEnabledChannelDownloadUrls()).resolves.toEqual([]);
    });

    it('returns an empty array when there are no enabled channels at all', async () => {
      Channel.findAll.mockResolvedValue([]);

      await expect(autoDownloadScheduler.getEnabledChannelDownloadUrls()).resolves.toEqual([]);
    });

    it('falls back to the stored url for channels without a channel_id', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: null, url: 'https://www.youtube.com/@legacy', auto_download_enabled_tabs: 'video' },
      ]);

      await expect(autoDownloadScheduler.getEnabledChannelDownloadUrls()).resolves.toEqual([
        'https://www.youtube.com/@legacy',
      ]);
    });
  });

  describe('channelAutoDownload', () => {
    let jobModule;

    beforeEach(() => {
      jobModule = require('../../jobModule');
      jobModule.getAllJobs.mockReturnValue({});
      downloadModule.doChannelAndPlaylistDownloads.mockClear();
      downloadModule.doChannelAndPlaylistDownloads.mockResolvedValue(undefined);
    });

    test('runs channel + playlist downloads via the combined orchestration when none is running', async () => {
      jobModule.getAllJobs.mockReturnValue({});

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          currentTime: expect.any(Date),
          interval: expect.any(String)
        }),
        'Running scheduled channel downloads'
      );
    });

    test('skips when a channel download is already running (In Progress)', async () => {
      jobModule.getAllJobs.mockReturnValue({
        'job-123': { jobType: 'Channel Downloads', status: 'In Progress' }
      });

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Skipping scheduled channel download - previous download still in progress');
    });

    test('skips when a channel download is already running (Pending)', async () => {
      jobModule.getAllJobs.mockReturnValue({
        'job-456': { jobType: 'Channel Downloads', status: 'Pending' }
      });

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Skipping scheduled channel download - previous download still in progress');
    });

    test('triggers orchestration when other job types are running', async () => {
      jobModule.getAllJobs.mockReturnValue({
        'job-789': { jobType: 'Manually Added Urls', status: 'In Progress' }
      });

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledTimes(1);
    });

    test('logs error when orchestration throws', async () => {
      jobModule.getAllJobs.mockReturnValue({});
      const err = new Error('orchestration failed');
      downloadModule.doChannelAndPlaylistDownloads.mockRejectedValueOnce(err);

      await autoDownloadScheduler.channelAutoDownload();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err }),
        'Scheduled channel + playlist downloads failed'
      );
    });
  });
});
