/* eslint-env jest */
const { Op } = require('sequelize');
const { createGrabExecutor } = require('../grabExecutor');
const { ARR_BRIDGE_JOB_LABEL } = require('../../download/jobTypes');

const NOW = new Date('2025-06-10T12:00:00.000Z');
const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const JOB_ID = '22222222-3333-4444-8555-666666666666';
const RETRY_JOB_ID = '11111111-2222-4333-8444-555555555555';
const YOUTUBE_ID = 'abcdefghijk';
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
const LIBRARY_FILE = '/data/NBC/The Office [abcdefghijk].mkv';
const STAGED_FILE = `/data/.arr-staging/tv/${TITLE}/${TITLE}.mkv`;
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);
const daysAgo = (days) => minutesAgo(days * 24 * 60);

function matchesValue(actual, expected) {
  if (expected === null || typeof expected !== 'object' || expected instanceof Date) return actual === expected;
  return Reflect.ownKeys(expected).every((operator) => {
    const operand = expected[operator];
    if (operator === Op.ne) return actual !== operand;
    if (operator === Op.in) return operand.includes(actual);
    if (operator === Op.lt) return actual !== null && actual < operand;
    throw new Error(`Unsupported operator ${String(operator)}`);
  });
}

function matches(where) {
  return (row) => Reflect.ownKeys(where).every((key) => {
    if (key === Op.or) return where[key].some((branch) => matches(branch)(row));
    return matchesValue(row[key] ?? null, where[key]);
  });
}

// An in-memory stand-in for the model: tests assert on the rows, not the calls.
function grabTable(rows) {
  return {
    rows,
    findAll: jest.fn(async ({ where }) => rows.filter(matches(where))),
    findByPk: jest.fn(async (id) => rows.find((row) => row.id === id) || null),
    update: jest.fn(async (values, { where }) => {
      const hits = rows.filter(matches(where));
      hits.forEach((row) => Object.assign(row, values));
      return [hits.length];
    }),
  };
}

function grab(overrides = {}) {
  return {
    id: GRAB_ID,
    youtube_id: YOUTUBE_ID,
    kind: 'tv',
    category: 'tv',
    release_title: TITLE,
    status: 'pending',
    job_id: null,
    staged_path: null,
    bytes: null,
    fail_message: null,
    created_at: minutesAgo(1),
    updated_at: minutesAgo(1),
    completed_at: null,
    removed_at: null,
    ...overrides,
  };
}

const queued = (overrides = {}) => grab({ status: 'queued', job_id: JOB_ID, ...overrides });
const downloadedVideo = { youtubeId: YOUTUBE_ID, filePath: LIBRARY_FILE, audioFilePath: null };

function setup({ rows = [], video = null, jobs = {}, storedJob = null, categories, resolution = null } = {}) {
  const state = { video };
  const ArrBridgeGrab = grabTable(rows);
  const deps = {
    models: {
      ArrBridgeGrab,
      Video: { findOne: jest.fn(async () => state.video) },
      Job: { findByPk: jest.fn(async () => storedJob) },
    },
    downloader: jest.fn(async (_jobData, { jobId }) => jobId),
    needsRedownload: jest.fn().mockResolvedValue(false),
    jobLookup: jest.fn((jobId) => jobs[jobId] || null),
    storageGuard: { isPausedError: (error) => error?.code === 'DOWNLOADS_PAUSED' },
    staging: {
      ensureCategoryFolders: jest.fn().mockResolvedValue(undefined),
      stage: jest.fn().mockResolvedValue({ stagedPath: STAGED_FILE, bytes: 4096, method: 'hardlink' }),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    getSettings: () => ({
      categories: categories || [{ name: 'tv', subfolder: null }, { name: 'tv-4k', subfolder: 'Shows' }],
      retentionDays: 7,
      resolution,
    }),
    fileState: jest.fn(async (filePath) => (filePath === LIBRARY_FILE ? 'present' : 'missing')),
    newId: () => JOB_ID,
    now: () => NOW,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    scheduleWake: jest.fn(),
  };
  return { executor: createGrabExecutor(deps), deps, state, rows };
}

const endedJob = (data = {}, status = 'Complete') => ({ jobType: ARR_BRIDGE_JOB_LABEL, status, data });

describe('grabExecutor', () => {
  describe('a pending grab', () => {
    test('is staged straight away when the video is already downloaded', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo });

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(deps.staging.stage).toHaveBeenCalledWith({ category: 'tv', releaseTitle: TITLE, sourcePath: LIBRARY_FILE });
      expect(rows[0]).toMatchObject({ status: 'completed', staged_path: STAGED_FILE, bytes: 4096, completed_at: NOW });
    });

    test('queues an ordinary download under a new job id recorded on the grab', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledWith(
        {
          urls: [`https://www.youtube.com/watch?v=${YOUTUBE_ID}`],
          jobLabel: ARR_BRIDGE_JOB_LABEL,
          overrideSettings: {},
        },
        { jobId: JOB_ID }
      );
      expect(rows[0]).toMatchObject({ status: 'queued', job_id: JOB_ID });
    });

    test('sends the category subfolder when the category sets one', async () => {
      const { executor, deps } = setup({ rows: [grab({ category: 'tv-4k' })] });
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ subfolder: 'Shows' });
    });

    test('downloads at the resolution in the release name when the bridge has its own resolution', async () => {
      const { executor, deps } = setup({ rows: [grab()], resolution: '720' });
      await executor.runOnce();
      // The release was offered as 1080p before the setting changed to 720.
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ resolution: '1080' });
    });

    test('falls back to the setting for a release name without a resolution', async () => {
      const { executor, deps } = setup({ rows: [grab({ release_title: 'The.Office.US.S01E02.WEB-DL-NBC' })], resolution: '720' });
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ resolution: '720' });
    });

    test('allows a re-download only when the archive would otherwise skip the video', async () => {
      const { executor, deps } = setup({ rows: [grab()] });
      deps.needsRedownload.mockResolvedValue(true);
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ allowRedownload: true });
    });

    test('waits when downloads are paused', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });
      deps.downloader.mockRejectedValue(Object.assign(new Error('paused'), { code: 'DOWNLOADS_PAUSED' }));

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null, fail_message: null });
    });

    test('waits when another job is already downloading the video', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });
      deps.downloader.mockResolvedValue({ queued: 0, acceptedIds: [], alreadyActiveIds: [YOUTUBE_ID] });

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null });
    });

    test('fails with a plain message when the download cannot be queued', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });
      deps.downloader.mockRejectedValue(new Error('disk exploded'));

      await executor.runOnce();

      expect(rows[0]).toMatchObject({
        status: 'failed', fail_message: 'Youtarr could not queue the download', completed_at: NOW,
      });
    });

    test('is left alone when it was removed before the executor reached it', async () => {
      const row = grab();
      const { executor, deps } = setup({ rows: [row] });
      deps.needsRedownload.mockImplementation(async () => {
        row.status = 'removed';
        return false;
      });

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(row.status).toBe('removed');
    });

    test('fails with the staging message when the library file cannot be staged', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo });
      deps.staging.stage.mockRejectedValue(Object.assign(new Error('gone'), { code: 'ENOENT' }));

      await expect(executor.runOnce()).resolves.toBeUndefined();

      expect(rows[0]).toMatchObject({ status: 'failed', fail_message: 'Youtarr could not stage the file for import' });
    });
  });

  describe('when a job ends', () => {
    test('ignores jobs that are not grabs without touching the database', async () => {
      const { executor, deps } = setup({
        rows: [queued()], jobs: { other: { jobType: 'Channel Downloads', status: 'Complete' } },
      });

      await executor.handleJobEnded({ jobId: 'other' });

      expect(deps.models.ArrBridgeGrab.findAll).not.toHaveBeenCalled();
    });

    test('stages the downloaded file and completes the grab', async () => {
      const { executor, deps, rows } = setup({
        rows: [queued()], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() },
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(deps.staging.stage).toHaveBeenCalledWith({ category: 'tv', releaseTitle: TITLE, sourcePath: LIBRARY_FILE });
      expect(rows[0]).toMatchObject({ status: 'completed', staged_path: STAGED_FILE, bytes: 4096, completed_at: NOW });
    });

    test('queues the grab again when a restart terminated its job, instead of failing it', async () => {
      const job = endedJob({}, 'Terminated');
      job.output = 'Job terminated during server restart';
      const { executor, deps, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null, fail_message: null, completed_at: null });

      await executor.runOnce();
      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows[0].status).toBe('queued');
    });

    test('still fails a video the job recorded as failed before the restart', async () => {
      const job = endedJob({ failedVideos: [{ youtubeId: YOUTUBE_ID, error: 'ERROR: Video unavailable' }] }, 'Terminated');
      job.output = 'Job terminated due to server restart';
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'failed', fail_message: 'ERROR: Video unavailable' });
    });

    test('waits instead of failing when the downloaded file cannot be checked', async () => {
      const { executor, deps, rows } = setup({
        rows: [queued()], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() },
      });
      deps.fileState.mockResolvedValue('unknown');

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(deps.staging.stage).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ status: 'queued', fail_message: null });
    });

    test('fails with the diagnosis title when the download was diagnosed', async () => {
      const job = endedJob({
        failedVideos: [{ youtubeId: YOUTUBE_ID, error: 'ERROR: Sign in to confirm', diagnosisKey: 'bot-check' }],
        diagnoses: [{ key: 'bot-check', title: 'YouTube bot check (usually temporary)', message: 'Long text', count: 1 }],
      }, 'Error');
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({
        status: 'failed', fail_message: 'YouTube bot check (usually temporary)', completed_at: NOW,
      });
    });

    test('fails with the start of the error text when there is no diagnosis', async () => {
      const job = endedJob({ failedVideos: [{ youtubeId: YOUTUBE_ID, error: `ERROR: ${'x'.repeat(500)}` }] }, 'Error');
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0].status).toBe('failed');
      expect(rows[0].fail_message).toHaveLength(200);
    });

    test('says so when Youtarr downloaded audio only', async () => {
      const { executor, rows } = setup({
        rows: [queued()],
        video: { youtubeId: YOUTUBE_ID, filePath: null, audioFilePath: '/data/NBC/x.mp3' },
        jobs: { [JOB_ID]: endedJob() },
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({
        status: 'failed',
        fail_message: 'Youtarr downloaded audio only for this video, so there is no video file to import',
      });
    });

    test('says the download was stopped when the job was terminated', async () => {
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: endedJob({}, 'Terminated') } });
      await executor.handleJobEnded({ jobId: JOB_ID });
      expect(rows[0].fail_message).toBe('The download was stopped in Youtarr');
    });

    test('fails with a general message when the job left no file and no reason', async () => {
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: endedJob() } });
      await executor.handleJobEnded({ jobId: JOB_ID });
      expect(rows[0].fail_message)
        .toBe('The download finished without a video file (members-only, filtered or unavailable)');
    });

    test('follows an automatic retry instead of failing', async () => {
      const job = endedJob({
        failedVideos: [{ youtubeId: YOUTUBE_ID, autoRetryQueued: true, autoRetryJobId: RETRY_JOB_ID }],
      }, 'Error');
      const { executor, rows } = setup({
        rows: [queued()],
        jobs: { [JOB_ID]: job, [RETRY_JOB_ID]: { jobType: 'Auto-retry: 1 video', status: 'In Progress', data: {} } },
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'queued', job_id: RETRY_JOB_ID, fail_message: null });
    });

    test('completes the grab when its automatic retry ends with the file', async () => {
      const { executor, rows } = setup({
        rows: [queued({ job_id: RETRY_JOB_ID })],
        video: downloadedVideo,
        jobs: { [RETRY_JOB_ID]: { jobType: 'Auto-retry: 1 video', status: 'Complete', data: {} } },
      });

      await executor.handleJobEnded({ jobId: RETRY_JOB_ID });

      expect(rows[0].status).toBe('completed');
    });

    test('sees a video that was saved just after the first look', async () => {
      const { executor, deps, state, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: endedJob() } });
      deps.jobLookup.mockImplementation(() => {
        state.video = downloadedVideo;
        return endedJob();
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0].status).toBe('completed');
    });

    test('never stages for a grab the client removed while it downloaded', async () => {
      const { executor, deps, rows } = setup({
        rows: [queued({ status: 'removed' })], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() },
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(deps.staging.stage).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('removed');
    });

    test('takes the staged file back when the grab is removed during staging', async () => {
      const row = queued();
      const { executor, deps } = setup({ rows: [row], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() } });
      deps.staging.stage.mockImplementation(async () => {
        row.status = 'removed';
        return { stagedPath: STAGED_FILE, bytes: 4096, method: 'hardlink' };
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(row.status).toBe('removed');
      expect(deps.staging.remove).toHaveBeenCalledWith({ category: 'tv', releaseTitle: TITLE });
    });

    test('a database error is logged, not thrown', async () => {
      const { executor, deps } = setup({ rows: [queued()], jobs: { [JOB_ID]: endedJob() } });
      deps.models.ArrBridgeGrab.findAll.mockRejectedValue(new Error('db down'));

      await expect(executor.handleJobEnded({ jobId: JOB_ID })).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('the sweep', () => {
    test('creates the category folders', async () => {
      const { executor, deps } = setup();
      await executor.runOnce();
      expect(deps.staging.ensureCategoryFolders).toHaveBeenCalledTimes(1);
    });

    test('keeps going when the folders cannot be created', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });
      deps.staging.ensureCategoryFolders.mockRejectedValue(new Error('read-only'));

      await executor.runOnce();

      expect(rows[0].status).toBe('queued');
    });

    test('closes a queued grab whose job ended while nobody was listening', async () => {
      const { executor, rows } = setup({
        rows: [queued()], video: downloadedVideo, storedJob: { id: GRAB_ID, status: 'Complete', aux_data: null },
      });

      await executor.runOnce();

      expect(rows[0].status).toBe('completed');
    });

    test('leaves a queued grab alone while its job is still running', async () => {
      const { executor, rows } = setup({
        rows: [queued()], jobs: { [JOB_ID]: { jobType: ARR_BRIDGE_JOB_LABEL, status: 'In Progress', data: {} } },
      });

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'queued', fail_message: null });
    });

    test('queues again a grab whose job was never created, as after a crash while queueing', async () => {
      const { executor, deps, rows } = setup({ rows: [queued()] });

      await executor.runOnce();
      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null, fail_message: null });

      await executor.runOnce();
      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows[0]).toMatchObject({ status: 'queued', job_id: JOB_ID });
    });

    test('queues again a queued grab that has no job id', async () => {
      const { executor, rows } = setup({ rows: [queued({ job_id: null })] });
      await executor.runOnce();
      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null });
    });

    test('closes a grab whose job a restart terminated after the video was saved', async () => {
      const { executor, rows } = setup({
        rows: [queued()],
        video: downloadedVideo,
        storedJob: { id: JOB_ID, status: 'Terminated', output: '1 video completed (recovered after server restart)', aux_data: null },
      });

      await executor.runOnce();

      expect(rows[0].status).toBe('completed');
    });

    test('leaves a pending grab alone when the library file cannot be checked', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo });
      deps.fileState.mockResolvedValue('unknown');

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(deps.staging.stage).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('pending');
    });

    test('removes a completed grab and its staged folder after the retention period', async () => {
      const old = grab({ status: 'completed', completed_at: daysAgo(8), staged_path: STAGED_FILE });
      const recent = grab({ id: RETRY_JOB_ID, status: 'completed', completed_at: daysAgo(2), release_title: 'Other.S01E01.1080p.WEB-DL-X' });
      const { executor, deps } = setup({ rows: [old, recent] });

      await executor.runOnce();

      expect(old).toMatchObject({ status: 'removed', removed_at: NOW });
      expect(recent.status).toBe('completed');
      expect(deps.staging.remove).toHaveBeenCalledTimes(1);
      expect(deps.staging.remove).toHaveBeenCalledWith({ category: 'tv', releaseTitle: TITLE });
    });
  });

  describe('lifecycle', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('start sweeps at once and then every minute until stopped', async () => {
      const { executor, deps } = setup();

      executor.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(deps.staging.ensureCategoryFolders).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(60_000);
      expect(deps.staging.ensureCategoryFolders).toHaveBeenCalledTimes(2);

      executor.stop();
      await jest.advanceTimersByTimeAsync(180_000);
      expect(deps.staging.ensureCategoryFolders).toHaveBeenCalledTimes(2);
    });

    test('wake schedules one sweep however often it is called', () => {
      const { executor, deps } = setup();
      executor.wake();
      executor.wake();
      expect(deps.scheduleWake).toHaveBeenCalledTimes(1);
    });
  });
});
