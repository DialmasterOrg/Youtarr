/* eslint-env jest */
jest.mock('../../models', () => ({
  Channel: { count: jest.fn() },
  Video: { count: jest.fn(), findAll: jest.fn() },
}));
jest.mock('../jobModule', () => ({ getAllJobs: jest.fn() }));
jest.mock('../download/videoActivity', () => ({ snapshot: jest.fn() }));
jest.mock('../storageGuard', () => ({ getStatus: jest.fn() }));
jest.mock('../storageUsage', () => ({ getDownloadedBytes: jest.fn() }));
jest.mock('../messageEmitter', () => ({ getLastFinishedRun: jest.fn() }));

const VERSIONS = { version: '1.93.0', ytDlpVersion: '2026.11.16' };

describe('statusSummaryModule', () => {
  let statusSummaryModule;
  let models;
  let jobModule;
  let videoActivity;
  let storageGuard;
  let storageUsage;
  let messageEmitter;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useRealTimers();
    models = require('../../models');
    jobModule = require('../jobModule');
    videoActivity = require('../download/videoActivity');
    storageGuard = require('../storageGuard');
    storageUsage = require('../storageUsage');
    messageEmitter = require('../messageEmitter');

    models.Channel.count.mockResolvedValue(12);
    models.Video.count.mockResolvedValue(340);
    models.Video.findAll.mockResolvedValue([]);
    storageUsage.getDownloadedBytes.mockResolvedValue(5000);
    jobModule.getAllJobs.mockReturnValue({});
    videoActivity.snapshot.mockReturnValue({ videos: {} });
    storageGuard.getStatus.mockReturnValue({ paused: false });
    messageEmitter.getLastFinishedRun.mockReturnValue(null);

    statusSummaryModule = require('../statusSummaryModule');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reports versions and library totals for subscribed channels and videos on disk', async () => {
    const summary = await statusSummaryModule.getSummary(VERSIONS);

    expect(summary.version).toBe('1.93.0');
    expect(summary.ytDlp).toEqual({ version: '2026.11.16' });
    expect(summary.library).toEqual({ channels: 12, videos: 340, storageBytes: 5000 });
    expect(models.Channel.count).toHaveBeenCalledWith({ where: { enabled: true } });
    expect(models.Video.count).toHaveBeenCalledWith({ where: { removed: false } });
  });

  test('reports a null yt-dlp version when it is not known yet', async () => {
    const summary = await statusSummaryModule.getSummary({ version: '1.93.0', ytDlpVersion: undefined });

    expect(summary.ytDlp).toEqual({ version: null });
  });

  test('lists recent downloads without filesystem paths', async () => {
    models.Video.findAll.mockResolvedValue([{
      youtubeId: 'abcdefghijk',
      youTubeVideoName: 'A video',
      youTubeChannelName: 'A channel',
      last_downloaded_at: new Date('2026-11-17T19:04:00.000Z'),
      filePath: '/library/A channel/A video.mp4',
    }]);

    const summary = await statusSummaryModule.getSummary(VERSIONS);

    expect(summary.recentDownloads).toEqual([{
      youtubeId: 'abcdefghijk',
      title: 'A video',
      channel: 'A channel',
      downloadedAt: '2026-11-17T19:04:00.000Z',
    }]);
    expect(models.Video.findAll.mock.calls[0][0].limit).toBe(10);
  });

  test('counts the active job, queued jobs and per-video activity', async () => {
    jobModule.getAllJobs.mockReturnValue({
      a: { status: 'In Progress', jobType: 'Channel Downloads', timeCreated: Date.parse('2026-11-17T20:00:00.000Z') },
      b: { status: 'Pending', jobType: 'Manually Added Urls' },
      c: { status: 'Pending', jobType: 'Manually Added Urls' },
      d: { status: 'Complete', jobType: 'Channel Downloads' },
    });
    videoActivity.snapshot.mockReturnValue({
      videos: {
        one: { jobId: 'a', state: 'downloading' },
        two: { jobId: 'a', state: 'queued' },
        three: { jobId: 'b', state: 'queued' },
      },
    });
    storageGuard.getStatus.mockReturnValue({ paused: true });

    const { downloads } = await statusSummaryModule.getSummary(VERSIONS);

    expect(downloads).toEqual({
      paused: true,
      activeJob: { type: 'Channel Downloads', createdAt: '2026-11-17T20:00:00.000Z' },
      queuedJobs: 2,
      videosDownloading: 1,
      videosQueued: 2,
    });
  });

  test('reports an idle queue when nothing is running', async () => {
    storageGuard.getStatus.mockReturnValue(undefined);

    const { downloads } = await statusSummaryModule.getSummary(VERSIONS);

    expect(downloads).toEqual({
      paused: false, activeJob: null, queuedJobs: 0, videosDownloading: 0, videosQueued: 0,
    });
  });

  test('has no last run until one finishes', async () => {
    const summary = await statusSummaryModule.getSummary(VERSIONS);

    expect(summary.lastRun).toBeNull();
  });

  test('summarizes the last finished run', async () => {
    messageEmitter.getLastFinishedRun.mockReturnValue({
      finalSummary: { totalDownloaded: 3, totalFailed: 1, completedAt: '2026-11-17T19:05:00.000Z' },
    });

    const summary = await statusSummaryModule.getSummary(VERSIONS);

    expect(summary.lastRun).toEqual({
      status: 'success',
      finishedAt: '2026-11-17T19:05:00.000Z',
      lastCheckedAt: '2026-11-17T19:05:00.000Z',
      downloaded: 3,
      failed: 1,
    });
  });

  test('keeps the last real result and reports when a later check found nothing new', async () => {
    messageEmitter.getLastFinishedRun.mockReturnValue({
      finalSummary: {
        totalDownloaded: 3,
        totalFailed: 0,
        completedAt: '2026-11-17T19:05:00.000Z',
        lastCheckedAt: '2026-11-17T21:00:00.000Z',
      },
    });

    const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

    expect(lastRun.finishedAt).toBe('2026-11-17T19:05:00.000Z');
    expect(lastRun.lastCheckedAt).toBe('2026-11-17T21:00:00.000Z');
  });

  test.each([
    ['error', { error: true }],
    ['warning', { warning: true }],
  ])('marks the last run as %s', async (status, flags) => {
    messageEmitter.getLastFinishedRun.mockReturnValue({
      ...flags,
      finalSummary: { totalDownloaded: 0, totalFailed: 2, completedAt: '2026-11-17T19:05:00.000Z' },
    });

    const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

    expect(lastRun.status).toBe(status);
  });

  describe('last run after a restart', () => {
    const finishedJob = (overrides = {}) => ({
      status: 'Complete',
      jobType: 'Channel Downloads',
      timeCreated: new Date('2026-11-17T10:00:00.000Z'),
      data: { videos: [{ id: 1 }, { id: 2 }], failedVideos: [] },
      ...overrides,
    });

    test('rebuilds the last run from the newest finished job in the history', async () => {
      jobModule.getAllJobs.mockReturnValue({
        older: finishedJob({ timeCreated: new Date('2026-11-16T10:00:00.000Z'), data: { videos: [{ id: 9 }], failedVideos: [] } }),
        newer: finishedJob({ data: { videos: [{ id: 1 }, { id: 2 }], failedVideos: [{ youtubeId: 'x' }] } }),
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun).toEqual({
        status: 'success', finishedAt: null, lastCheckedAt: null, downloaded: 2, failed: 1,
      });
    });

    test.each([
      ['Complete with Warnings', 'warning'],
      ['Terminated', 'warning'],
      ['Error', 'error'],
      ['Killed', 'error'],
    ])('reads a %s job as a %s run', async (jobStatus, runStatus) => {
      jobModule.getAllJobs.mockReturnValue({ a: finishedJob({ status: jobStatus }) });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun.status).toBe(runStatus);
    });

    test('skips jobs that have not finished and clean jobs that found nothing', async () => {
      jobModule.getAllJobs.mockReturnValue({
        running: finishedJob({ status: 'In Progress', timeCreated: new Date('2026-11-18T12:00:00.000Z') }),
        queued: finishedJob({ status: 'Pending', timeCreated: new Date('2026-11-18T11:00:00.000Z') }),
        nothingNew: finishedJob({ timeCreated: new Date('2026-11-18T10:00:00.000Z'), data: { videos: [], failedVideos: [] } }),
        real: finishedJob({ data: { videos: [{ id: 1 }], failedVideos: [] } }),
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun.downloaded).toBe(1);
    });

    test('shows a failed job even when it downloaded nothing', async () => {
      jobModule.getAllJobs.mockReturnValue({
        failed: finishedJob({ status: 'Error', data: { videos: [], failedVideos: [] } }),
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun).toEqual(expect.objectContaining({ status: 'error', downloaded: 0, failed: 0 }));
    });

    test('prefers a run that finished since startup over the history', async () => {
      jobModule.getAllJobs.mockReturnValue({ a: finishedJob() });
      messageEmitter.getLastFinishedRun.mockReturnValue({
        finalSummary: { totalDownloaded: 5, totalFailed: 0, completedAt: '2026-11-18T09:00:00.000Z' },
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun.downloaded).toBe(5);
      expect(lastRun.finishedAt).toBe('2026-11-18T09:00:00.000Z');
    });

    test('keeps the history result when the only run since startup found nothing new', async () => {
      jobModule.getAllJobs.mockReturnValue({ a: finishedJob() });
      messageEmitter.getLastFinishedRun.mockReturnValue({
        finalSummary: { totalDownloaded: 0, totalFailed: 0, completedAt: '2026-11-18T09:00:00.000Z' },
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun).toEqual({
        status: 'success', finishedAt: null, lastCheckedAt: '2026-11-18T09:00:00.000Z', downloaded: 2, failed: 0,
      });
    });

    test('reports an empty run as it is when there is no history either', async () => {
      messageEmitter.getLastFinishedRun.mockReturnValue({
        finalSummary: { totalDownloaded: 0, totalFailed: 0, completedAt: '2026-11-18T09:00:00.000Z' },
      });

      const { lastRun } = await statusSummaryModule.getSummary(VERSIONS);

      expect(lastRun).toEqual(expect.objectContaining({ status: 'success', downloaded: 0, failed: 0 }));
    });
  });

  test('shares one database read between calls inside the cache window', async () => {
    await statusSummaryModule.getSummary(VERSIONS);
    await statusSummaryModule.getSummary(VERSIONS);

    expect(models.Video.count).toHaveBeenCalledTimes(1);
    expect(storageUsage.getDownloadedBytes).toHaveBeenCalledTimes(1);
  });

  test('reads live queue state on every call, even while the library is cached', async () => {
    await statusSummaryModule.getSummary(VERSIONS);
    jobModule.getAllJobs.mockReturnValue({ a: { status: 'Pending', jobType: 'Channel Downloads' } });

    const { downloads } = await statusSummaryModule.getSummary(VERSIONS);

    expect(downloads.queuedJobs).toBe(1);
  });

  test('reads the database again once the cache window has passed', async () => {
    jest.useFakeTimers();
    await statusSummaryModule.getSummary(VERSIONS);
    jest.advanceTimersByTime(31 * 1000);

    await statusSummaryModule.getSummary(VERSIONS);

    expect(models.Video.count).toHaveBeenCalledTimes(2);
  });

  test('does not cache a failed database read', async () => {
    models.Video.count.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(statusSummaryModule.getSummary(VERSIONS)).rejects.toThrow('database unavailable');
    const summary = await statusSummaryModule.getSummary(VERSIONS);

    expect(summary.library.videos).toBe(340);
  });
});
