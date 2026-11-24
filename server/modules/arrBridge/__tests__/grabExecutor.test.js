/* eslint-env jest */
const { Op } = require('sequelize');
const { createGrabExecutor } = require('../grabExecutor');
const { ARR_BRIDGE_JOB_LABEL } = require('../../download/jobTypes');
const jobOutputPrefixes = require('../../constants/jobOutputPrefixes');

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
const minutesAfter = (minutes) => new Date(NOW.getTime() + minutes * 60 * 1000);

function matchesValue(actual, expected) {
  if (expected === null || typeof expected !== 'object' || expected instanceof Date) return actual === expected;
  return Reflect.ownKeys(expected).every((operator) => {
    const operand = expected[operator];
    if (operator === Op.ne) return actual !== operand;
    if (operator === Op.in) return operand.includes(actual);
    if (operator === Op.notIn) return !operand.includes(actual);
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
    findAll: jest.fn(async ({ where, order = [], limit = Infinity }) => {
      const compare = (a, b) => {
        for (const [column] of order) {
          if (a[column] < b[column]) return -1;
          if (a[column] > b[column]) return 1;
        }
        return 0;
      };
      return rows.filter(matches(where)).sort(compare).slice(0, limit);
    }),
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
    library_copy: null,
    blocked_at: null,
    created_at: minutesAgo(1),
    updated_at: minutesAgo(1),
    completed_at: null,
    removed_at: null,
    ...overrides,
  };
}

const queued = (overrides = {}) => grab({ status: 'queued', job_id: JOB_ID, ...overrides });
const downloadedVideo = { youtubeId: YOUTUBE_ID, filePath: LIBRARY_FILE, audioFilePath: null };

function setup({
  rows = [], video = null, jobs = {}, storedJob = null, categories, resolution = null, now = () => NOW,
  newId = () => JOB_ID,
} = {}) {
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
    onHandedOff: jest.fn().mockResolvedValue(undefined),
    settleLibraryCopies: jest.fn().mockResolvedValue(undefined),
    getCookieKey: jest.fn(() => 'cookie-key-1'),
    isPaused: jest.fn(() => false),
    newId,
    now,
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
      expect(deps.staging.stage).toHaveBeenCalledWith({
        category: 'tv', releaseTitle: TITLE, sourcePath: LIBRARY_FILE, youtubeId: YOUTUBE_ID,
      });
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

    test('downloads at the bridge resolution whatever the release name says', async () => {
      const { executor, deps } = setup({ rows: [grab({ release_title: 'Show.S01E05.480p.YT.WEB-DL-Chan' })], resolution: '1080' });
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ resolution: '1080' });
    });

    test('ignores the resolution in a release name built before the YT marker', async () => {
      const { executor, deps } = setup({ rows: [grab({ release_title: 'Show.S01E05.480p.WEB-DL-Chan' })], resolution: '1080' });
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).toEqual({ resolution: '1080' });
    });

    test('sends no resolution when the bridge has none', async () => {
      const { executor, deps } = setup({ rows: [grab({ release_title: 'Show.S01E05.480p.YT.WEB-DL-Chan' })], resolution: null });
      await executor.runOnce();
      expect(deps.downloader.mock.calls[0][0].overrideSettings).not.toHaveProperty('resolution');
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

    test('waits instead of failing when the library file cannot be staged', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo });
      deps.staging.stage.mockRejectedValue(Object.assign(new Error('full'), { code: 'ENOSPC' }));

      await expect(executor.runOnce()).resolves.toBeUndefined();
      await executor.runOnce();

      expect(deps.staging.stage).toHaveBeenCalledTimes(1);
      expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null, completed_at: null });
    });

    test('stages the file once the wait after a staging error is over', async () => {
      const clock = { time: NOW };
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo, now: () => clock.time });
      deps.staging.stage.mockRejectedValueOnce(Object.assign(new Error('full'), { code: 'ENOSPC' }));
      await executor.runOnce();

      clock.time = minutesAfter(16);
      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ status: 'completed', staged_path: STAGED_FILE, fail_message: null });
    });

    test('fails with the staging message when staging still fails a day later', async () => {
      const clock = { time: NOW };
      const { executor, deps, rows } = setup({ rows: [grab()], video: downloadedVideo, now: () => clock.time });
      deps.staging.stage.mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
      await executor.runOnce();

      clock.time = minutesAfter(24 * 60);
      await executor.runOnce();

      expect(rows[0]).toMatchObject({
        status: 'failed', fail_message: 'Youtarr could not stage the file for import', completed_at: clock.time,
      });
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

      expect(deps.staging.stage).toHaveBeenCalledWith({
        category: 'tv', releaseTitle: TITLE, sourcePath: LIBRARY_FILE, youtubeId: YOUTUBE_ID,
      });
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

    test('waits for a later sweep when the downloaded file cannot be staged', async () => {
      const clock = { time: NOW };
      const { executor, deps, rows } = setup({
        rows: [queued()], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() }, now: () => clock.time,
      });
      deps.staging.stage.mockRejectedValueOnce(Object.assign(new Error('full'), { code: 'ENOSPC' }));

      await executor.handleJobEnded({ jobId: JOB_ID });
      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null, fail_message: null });

      clock.time = minutesAfter(16);
      await executor.runOnce();
      expect(deps.downloader).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ status: 'completed', staged_path: STAGED_FILE });
    });

    test('tries again later when the job errored before trying the video', async () => {
      const clock = { time: NOW };
      const job = endedJob({}, 'Error');
      job.output = 'Output directory is not accessible: EACCES';
      const { executor, deps, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job }, now: () => clock.time });

      await executor.handleJobEnded({ jobId: JOB_ID });
      await executor.runOnce();
      expect(deps.downloader).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ status: 'pending', job_id: null, fail_message: null, completed_at: null });

      clock.time = minutesAfter(16);
      await executor.runOnce();
      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows[0].status).toBe('queued');
    });

    test.each([
      'Output directory is not accessible: the share is down',
      'Download process error: spawn yt-dlp ENOENT',
      'Job could not be started: Unknown error',
    ])('waits when the job ended with "%s", before yt-dlp ran', async (output) => {
      const job = endedJob({}, 'Error');
      job.output = output;
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null });
    });

    // The writers (downloadExecutor, jobModule) build their messages from
    // these same constants, so a reworded message is still recognized.
    test.each(Object.entries(jobOutputPrefixes))('waits for a job output that begins with %s', async (name, prefix) => {
      const job = endedJob({}, 'Error');
      job.output = `${prefix}: any detail`;
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null });
    });

    test('fails a grab whose job errored while finishing, after yt-dlp ran', async () => {
      const job = endedJob({}, 'Error');
      job.output = 'Job finalization error: database is down';
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({
        status: 'failed',
        fail_message: 'The download finished without a video file (members-only, filtered or unavailable)',
      });
    });

    test('fails a grab whose job still errors before trying the video a day later', async () => {
      const clock = { time: NOW };
      const job = endedJob({}, 'Error');
      job.output = 'Output directory is not accessible: the share is down';
      const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: job }, now: () => clock.time });
      await executor.handleJobEnded({ jobId: JOB_ID });

      clock.time = minutesAfter(24 * 60);
      await executor.runOnce();
      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'failed', fail_message: 'Youtarr could not start the download' });
    });

    test('fails a video an errored job tried and left without a file', async () => {
      const { executor, rows } = setup({
        rows: [queued()], jobs: { [JOB_ID]: endedJob({ failedVideos: [] }, 'Error') },
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({
        status: 'failed',
        fail_message: 'The download finished without a video file (members-only, filtered or unavailable)',
      });
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

    test('hands an expired grab over', async () => {
      const old = grab({ status: 'completed', completed_at: daysAgo(8), library_copy: 'owned' });
      const { executor, deps } = setup({ rows: [old] });

      await executor.runOnce();

      expect(deps.onHandedOff).toHaveBeenCalledTimes(1);
      expect(deps.onHandedOff.mock.calls[0][0]).toMatchObject({ id: GRAB_ID, library_copy: 'owned' });
    });

    test('hands an expired grab over even when its staged folder could not be removed', async () => {
      const old = grab({ status: 'completed', completed_at: daysAgo(8), library_copy: 'owned' });
      const { executor, deps } = setup({ rows: [old] });
      deps.staging.remove.mockRejectedValue(new Error('EACCES'));

      await executor.runOnce();

      expect(old.status).toBe('removed');
      expect(deps.onHandedOff).toHaveBeenCalledTimes(1);
    });
  });

  describe('the library copy', () => {
    test('is recorded as the grab\'s own when Youtarr downloads the video for it', async () => {
      const { executor, rows } = setup({ rows: [grab()] });

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'queued', library_copy: 'owned' });
    });

    test('is not the grab\'s own when the video was already in the library', async () => {
      const { executor, rows } = setup({ rows: [grab()], video: downloadedVideo });

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'completed', library_copy: null });
    });

    test('is not the grab\'s own when the library row only lost its file', async () => {
      const { executor, deps, rows } = setup({
        rows: [grab()], video: { youtubeId: YOUTUBE_ID, filePath: '/data/NBC/gone.mkv', audioFilePath: null },
      });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows[0]).toMatchObject({ status: 'queued', library_copy: null });
    });

    test('is not the grab\'s own when another job was already downloading the video', async () => {
      const { executor, deps, rows } = setup({ rows: [grab()] });
      deps.downloader.mockResolvedValue({ queued: 0, acceptedIds: [], alreadyActiveIds: [YOUTUBE_ID] });

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'pending', library_copy: null });
    });

    test('is no longer the grab\'s own once its download was interrupted: another job may fetch the video', async () => {
      const job = endedJob({}, 'Terminated');
      job.output = 'Job terminated during server restart';
      const { executor, state, rows } = setup({ rows: [queued({ library_copy: 'owned' })], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });
      expect(rows[0]).toMatchObject({ status: 'pending', library_copy: null });

      state.video = downloadedVideo;
      await executor.runOnce();
      expect(rows[0]).toMatchObject({ status: 'completed', library_copy: null });
    });

    test('is no longer the grab\'s own once its job ended before trying the video', async () => {
      const job = endedJob({}, 'Error');
      job.output = 'Output directory is not accessible: EACCES';
      const { executor, rows } = setup({ rows: [queued({ library_copy: 'owned' })], jobs: { [JOB_ID]: job } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', library_copy: null });
    });

    test('stays the grab\'s own while a downloaded file waits to be staged again', async () => {
      const { executor, deps, rows } = setup({
        rows: [queued({ library_copy: 'owned' })], video: downloadedVideo, jobs: { [JOB_ID]: endedJob() },
      });
      deps.staging.stage.mockRejectedValueOnce(Object.assign(new Error('full'), { code: 'ENOSPC' }));

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', library_copy: 'owned' });
    });

    test('is settled at the end of every sweep', async () => {
      const { executor, deps } = setup();

      await executor.runOnce();

      expect(deps.settleLibraryCopies).toHaveBeenCalledTimes(1);
    });

    test('a failure to settle does not fail the sweep', async () => {
      const { executor, deps } = setup();
      deps.settleLibraryCopies.mockRejectedValue(new Error('db down'));

      await expect(executor.runOnce()).resolves.toBeUndefined();

      expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('a download YouTube blocked', () => {
    const OTHER_GRAB_ID = '3c1d6a52-0d6c-4f0e-9a3b-5f2f7f1f0a11';
    const THIRD_GRAB_ID = '7e0b9c1a-4a55-4a0b-8a7e-2b1c3d4e5f60';
    const OTHER_YOUTUBE_ID = 'bbbbbbbbbbb';
    const OTHER_JOB_ID = '33333333-4444-4555-8666-777777777777';
    const STILL_BLOCKED = 'YouTube blocked the download, and it was still blocked after a day of retries';
    const blockedJob = (key = 'http-403-cookies-disabled') => endedJob({
      failedVideos: [{ youtubeId: YOUTUBE_ID, error: 'HTTP Error 403: Forbidden', diagnosisKey: key }],
      diagnoses: [{ key, title: 'YouTube blocked the download', message: 'Long text', count: 1 }],
    }, 'Error');
    const otherGrab = (overrides = {}) => grab({
      id: OTHER_GRAB_ID, youtube_id: OTHER_YOUTUBE_ID, release_title: 'The.Office.US.S01E03.1080p.WEB-DL-NBC', ...overrides,
    });

    // One grab's download was just blocked; another grab waits beside it.
    async function setupBlocked({ others = [otherGrab()], ...options } = {}) {
      const clock = { time: NOW };
      const jobs = { [JOB_ID]: blockedJob() };
      const context = setup({
        rows: [queued(), ...others], jobs, now: () => clock.time, newId: () => OTHER_JOB_ID, ...options,
      });
      await context.executor.handleJobEnded({ jobId: JOB_ID });
      return { ...context, clock, jobs };
    }

    test.each([
      'http-403-cookies-enabled',
      'http-403-cookies-disabled',
      'bot-check-cookies-enabled',
      'bot-check-cookies-disabled',
    ])('sends the grab back to waiting instead of failing it (%s)', async (key) => {
      const { executor, rows } = setup({ rows: [queued({ library_copy: 'owned' })], jobs: { [JOB_ID]: blockedJob(key) } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({
        status: 'pending', job_id: null, blocked_at: NOW, fail_message: null, completed_at: null, library_copy: null,
      });
    });

    test('keeps the time of the first block when the grab is blocked again', async () => {
      const firstBlock = minutesAgo(120);
      const { executor, rows } = setup({ rows: [queued({ blocked_at: firstBlock })], jobs: { [JOB_ID]: blockedJob() } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'pending', blocked_at: firstBlock });
    });

    test('fails the grab once it has been blocked for a day', async () => {
      const { executor, rows } = setup({ rows: [queued({ blocked_at: daysAgo(1) })], jobs: { [JOB_ID]: blockedJob() } });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(rows[0]).toMatchObject({ status: 'failed', fail_message: STILL_BLOCKED, completed_at: NOW });
    });

    test.each(['http-403-anonymous-retry', 'bot-check-anonymous-retry'])(
      'still fails at once when the no-cookies fallback failed too (%s)',
      async (key) => {
        const { executor, rows } = setup({ rows: [queued()], jobs: { [JOB_ID]: blockedJob(key) } });

        await executor.handleJobEnded({ jobId: JOB_ID });

        expect(rows[0]).toMatchObject({ status: 'failed', fail_message: 'YouTube blocked the download', blocked_at: null });
      }
    );

    test('does not revive a grab that was removed while its download ran', async () => {
      const row = queued();
      const { executor, deps } = setup({ rows: [row], jobs: { [JOB_ID]: blockedJob() } });
      deps.models.Video.findOne.mockImplementation(async () => {
        row.status = 'removed';
        return null;
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(row).toMatchObject({ status: 'removed', blocked_at: null });
    });

    test('downloads nothing while the block holds', async () => {
      const { executor, deps, rows } = await setupBlocked();

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(rows.map((row) => row.status)).toEqual(['pending', 'pending']);
    });

    test('tries one waiting grab after an hour, without a second notification', async () => {
      const { executor, deps, rows, clock } = await setupBlocked({ others: [otherGrab(), grab({ id: THIRD_GRAB_ID })] });

      clock.time = minutesAfter(60);
      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(deps.downloader.mock.calls[0][0]).toMatchObject({
        urls: [`https://www.youtube.com/watch?v=${OTHER_YOUTUBE_ID}`], quietBlockedFailure: true,
      });
      expect(rows.map((row) => row.status)).toEqual(['pending', 'queued', 'pending']);
    });

    test('queues no second try while one is downloading', async () => {
      const { executor, deps, clock } = await setupBlocked({ others: [otherGrab(), grab({ id: THIRD_GRAB_ID })] });
      clock.time = minutesAfter(60);
      await executor.runOnce();

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
    });

    test('lets the next waiting grab follow once a try got through', async () => {
      const { executor, deps, rows, clock, jobs } = await setupBlocked();
      clock.time = minutesAfter(60);
      await executor.runOnce();
      deps.models.Video.findOne.mockImplementation(async ({ where }) => (
        where.youtubeId === OTHER_YOUTUBE_ID ? { ...downloadedVideo, youtubeId: OTHER_YOUTUBE_ID } : null
      ));
      jobs[OTHER_JOB_ID] = endedJob();
      await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

      await executor.runOnce();

      expect(rows[1].status).toBe('completed');
      expect(deps.downloader).toHaveBeenCalledTimes(2);
      expect(deps.downloader.mock.calls[1][0]).toMatchObject({
        urls: [`https://www.youtube.com/watch?v=${YOUTUBE_ID}`], quietBlockedFailure: true,
      });
    });

    test('wakes the sweep when a job ends while grabs wait their turn', async () => {
      const { deps } = await setupBlocked();

      expect(deps.scheduleWake).toHaveBeenCalledTimes(1);
    });

    test('holds a try back another hour when it is blocked too', async () => {
      const { executor, deps, clock, jobs } = await setupBlocked();
      clock.time = minutesAfter(60);
      await executor.runOnce();
      jobs[OTHER_JOB_ID] = endedJob({
        failedVideos: [{ youtubeId: OTHER_YOUTUBE_ID, error: 'HTTP Error 403', diagnosisKey: 'http-403-cookies-disabled' }],
      }, 'Error');
      await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

      clock.time = minutesAfter(119);
      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(executor.blockStatus()).toEqual({ active: true, nextTryAt: minutesAfter(120) });
    });

    test('stages a waiting grab whose video was downloaded meanwhile, block or not', async () => {
      const { executor, deps, rows, state } = await setupBlocked();
      state.video = downloadedVideo;

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(rows.map((row) => row.status)).toEqual(['completed', 'completed']);
    });

    test('keeps the block when a waiting grab is staged from a file that was already in the library', async () => {
      const { executor, deps, rows } = await setupBlocked({ others: [otherGrab(), grab({ id: THIRD_GRAB_ID })] });
      deps.models.Video.findOne.mockImplementation(async ({ where }) => (
        where.youtubeId === OTHER_YOUTUBE_ID ? { ...downloadedVideo, youtubeId: OTHER_YOUTUBE_ID } : null
      ));
      await executor.runOnce();

      await executor.runOnce();

      expect(rows.map((row) => row.status)).toEqual(['pending', 'completed', 'pending']);
      expect(deps.downloader).not.toHaveBeenCalled();
      expect(executor.blockStatus()).toEqual({ active: true, nextTryAt: minutesAfter(60) });
    });

    test('tries at once when the cookies changed', async () => {
      const { executor, deps } = await setupBlocked();
      deps.getCookieKey.mockReturnValue('cookie-key-2');

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
    });

    test('tries one grab, not all of them, after a restart', async () => {
      const { executor, deps } = setup({
        rows: [
          grab({ blocked_at: minutesAgo(30) }),
          otherGrab({ blocked_at: minutesAgo(30) }),
          grab({ id: THIRD_GRAB_ID }),
        ],
      });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
    });

    test('keeps the other grabs held for the hour when the blocked grab was removed', async () => {
      const { executor, deps, rows } = await setupBlocked();
      rows[0].status = 'removed';

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
    });

    describe('when the blocked grab has left the queue', () => {
      const held = () => [otherGrab(), grab({ id: THIRD_GRAB_ID, youtube_id: 'ccccccccccc' })];

      test('still tries one of the held grabs first, not all of them', async () => {
        const { executor, deps, rows, clock } = await setupBlocked({ others: held() });
        rows[0].status = 'removed';

        clock.time = minutesAfter(60);
        await executor.runOnce();

        expect(deps.downloader).toHaveBeenCalledTimes(1);
        expect(rows.map((row) => row.status)).toEqual(['removed', 'queued', 'pending']);
      });

      test('lets that try notify if it is blocked: nothing that waits was told about a block', async () => {
        const { executor, deps, rows, clock } = await setupBlocked({ others: held() });
        rows[0].status = 'removed';

        clock.time = minutesAfter(60);
        await executor.runOnce();

        expect(deps.downloader.mock.calls[0][0]).not.toHaveProperty('quietBlockedFailure');
      });

      test('goes back to ordinary downloads once that try got through', async () => {
        const { executor, deps, rows, clock, jobs } = await setupBlocked({ others: held() });
        rows[0].status = 'removed';
        clock.time = minutesAfter(60);
        await executor.runOnce();
        deps.models.Video.findOne.mockImplementation(async ({ where }) => (
          where.youtubeId === OTHER_YOUTUBE_ID ? { ...downloadedVideo, youtubeId: OTHER_YOUTUBE_ID } : null
        ));
        jobs[OTHER_JOB_ID] = endedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        await executor.runOnce();

        expect(rows.map((row) => row.status)).toEqual(['removed', 'completed', 'queued']);
        expect(deps.downloader.mock.calls[1][0]).not.toHaveProperty('quietBlockedFailure');
        expect(executor.blockStatus()).toEqual({ active: false, nextTryAt: null });
      });

      test('forgets the block a day after the last blocked download', async () => {
        const { executor, deps, rows, clock } = await setupBlocked({ others: [] });
        rows[0].status = 'removed';
        clock.time = minutesAfter(24 * 60);
        rows.push(...held());

        await executor.runOnce();

        expect(deps.downloader).toHaveBeenCalledTimes(2);
        expect(deps.downloader.mock.calls[0][0]).not.toHaveProperty('quietBlockedFailure');
      });
    });

    test('gives the try to a grab that was never blocked before one that was', async () => {
      const { executor, deps } = setup({
        rows: [
          grab({ blocked_at: minutesAgo(90), updated_at: minutesAgo(90) }),
          otherGrab({ updated_at: minutesAgo(1) }),
        ],
      });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(deps.downloader.mock.calls[0][0].urls).toEqual([`https://www.youtube.com/watch?v=${OTHER_YOUTUBE_ID}`]);
    });

    test('gives the try to the next grab when the first one cannot be checked', async () => {
      const unreadable = '/data/NBC/unreadable.mkv';
      const { executor, deps, rows } = setup({
        rows: [
          grab({ blocked_at: minutesAgo(90), updated_at: minutesAgo(90) }),
          otherGrab({ blocked_at: minutesAgo(80), updated_at: minutesAgo(80) }),
        ],
      });
      deps.models.Video.findOne.mockImplementation(async ({ where }) => (
        where.youtubeId === YOUTUBE_ID ? { youtubeId: YOUTUBE_ID, filePath: unreadable, audioFilePath: null } : null
      ));
      deps.fileState.mockImplementation(async (filePath) => (filePath === unreadable ? 'unknown' : 'missing'));

      await executor.runOnce();
      expect(deps.downloader).not.toHaveBeenCalled();
      expect(deps.scheduleWake).toHaveBeenCalledTimes(1);

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows.map((row) => row.status)).toEqual(['pending', 'queued']);
    });

    test('offers the try to the first grab again once every waiting grab passed it on', async () => {
      const unreadable = '/data/NBC/unreadable.mkv';
      const { executor, deps, state } = setup({
        rows: [
          grab({ blocked_at: minutesAgo(90), updated_at: minutesAgo(90) }),
          otherGrab({ blocked_at: minutesAgo(80), updated_at: minutesAgo(80) }),
        ],
        video: { youtubeId: YOUTUBE_ID, filePath: unreadable, audioFilePath: null },
      });
      deps.fileState.mockResolvedValue('unknown');
      await executor.runOnce();
      await executor.runOnce();
      await executor.runOnce();
      expect(deps.downloader).not.toHaveBeenCalled();

      state.video = null;
      deps.fileState.mockResolvedValue('missing');
      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(deps.downloader.mock.calls[0][0].urls).toEqual([`https://www.youtube.com/watch?v=${YOUTUBE_ID}`]);
    });

    test('does not wait for a slow disk: the sweep ends while a waiting grab is still being checked', async () => {
      let release;
      const { executor, deps } = setup({
        rows: [grab({ blocked_at: minutesAgo(90) })],
        video: { youtubeId: YOUTUBE_ID, filePath: '/data/NBC/slow.mkv', audioFilePath: null },
      });
      deps.fileState.mockReturnValue(new Promise((resolve) => {
        release = resolve;
      }));
      executor.start();

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(deps.settleLibraryCopies).toHaveBeenCalledTimes(1);
      executor.stop();
      release('missing');
    });

    test('gives the try to the next grab when the first one is staged from the library', async () => {
      const { executor, deps, rows } = setup({
        rows: [
          grab({ blocked_at: minutesAgo(90), updated_at: minutesAgo(90) }),
          otherGrab({ blocked_at: minutesAgo(80), updated_at: minutesAgo(80) }),
        ],
      });
      deps.models.Video.findOne.mockImplementation(async ({ where }) => (
        where.youtubeId === YOUTUBE_ID ? downloadedVideo : null
      ));

      await executor.runOnce();
      await executor.runOnce();

      expect(rows.map((row) => row.status)).toEqual(['completed', 'queued']);
    });

    describe('a grab that waited its turn for a day while downloads got through', () => {
      const THIRD_YOUTUBE_ID = 'ccccccccccc';
      const blockedThird = () => endedJob({
        failedVideos: [{ youtubeId: THIRD_YOUTUBE_ID, error: 'HTTP Error 403', diagnosisKey: 'http-403-cookies-disabled' }],
      }, 'Error');

      // The first grab was blocked almost a day ago. Another grab then got
      // through, and a third one is blocked 40 minutes later.
      async function setupOvertaken() {
        const context = await setupBlocked({
          others: [otherGrab(), grab({ id: THIRD_GRAB_ID, youtube_id: THIRD_YOUTUBE_ID })],
        });
        const { executor, deps, rows, clock, jobs } = context;
        const longAgo = minutesAgo(23 * 60 + 30);
        Object.assign(rows[0], { blocked_at: longAgo, updated_at: longAgo });
        await executor.retryNow(OTHER_GRAB_ID);
        deps.models.Video.findOne.mockImplementation(async ({ where }) => (
          where.youtubeId === OTHER_YOUTUBE_ID ? { ...downloadedVideo, youtubeId: OTHER_YOUTUBE_ID } : null
        ));
        jobs[OTHER_JOB_ID] = endedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });
        await executor.runOnce();
        clock.time = minutesAfter(40);
        jobs[OTHER_JOB_ID] = blockedThird();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });
        return context;
      }

      test('is not failed by the sweep, although its first block is over a day old', async () => {
        const { executor, rows, clock } = await setupOvertaken();
        expect(rows.map((row) => row.status)).toEqual(['pending', 'completed', 'pending']);

        clock.time = minutesAfter(45);
        await executor.runOnce();

        expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null });
      });

      test('still fails when its own next try is blocked', async () => {
        const { executor, rows, clock, jobs } = await setupOvertaken();
        clock.time = minutesAfter(45);
        await executor.retryNow(GRAB_ID);
        jobs[OTHER_JOB_ID] = blockedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        expect(rows[0]).toMatchObject({ status: 'failed', fail_message: STILL_BLOCKED });
      });
    });

    test('opens no try while downloads are paused', async () => {
      const { executor, deps, clock } = await setupBlocked();
      deps.isPaused.mockReturnValue(true);

      clock.time = minutesAfter(60);
      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
    });

    describe('a retry that downloaded but could not be staged', () => {
      async function setupUnstaged({ firstBlockedAt = NOW } = {}) {
        const context = await setupBlocked();
        context.rows[0].blocked_at = firstBlockedAt;
        await context.executor.retryNow(GRAB_ID);
        context.deps.models.Video.findOne.mockImplementation(async ({ where }) => (
          where.youtubeId === YOUTUBE_ID ? downloadedVideo : null
        ));
        context.deps.staging.stage.mockRejectedValue(Object.assign(new Error('full'), { code: 'ENOSPC' }));
        context.jobs[OTHER_JOB_ID] = endedJob();
        await context.executor.handleJobEnded({ jobId: OTHER_JOB_ID });
        return context;
      }

      test('no longer counts as blocked', async () => {
        const { rows } = await setupUnstaged();

        expect(rows[0]).toMatchObject({ status: 'pending', blocked_at: null, fail_message: null });
      });

      test('ends the block for the other grabs, since its download got through', async () => {
        const { executor, rows } = await setupUnstaged();

        await executor.runOnce();

        expect(rows[1].status).toBe('queued');
      });

      test('is not failed as blocked for a day when another grab is blocked later', async () => {
        const { executor, rows, clock, jobs } = await setupUnstaged({ firstBlockedAt: minutesAgo(23 * 60 + 30) });
        await executor.runOnce();
        clock.time = minutesAfter(40);
        jobs[OTHER_JOB_ID] = endedJob({
          failedVideos: [{ youtubeId: OTHER_YOUTUBE_ID, error: 'HTTP Error 403', diagnosisKey: 'http-403-cookies-disabled' }],
        }, 'Error');
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        clock.time = minutesAfter(45);
        await executor.runOnce();

        expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null });
        expect(rows[1]).toMatchObject({ status: 'pending', blocked_at: minutesAfter(40) });
      });
    });

    test('stops counting a waiting grab as blocked when its video is in the library but cannot be staged', async () => {
      const { executor, deps, rows, state } = await setupBlocked();
      state.video = downloadedVideo;
      deps.staging.stage.mockRejectedValue(Object.assign(new Error('full'), { code: 'ENOSPC' }));

      await executor.runOnce();

      expect(rows[0]).toMatchObject({ status: 'pending', blocked_at: null, fail_message: null });
    });

    test('fails a waiting grab a day after its first block, while the block holds', async () => {
      const { executor, rows, clock } = await setupBlocked({
        others: [otherGrab({ blocked_at: minutesAgo(24 * 60 - 10) })],
      });

      clock.time = minutesAfter(20);
      await executor.runOnce();

      expect(rows[1]).toMatchObject({ status: 'failed', fail_message: STILL_BLOCKED, completed_at: minutesAfter(20) });
      expect(rows[0].status).toBe('pending');
    });

    test('tries a grab blocked long ago instead of failing it when a try is due', async () => {
      const { executor, deps, rows } = setup({ rows: [grab({ blocked_at: daysAgo(2) })] });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledTimes(1);
      expect(rows[0]).toMatchObject({ status: 'queued', fail_message: null });
    });

    test('silences the jobs of grabs that were queued before the block was known', async () => {
      const jobs = {
        [JOB_ID]: blockedJob(),
        [OTHER_JOB_ID]: { jobType: ARR_BRIDGE_JOB_LABEL, status: 'Pending', data: { urls: [] } },
      };
      const { executor } = setup({
        rows: [queued(), otherGrab({ status: 'queued', job_id: OTHER_JOB_ID })], jobs,
      });

      await executor.handleJobEnded({ jobId: JOB_ID });

      expect(jobs[OTHER_JOB_ID].data.quietBlockedFailure).toBe(true);
    });

    test('reports no block before one happened', () => {
      const { executor } = setup();

      expect(executor.blockStatus()).toEqual({ active: false, nextTryAt: null });
    });

    test('reports the block and its next try', async () => {
      const { executor } = await setupBlocked();

      expect(executor.blockStatus()).toEqual({ active: true, nextTryAt: minutesAfter(60) });
    });

    describe('Try again', () => {
      test('queues a held grab at once, quietly', async () => {
        const { executor, deps, rows } = await setupBlocked();

        const result = await executor.retryNow(GRAB_ID);

        expect(result).toBe('queued');
        expect(deps.downloader).toHaveBeenCalledTimes(1);
        expect(deps.downloader.mock.calls[0][0]).toMatchObject({
          urls: [`https://www.youtube.com/watch?v=${YOUTUBE_ID}`], quietBlockedFailure: true,
        });
        expect(rows.map((row) => row.status)).toEqual(['queued', 'pending']);
      });

      test('says the download started when no other download is running', async () => {
        const { executor, jobs } = await setupBlocked();
        jobs[OTHER_JOB_ID] = { jobType: ARR_BRIDGE_JOB_LABEL, status: 'In Progress', data: {} };

        await expect(executor.retryNow(GRAB_ID)).resolves.toBe('started');
      });

      test('releases the other waiting grabs when the try gets through, without waiting out the hour', async () => {
        const { executor, deps, rows, jobs } = await setupBlocked();
        await executor.retryNow(GRAB_ID);
        deps.models.Video.findOne.mockImplementation(async ({ where }) => (
          where.youtubeId === YOUTUBE_ID ? downloadedVideo : null
        ));
        jobs[OTHER_JOB_ID] = endedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        await executor.runOnce();

        expect(rows.map((row) => row.status)).toEqual(['completed', 'queued']);
        expect(deps.downloader.mock.calls[1][0]).toMatchObject({
          urls: [`https://www.youtube.com/watch?v=${OTHER_YOUTUBE_ID}`],
        });
        expect(executor.blockStatus()).toEqual({ active: false, nextTryAt: null });
      });

      test('leaves the other waiting grabs held', async () => {
        const { executor, deps } = await setupBlocked();
        await executor.retryNow(GRAB_ID);

        await executor.runOnce();

        expect(deps.downloader).toHaveBeenCalledTimes(1);
      });

      test('says downloads are paused and starts the grab when they resume', async () => {
        const { executor, deps, rows } = await setupBlocked();
        deps.isPaused.mockReturnValue(true);
        deps.downloader.mockRejectedValueOnce(Object.assign(new Error('paused'), { code: 'DOWNLOADS_PAUSED' }));

        const result = await executor.retryNow(GRAB_ID);
        expect(result).toBe('paused');
        expect(rows[0]).toMatchObject({ status: 'pending', fail_message: null });

        await executor.runOnce();
        expect(rows.map((row) => row.status)).toEqual(['queued', 'pending']);
      });

      test('says the try is put off when another job is downloading the video', async () => {
        const { executor, deps, rows } = await setupBlocked();
        deps.downloader.mockResolvedValueOnce({ queued: 0, acceptedIds: [], alreadyActiveIds: [YOUTUBE_ID] });

        await expect(executor.retryNow(GRAB_ID)).resolves.toBe('deferred');
        expect(rows[0].status).toBe('pending');
      });

      test('keeps the request while downloads are paused', async () => {
        const { executor, deps } = await setupBlocked();
        deps.downloader.mockRejectedValueOnce(Object.assign(new Error('paused'), { code: 'DOWNLOADS_PAUSED' }));

        await executor.retryNow(GRAB_ID);

        expect(executor.isRetryRequested(GRAB_ID)).toBe(true);
        expect(executor.isRetryRequested(OTHER_GRAB_ID)).toBe(false);
      });

      test('drops the request once the try was queued and blocked again', async () => {
        const { executor, jobs } = await setupBlocked();
        await executor.retryNow(GRAB_ID);
        jobs[OTHER_JOB_ID] = blockedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        expect(executor.isRetryRequested(GRAB_ID)).toBe(false);
      });

      describe('on a grab whose library file cannot be checked', () => {
        async function setupUnreadable() {
          const context = await setupBlocked();
          context.deps.models.Video.findOne.mockImplementation(async ({ where }) => (
            where.youtubeId === YOUTUBE_ID
              ? { youtubeId: YOUTUBE_ID, filePath: '/data/NBC/unreadable.mkv', audioFilePath: null }
              : null
          ));
          context.deps.fileState.mockImplementation(async (filePath) => (
            filePath === '/data/NBC/unreadable.mkv' ? 'unknown' : 'missing'
          ));
          return context;
        }

        test('says the try is put off and drops the request', async () => {
          const { executor } = await setupUnreadable();

          await expect(executor.retryNow(GRAB_ID)).resolves.toBe('deferred');
          expect(executor.isRetryRequested(GRAB_ID)).toBe(false);
        });

        test('does not keep the other waiting grabs from being tried', async () => {
          const { executor, deps, rows, clock } = await setupUnreadable();
          await executor.retryNow(GRAB_ID);

          clock.time = minutesAfter(60);
          await executor.runOnce();

          expect(deps.downloader).toHaveBeenCalledTimes(1);
          expect(rows.map((row) => row.status)).toEqual(['pending', 'queued']);
        });
      });

      test('stages the video when it is in the library by now', async () => {
        const { executor, deps, rows, state } = await setupBlocked();
        state.video = downloadedVideo;

        await expect(executor.retryNow(GRAB_ID)).resolves.toBe('ready');
        expect(deps.downloader).not.toHaveBeenCalled();
        expect(rows[0].status).toBe('completed');
      });

      test('goes back to waiting, an hour on, when the try is blocked again', async () => {
        const { executor, deps, rows, clock, jobs } = await setupBlocked();
        clock.time = minutesAfter(10);
        await executor.retryNow(GRAB_ID);
        jobs[OTHER_JOB_ID] = blockedJob();
        await executor.handleJobEnded({ jobId: OTHER_JOB_ID });

        clock.time = minutesAfter(65);
        await executor.runOnce();

        expect(rows[0]).toMatchObject({ status: 'pending', blocked_at: NOW });
        expect(deps.downloader).toHaveBeenCalledTimes(1);
        expect(executor.blockStatus().nextTryAt).toEqual(minutesAfter(70));
      });

      test.each([
        ['a removed grab', 'removed'],
        ['a grab that is downloading', 'queued'],
        ['a finished grab', 'completed'],
      ])('does nothing for %s', async (_name, status) => {
        const { executor, deps, rows } = setup({ rows: [grab({ status, job_id: JOB_ID })] });

        await expect(executor.retryNow(GRAB_ID)).resolves.toBeNull();
        expect(deps.downloader).not.toHaveBeenCalled();
        expect(rows[0].status).toBe(status);
      });

      test('does nothing for a grab it does not know', async () => {
        const { executor, deps } = setup();

        await expect(executor.retryNow(GRAB_ID)).resolves.toBeNull();
        expect(deps.downloader).not.toHaveBeenCalled();
      });
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
