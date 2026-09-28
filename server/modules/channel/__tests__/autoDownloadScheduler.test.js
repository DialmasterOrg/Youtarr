/* eslint-env jest */

const mockFactories = require('./mockFactories');

jest.mock('fs');
jest.mock('node-cron');
jest.mock('uuid');
jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../../downloadModule', () => ({
  doChannelDownloads: jest.fn(),
  doChannelAndPlaylistDownloads: jest.fn(),
  getJobDataValue: jest.fn((jobData, key) => jobData[key])
}));
jest.mock('../../jobModule', () => ({
  getAllJobs: jest.fn().mockReturnValue({})
}));
jest.mock('../../storageGuard', () => ({
  refresh: jest.fn().mockResolvedValue({ paused: false, reasons: [] }),
  getStatus: jest.fn(() => ({ paused: false, reasons: [] })),
  describe: jest.fn(() => 'Downloads are paused: downloaded videos use 12.0 GB, over the 10 GB limit')
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
  let scheduledTaskManager;

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
    cron.validate.mockReturnValue(true);
    cron.getTasks.mockReturnValue(new Map());
    cron.schedule = jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn()
    }));

    configModule = require('../../configModule');
    downloadModule = require('../../downloadModule');

    Channel = require('../../../models/channel');
    Channel.findOne.mockResolvedValue(null);

    logger = require('../../../logger');

    autoDownloadScheduler = require('../autoDownloadScheduler');
    scheduledTaskManager = require('../../scheduledTaskManager');
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
        expect.any(Function),
        expect.objectContaining({ scheduled: false })
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

    test('stops the old task when the frequency changes', () => {
      autoDownloadScheduler.scheduleTask();
      const oldTask = cron.schedule.mock.results[0].value;
      configModule.getConfig.mockReturnValue({ channelAutoDownload: true, channelDownloadFrequency: '0 18 * * *' });
      autoDownloadScheduler.scheduleTask();
      expect(oldTask.stop).toHaveBeenCalledTimes(1);
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
          trigger: 'scheduled',
          currentTime: expect.any(Date),
          interval: expect.any(String)
        }),
        'Running channel downloads'
      );
    });

    test('passes a manual run\'s job data to the sweep', async () => {
      const jobData = { overrideSettings: { videoCount: 5 } };

      await autoDownloadScheduler.channelAutoDownload({ trigger: 'manual', jobData });

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledWith(jobData);
    });

    test('passes empty job data to the sweep when called without arguments', async () => {
      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledWith({});
    });

    test('skips with the pause reason when storage limits pause downloads', async () => {
      const storageGuard = require('../../storageGuard');
      storageGuard.refresh.mockResolvedValueOnce({ paused: true, reasons: [{ text: 'over the limit' }] });

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual({
        status: 'skipped',
        outcome: 'skipped',
        message: 'Downloads are paused: downloaded videos use 12.0 GB, over the 10 GB limit'
      });
    });

    test('does not start a sweep while downloads are paused', async () => {
      const storageGuard = require('../../storageGuard');
      storageGuard.refresh.mockResolvedValueOnce({ paused: true, reasons: [] });

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).not.toHaveBeenCalled();
    });

    test('records playlists skipped by a storage pause as a success with the reason', async () => {
      downloadModule.doChannelAndPlaylistDownloads.mockResolvedValue({
        playlistError: null, playlistsFailed: 0, playlistsChecked: 2,
        playlistsPausedReason: 'Downloads are paused: over the limit',
      });

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual({
        status: 'success',
        outcome: 'completed',
        message: 'Channel downloads were queued; playlist downloads were skipped. Downloads are paused: over the limit',
      });
    });

    test('resolves to a success record after starting the sweep', async () => {
      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual(expect.objectContaining({
        status: 'success', outcome: 'completed', message: 'Checked enabled channels and playlists for new videos.'
      }));
    });

    test('resolves to a skipped record when a channel download is still running', async () => {
      jobModule.getAllJobs.mockReturnValue({
        'job-123': { jobType: 'Channel Downloads', status: 'In Progress' }
      });

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual(expect.objectContaining({
        status: 'skipped', message: 'The previous channel and playlist update is still running.'
      }));
    });

    test('reports individual playlist failures as a partial failure', async () => {
      downloadModule.doChannelAndPlaylistDownloads.mockResolvedValue({
        playlistError: null, playlistsFailed: 1, playlistsChecked: 3,
      });

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Channel downloads were queued, but 1 of 3 playlists failed to sweep.'
      }));
    });

    test('reports a failed playlist sweep as a partial failure', async () => {
      downloadModule.doChannelAndPlaylistDownloads.mockResolvedValue({ playlistError: 'Playlist API down' });

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Channel downloads were queued, but the playlist sweep failed: Playlist API down'
      }));
    });

    test('resolves to an error record when the sweep fails', async () => {
      downloadModule.doChannelAndPlaylistDownloads.mockRejectedValue(new Error('yt-dlp missing'));

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual(expect.objectContaining({
        status: 'error', outcome: 'error', message: 'yt-dlp missing'
      }));
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
        'Channel + playlist downloads failed'
      );
    });
  });

  describe('download sweep tracking', () => {
    let jobModule;
    let storageGuard;
    let runTracker;

    const startSweep = () => {
      downloadModule.doChannelAndPlaylistDownloads.mockImplementationOnce(async (jobData) => {
        jobData.runId = 'run-1';
      });
      return autoDownloadScheduler.channelAutoDownload();
    };

    beforeEach(() => {
      jobModule = require('../../jobModule');
      storageGuard = require('../../storageGuard');
      runTracker = {
        isActive: jest.fn().mockReturnValue(true),
        getUnfinishedJobs: jest.fn().mockReturnValue([]),
        onRunFinished: jest.fn(() => () => {}),
        // Finished unless a test says otherwise, so each sweep's wait ends at once.
        getFinishedRun: jest.fn().mockReturnValue({ finishedAt: new Date(), totals: null }),
        getTotals: jest.fn().mockReturnValue(null),
        getUnreportedJobs: jest.fn().mockReturnValue([]),
      };
      autoDownloadScheduler.setRunTracker(runTracker);
    });

    test('does not report running from the tracker before any sweep has started', () => {
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });

    test('reports running while a playlist job is queued after the channel job finished', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports running for a playlist-only sweep with no channel job', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'In Progress' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports running while an automatic retry is queued after the original jobs finished', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'retry-1', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('tracks a sweep that throws after its run started', async () => {
      downloadModule.doChannelAndPlaylistDownloads.mockImplementationOnce(async (jobData) => {
        jobData.runId = 'run-1';
        throw new Error('playlist module failed to load');
      });
      await autoDownloadScheduler.channelAutoDownload();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports not running once the sweep\'s run is no longer active', async () => {
      await startSweep();
      runTracker.isActive.mockReturnValue(false);
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });

    test('stops checking a run once it has finished', async () => {
      await startSweep();
      // The sweep's end-of-run wait checks the run too; only count the status checks.
      runTracker.getUnfinishedJobs.mockClear();
      runTracker.isActive.mockReturnValueOnce(false);
      autoDownloadScheduler.isChannelDownloadRunning();
      autoDownloadScheduler.isChannelDownloadRunning();

      expect(runTracker.getUnfinishedJobs).not.toHaveBeenCalled();
    });

    test('reports jobs held Pending by a storage pause as not running', async () => {
      await startSweep();
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }, { id: 'p2', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });

    test('reports running during a storage pause while a job is In Progress', async () => {
      await startSweep();
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'In Progress' }, { id: 'p2', status: 'Pending' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports a tracked job stuck in Failed as not running', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'c1', status: 'Failed' }]);

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });

    test('does not count a tracked job stuck in Failed as an active sweep', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'c1', status: 'Failed' }]);

      expect(autoDownloadScheduler.hasActiveSweep()).toBe(false);
    });

    test('does not skip a scheduled run for a tracked job stuck in Failed', async () => {
      await startSweep();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'c1', status: 'Failed' }]);

      await autoDownloadScheduler.channelAutoDownload();

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledTimes(2);
    });

    test('skips a scheduled run while a tracked sweep has an unfinished playlist job', async () => {
      await startSweep();
      jobModule.getAllJobs.mockReturnValue({});
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      await expect(autoDownloadScheduler.channelAutoDownload()).resolves.toEqual({
        status: 'skipped',
        outcome: 'skipped',
        message: 'The previous channel and playlist update is still running.'
      });
    });
  });

  describe('running check without a run tracker', () => {
    let jobModule;
    let storageGuard;

    beforeEach(() => {
      jobModule = require('../../jobModule');
      storageGuard = require('../../storageGuard');
    });

    test('reports a Channel Downloads job In Progress as running', () => {
      jobModule.getAllJobs.mockReturnValue({ 'job-1': { jobType: 'Channel Downloads', status: 'In Progress' } });

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports a Pending Channel Downloads job as running while downloads are not paused', () => {
      jobModule.getAllJobs.mockReturnValue({ 'job-1': { jobType: 'Channel Downloads', status: 'Pending' } });

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(true);
    });

    test('reports a Pending Channel Downloads job as not running while downloads are paused', () => {
      jobModule.getAllJobs.mockReturnValue({ 'job-1': { jobType: 'Channel Downloads', status: 'Pending' } });
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });

    test('reports not running when no channel job is active', () => {
      jobModule.getAllJobs.mockReturnValue({ 'job-1': { jobType: 'Channel Downloads', status: 'Complete' } });

      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });
  });

  describe('getRunBlocker', () => {
    let storageGuard;

    beforeEach(() => {
      storageGuard = require('../../storageGuard');
    });

    test('uses the cached pause state for a status check', async () => {
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });

      await expect(autoDownloadScheduler.getRunBlocker()).resolves.toEqual({
        reason: 'downloads-paused',
        message: 'Downloads are paused: downloaded videos use 12.0 GB, over the 10 GB limit'
      });
    });

    test('does not re-measure storage for a status check', async () => {
      await autoDownloadScheduler.getRunBlocker();

      expect(storageGuard.refresh).not.toHaveBeenCalled();
    });

    test('re-measures storage before starting a run', async () => {
      storageGuard.refresh.mockResolvedValueOnce({ paused: true, reasons: [] });

      await expect(autoDownloadScheduler.getRunBlocker({ fresh: true })).resolves.toEqual(
        expect.objectContaining({ reason: 'downloads-paused' })
      );
    });

    test('resolves null when downloads are not paused', async () => {
      await expect(autoDownloadScheduler.getRunBlocker({ fresh: true })).resolves.toBeNull();
    });

    test('fails open when the pause state cannot be measured', async () => {
      storageGuard.refresh.mockRejectedValueOnce(new Error('df failed'));

      await expect(autoDownloadScheduler.getRunBlocker({ fresh: true })).resolves.toBeNull();
    });
  });

  describe('sweep run record', () => {
    let storageGuard;
    let runTracker;

    const startSweep = (queueResult = undefined) => {
      downloadModule.doChannelAndPlaylistDownloads.mockImplementationOnce(async (jobData) => {
        jobData.runId = 'run-1';
        return queueResult;
      });
      return autoDownloadScheduler.channelAutoDownload();
    };

    beforeEach(() => {
      storageGuard = require('../../storageGuard');
      storageGuard.getStatus.mockReturnValue({ paused: false, reasons: [] });
      runTracker = {
        isActive: jest.fn().mockReturnValue(true),
        getUnfinishedJobs: jest.fn().mockReturnValue([]),
        onRunFinished: jest.fn(() => () => {}),
        // Finished unless a test says otherwise, so each sweep's wait ends at once.
        getFinishedRun: jest.fn().mockReturnValue({ finishedAt: new Date(), totals: null }),
        getTotals: jest.fn().mockReturnValue(null),
        getUnreportedJobs: jest.fn().mockReturnValue([]),
      };
    });

    test('records the queueing result directly when no tracker is set', async () => {
      const record = await startSweep();
      expect(record).not.toHaveProperty('finalRecord');
    });

    test('describes the whole sweep once its downloads end', async () => {
      autoDownloadScheduler.setRunTracker(runTracker);
      runTracker.getFinishedRun.mockReturnValue({
        finishedAt: new Date('2026-09-28T16:21:17.000Z'),
        totals: { totalDownloaded: 3, totalSkipped: 6, totalFailed: 0, jobCount: 2 },
      });

      const record = await startSweep();

      await expect(record.finalRecord).resolves.toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: '3 videos downloaded, 6 skipped (already downloaded or filtered).',
      }));
    });

    test('keeps playlist problems from queueing in the final record', async () => {
      autoDownloadScheduler.setRunTracker(runTracker);
      const record = await startSweep({ playlistError: null, playlistsFailed: 1, playlistsChecked: 3 });
      await expect(record.finalRecord).resolves.toEqual(expect.objectContaining({
        status: 'error', outcome: 'partial', message: expect.stringContaining('1 of 3 playlists could not be checked.'),
      }));
    });

    test('ends the record at a storage pause with the pause reason', async () => {
      autoDownloadScheduler.setRunTracker(runTracker);
      runTracker.getFinishedRun.mockReturnValue(null);
      runTracker.getUnreportedJobs.mockReturnValue([{ id: 'p1', status: 'Pending', reporting: false }]);
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });

      const record = await startSweep();

      await expect(record.finalRecord).resolves.toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'paused',
        message: expect.stringContaining('Stopped when downloads were paused: Downloads are paused: downloaded videos use 12.0 GB'),
      }));
    });

    test('does not report the task running once the queueing has returned and no job is active', async () => {
      autoDownloadScheduler.setRunTracker(runTracker);
      autoDownloadScheduler.scheduleTask();
      await startSweep();
      expect(autoDownloadScheduler.isChannelDownloadRunning()).toBe(false);
    });
  });

  describe('registration with the scheduled task manager', () => {
    let storageGuard;
    let runTracker;

    const taskStatus = () => scheduledTaskManager.getStatus().find((task) => task.id === 'channelDownloadFrequency');

    beforeEach(() => {
      storageGuard = require('../../storageGuard');
      runTracker = {
        isActive: jest.fn().mockReturnValue(true),
        getUnfinishedJobs: jest.fn().mockReturnValue([]),
        onRunFinished: jest.fn(() => () => {}),
        // Finished unless a test says otherwise, so each sweep's wait ends at once.
        getFinishedRun: jest.fn().mockReturnValue({ finishedAt: new Date(), totals: null }),
        getTotals: jest.fn().mockReturnValue(null),
        getUnreportedJobs: jest.fn().mockReturnValue([]),
      };
      autoDownloadScheduler.setRunTracker(runTracker);
    });

    test('reports the task running while a tracked sweep has an unfinished job', async () => {
      autoDownloadScheduler.scheduleTask();
      downloadModule.doChannelAndPlaylistDownloads.mockImplementationOnce(async (jobData) => {
        jobData.runId = 'run-1';
      });
      await autoDownloadScheduler.channelAutoDownload();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'Pending' }]);

      expect(taskStatus().running).toBe(true);
    });

    test('passes the downloads-paused blocker through to Run now', async () => {
      autoDownloadScheduler.scheduleTask();
      storageGuard.getStatus.mockReturnValue({ paused: true, reasons: [] });

      await expect(scheduledTaskManager.getRunBlocker('channelDownloadFrequency')).resolves.toEqual(
        expect.objectContaining({ reason: 'downloads-paused' })
      );
    });

    test('passes Run now job data through to the sweep', async () => {
      autoDownloadScheduler.scheduleTask();
      const jobData = { overrideSettings: { videoCount: 5 } };

      await (await scheduledTaskManager.runNow('channelDownloadFrequency', { args: { jobData } })).completion;

      expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledWith(jobData);
    });

    test('starts a second Run now right after the first completes, with no cooldown', async () => {
      autoDownloadScheduler.scheduleTask();
      await (await scheduledTaskManager.runNow('channelDownloadFrequency')).completion;

      await expect(scheduledTaskManager.runNow('channelDownloadFrequency')).resolves.toEqual(
        expect.objectContaining({ started: true })
      );
    });

    test('refuses a second Run now while a tracked sweep job is still In Progress', async () => {
      autoDownloadScheduler.scheduleTask();
      downloadModule.doChannelAndPlaylistDownloads.mockImplementationOnce(async (jobData) => {
        jobData.runId = 'run-1';
      });
      await autoDownloadScheduler.channelAutoDownload();
      runTracker.getUnfinishedJobs.mockReturnValue([{ id: 'p1', status: 'In Progress' }]);

      await expect(scheduledTaskManager.runNow('channelDownloadFrequency')).resolves.toEqual(
        expect.objectContaining({ started: false, reason: 'running' })
      );
    });

    describe('with automatic downloads turned off', () => {
      beforeEach(() => {
        configModule.getConfig.mockReturnValue({
          channelAutoDownload: false,
          channelDownloadFrequency: '0 */12 * * *'
        });
        autoDownloadScheduler.scheduleTask();
      });

      test('arms no timer', () => {
        expect(cron.schedule).not.toHaveBeenCalled();
      });

      test('does not block Run now as turned off', async () => {
        await expect(scheduledTaskManager.getRunBlocker('channelDownloadFrequency')).resolves.toBeNull();
      });

      test('still runs the sweep on Run now', async () => {
        await (await scheduledTaskManager.runNow('channelDownloadFrequency')).completion;

        expect(downloadModule.doChannelAndPlaylistDownloads).toHaveBeenCalledWith({});
      });
    });
  });
});
