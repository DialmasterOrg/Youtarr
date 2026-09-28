jest.mock('../../jobModule', () => ({ getJob: jest.fn() }));
jest.mock('../../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../../notificationModule', () => ({
  sendDownloadNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const jobModule = require('../../jobModule');
const MessageEmitter = require('../../messageEmitter');
const notificationModule = require('../../notificationModule');
const tracker = require('../downloadRunTracker');

const emittedSummary = () => {
  const call = MessageEmitter.emitMessage.mock.calls.find((c) => c[3] === 'downloadProgress');
  return call ? call[4] : null;
};

describe('downloadRunTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: unknown jobs are given up on at once (counted as a job that
    // ended without reporting).
    jobModule.getJob.mockReturnValue(undefined);
  });

  describe('startRun / isActive', () => {
    test('startRun returns a unique active run id', () => {
      const a = tracker.startRun();
      const b = tracker.startRun();
      expect(a).not.toBe(b);
      expect(tracker.isActive(a)).toBe(true);
      expect(tracker.isActive(b)).toBe(true);
    });

    test('isActive is false for missing or unknown ids', () => {
      expect(tracker.isActive(null)).toBe(false);
      expect(tracker.isActive(undefined)).toBe(false);
      expect(tracker.isActive('run-does-not-exist')).toBe(false);
    });
  });

  describe('recordJobResult', () => {
    test('returns false for an unknown run and does not emit', () => {
      expect(tracker.recordJobResult('run-missing', 'j1', { totalDownloaded: 2 })).toBe(false);
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });

    test('returns true for an active run (caller should suppress its own emit)', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      expect(tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1 })).toBe(true);
    });
  });

  describe('getUnfinishedJobs', () => {
    const liveStatuses = (statuses) => {
      jobModule.getJob.mockImplementation((id) => (statuses[id] ? { status: statuses[id] } : undefined));
    };

    test('returns an empty list for an unknown run', () => {
      expect(tracker.getUnfinishedJobs('run-does-not-exist')).toEqual([]);
    });

    test('lists registered jobs that have not reported, with their live status', () => {
      liveStatuses({ channel: 'Complete', pl1: 'Pending' });
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'channel');
      tracker.registerJob(runId, 'pl1');
      tracker.recordJobResult(runId, 'channel', { totalDownloaded: 1 });

      expect(tracker.getUnfinishedJobs(runId)).toEqual([{ id: 'pl1', status: 'Pending' }]);
    });

    test.each(['Complete', 'Error', 'Terminated', 'Killed'])('leaves out a job whose live status is %s', (status) => {
      liveStatuses({ j1: status });
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');

      expect(tracker.getUnfinishedJobs(runId)).toEqual([]);
    });

    test('leaves out a job that no longer exists', () => {
      liveStatuses({});
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'gone');

      expect(tracker.getUnfinishedJobs(runId)).toEqual([]);
    });

    test('lists only the retry once its source job reaches a terminal status unreported', () => {
      const statuses = { source: 'In Progress', 'retry-1': 'Pending' };
      liveStatuses(statuses);
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'source');
      tracker.seal(runId);
      tracker.registerJob(runId, 'retry-1');
      statuses.source = 'Complete';

      expect(tracker.getUnfinishedJobs(runId)).toEqual([{ id: 'retry-1', status: 'Pending' }]);
    });

    test('keeps the run active while a retry is unfinished after the source reports', () => {
      const statuses = { source: 'In Progress', 'retry-1': 'Pending' };
      liveStatuses(statuses);
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'source');
      tracker.seal(runId);
      tracker.registerJob(runId, 'retry-1');
      statuses.source = 'Complete';
      tracker.recordJobResult(runId, 'source', { totalDownloaded: 1 });

      expect(tracker.isActive(runId)).toBe(true);
    });

    test('returns an empty list once the last job reports and the run finalizes', () => {
      liveStatuses({ j1: 'In Progress' });
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.seal(runId);
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1 });

      expect(tracker.getUnfinishedJobs(runId)).toEqual([]);
    });
  });

  describe('onRunFinished / getTotals', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('tells a listener when the run finishes, with its end time and counts', () => {
      const runId = tracker.startRun();
      const listener = jest.fn();
      tracker.onRunFinished(runId, listener);
      tracker.registerJob(runId, 'job-1');
      jobModule.getJob.mockReturnValue({ status: 'In Progress' });
      tracker.seal(runId);
      expect(listener).not.toHaveBeenCalled();
      tracker.recordJobResult(runId, 'job-1', { totalDownloaded: 3, totalSkipped: 6, totalFailed: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
      const [{ finishedAt, totals }] = listener.mock.calls[0];
      expect(finishedAt).toBeInstanceOf(Date);
      expect(totals).toMatchObject({ totalDownloaded: 3, totalSkipped: 6, totalFailed: 2, jobCount: 1 });
    });

    test('remembers a run that finished before anyone listened, including one with no jobs', async () => {
      const runId = tracker.startRun();
      tracker.seal(runId);
      const listener = jest.fn();
      tracker.onRunFinished(runId, listener);
      await flush();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ totals: expect.objectContaining({ jobCount: 0 }) }));
    });

    test('stops calling a listener after it unsubscribes', () => {
      const runId = tracker.startRun();
      const listener = jest.fn();
      const unsubscribe = tracker.onRunFinished(runId, listener);
      unsubscribe();
      tracker.seal(runId);
      expect(listener).not.toHaveBeenCalled();
    });

    test('never calls a listener for an unknown run', async () => {
      const listener = jest.fn();
      tracker.onRunFinished('run-unknown', listener);
      await flush();
      expect(listener).not.toHaveBeenCalled();
    });

    test('forgets the oldest finished runs beyond the cap', () => {
      const first = tracker.startRun();
      tracker.seal(first);
      for (let i = 0; i < 20; i += 1) tracker.seal(tracker.startRun());
      expect(tracker.getTotals(first)).toBeNull();
    });

    test('reports counts so far for a run still in progress', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'job-2');
      jobModule.getJob.mockImplementation((id) => (id === 'job-2' ? { status: 'In Progress' } : undefined));
      const jobIssue = { status: 'Failed', reason: 'No valid channel URLs', byUser: false };
      tracker.recordJobResult(runId, 'job-1', { totalDownloaded: 1, jobIssue });
      expect(tracker.getTotals(runId)).toMatchObject({ totalDownloaded: 1, jobCount: 2, jobIssues: [jobIssue] });
    });

    test('treats a Failed job as finished', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'job-1');
      jobModule.getJob.mockReturnValue({ status: 'Failed' });
      expect(tracker.getUnfinishedJobs(runId)).toEqual([]);
    });
  });

  describe('job issues', () => {
    const failedToStart = { status: 'Failed', reason: 'No valid channel URLs to download.', byUser: false };

    const runWithIssue = (jobIssue) => {
      const runId = tracker.startRun();
      tracker.recordJobResult(runId, 'job-1', { jobType: 'Channel Downloads', jobIssue });
      tracker.seal(runId);
      return runId;
    };

    test('a job that failed before downloading makes the summary a warning that names the reason', () => {
      runWithIssue(failedToStart);
      const payload = emittedSummary();
      expect(payload.warning).toBe(true);
      expect(payload.progress.state).toBe('warning');
      expect(payload.text).toBe('Download finished with problems: a download job failed (No valid channel URLs to download)');
      expect(payload.finalSummary.jobIssues).toEqual([failedToStart]);
    });

    test('a failed job sends a notification even when nothing downloaded', () => {
      runWithIssue(failedToStart);
      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledTimes(1);
    });

    test('a job the user terminated does not notify on its own', () => {
      runWithIssue({ status: 'Terminated', reason: 'User requested termination', byUser: true });
      expect(emittedSummary().text).toBe('Download finished with problems: a download job was terminated (User requested termination)');
      expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
    });

    test('counts a queued job abandoned before it started', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'job-1');
      jobModule.getJob.mockReturnValue({ status: 'Pending' });
      tracker.seal(runId);
      jobModule.getJob.mockReturnValue({ status: 'Error' });
      tracker.handleAbandonedJob({ jobId: 'job-1', runId, reason: 'Job could not be started: boom' });
      expect(tracker.getFinishedRun(runId).totals.jobIssues).toEqual([
        { status: 'Error', reason: 'Job could not be started: boom', byUser: false },
      ]);
    });

    test('ignores an abandoned job outside any run', () => {
      expect(() => tracker.handleAbandonedJob({ jobId: 'job-1', runId: null, reason: 'x' })).not.toThrow();
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
    });
  });

  describe('a failure retried successfully', () => {
    test('leaves the sweep with no failure once the retry downloads the video', () => {
      const { toRunRecord } = require('../../channel/sweepRunSummary');
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'original');
      tracker.registerJob(runId, 'retry');
      jobModule.getJob.mockReturnValue({ status: 'Pending' });
      tracker.seal(runId);

      // The original job handed its only failure to the retry, so it reports
      // no failed videos and no job issue.
      tracker.recordJobResult(runId, 'original', { totalFailed: 0, jobType: 'Channel Downloads' });
      expect(tracker.isActive(runId)).toBe(true);
      tracker.recordJobResult(runId, 'retry', { totalDownloaded: 1, jobType: 'Channel Downloads' });

      const { totals } = tracker.getFinishedRun(runId);
      expect(totals).toMatchObject({ totalDownloaded: 1, totalFailed: 0, jobIssues: [] });
      expect(toRunRecord({ sweep: { endedBy: 'finished', finishedAt: new Date(), totals } }))
        .toMatchObject({ status: 'success', outcome: 'completed', message: '1 video downloaded.' });
    });
  });

  describe('jobs that end before they report', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Live job statuses, as jobModule holds them; unknown ids are no job.
    let statuses;
    const setStatus = (jobId, status) => { statuses[jobId] = status; };

    beforeEach(() => {
      statuses = {};
      jobModule.getJob.mockImplementation((id) => (id in statuses ? { status: statuses[id] } : undefined));
    });

    // The job's status turns final (jobModule.onJobEnded) while its videos
    // are still being reloaded, then the finalizer reports its totals.
    const endJob = (jobId, status = 'Complete') => {
      setStatus(jobId, status);
      tracker.handleJobEnded({ jobId });
    };

    test('sealing while a finished job is still reporting waits for its results', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'channel-job');
      endJob('channel-job');
      const listener = jest.fn();
      tracker.onRunFinished(runId, listener);

      tracker.seal(runId);
      expect(tracker.isActive(runId)).toBe(true);
      expect(listener).not.toHaveBeenCalled();

      tracker.recordJobResult(runId, 'channel-job', { totalDownloaded: 3, totalSkipped: 6, jobType: 'Channel Downloads' });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        totals: expect.objectContaining({ totalDownloaded: 3, totalSkipped: 6, jobIssues: [] }),
      }));
    });

    test('lists unreported jobs, saying which are still reporting', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'done');
      tracker.registerJob(runId, 'queued');
      jobModule.getJob.mockImplementation((id) => ({ status: id === 'done' ? 'Complete' : 'Pending' }));
      expect(tracker.getUnreportedJobs(runId)).toEqual([
        { id: 'done', status: 'Complete', reporting: true },
        { id: 'queued', status: 'Pending', reporting: false },
      ]);
    });

    test('gives up on a job that never reports, dated to when it ended', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'channel-job');
      const endedAt = Date.now();
      endJob('channel-job', 'Error');
      tracker.seal(runId);

      jest.advanceTimersByTime(tracker.REPORT_GRACE_MS - 1);
      expect(tracker.isActive(runId)).toBe(true);
      jest.advanceTimersByTime(1);

      const finished = tracker.getFinishedRun(runId);
      expect(finished.finishedAt).toEqual(new Date(endedAt));
      expect(finished.totals.jobIssues).toEqual([
        { status: 'Error', reason: 'A download job ended without reporting its results.', byUser: false },
      ]);
    });

    test('closes a manual download run whose last job ended without reporting', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'manual-1');
      tracker.registerJob(runId, 'manual-2');
      setStatus('manual-1', 'In Progress');
      setStatus('manual-2', 'Pending');
      tracker.seal(runId);
      expect(tracker.isActive(runId)).toBe(true);

      jest.advanceTimersByTime(1000);
      endJob('manual-1');
      tracker.recordJobResult(runId, 'manual-1', { totalDownloaded: 1, jobType: 'Manually Added Urls' });
      expect(tracker.isActive(runId)).toBe(true);

      setStatus('manual-2', 'In Progress');
      jest.advanceTimersByTime(1000);
      const endedAt = Date.now();
      endJob('manual-2', 'Error');
      expect(tracker.isActive(runId)).toBe(true);

      jest.advanceTimersByTime(tracker.REPORT_GRACE_MS - 1);
      expect(tracker.isActive(runId)).toBe(true);
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      const finished = tracker.getFinishedRun(runId);
      expect(finished.finishedAt).toEqual(new Date(endedAt));
      expect(finished.totals).toMatchObject({
        totalDownloaded: 1,
        jobIssues: [{ status: 'Error', reason: 'A download job ended without reporting its results.', byUser: false }],
      });
      expect(emittedSummary().warning).toBe(true);
    });

    test('keeps waiting on a queued job past the grace period', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'done');
      tracker.registerJob(runId, 'queued');
      jobModule.getJob.mockImplementation((id) => ({ status: id === 'done' ? 'Complete' : 'Pending' }));
      tracker.seal(runId);

      jest.advanceTimersByTime(2 * tracker.REPORT_GRACE_MS);

      expect(tracker.isActive(runId)).toBe(true);
    });

    test('gives up at once on a job no longer known', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'gone');
      jobModule.getJob.mockReturnValue(undefined);
      tracker.seal(runId);
      expect(tracker.getFinishedRun(runId).totals.jobIssues).toHaveLength(1);
    });
  });

  describe('aggregation and finalization', () => {
    test('does not finalize until the run is sealed', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.registerJob(runId, 'j2');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 2, jobType: 'Channel Downloads' });
      tracker.recordJobResult(runId, 'j2', { totalDownloaded: 3, jobType: 'Playlist: Foo' });

      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();

      tracker.seal(runId);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
      expect(emittedSummary().finalSummary.totalDownloaded).toBe(5);
    });

    test('sums totals from channel and playlist jobs into one summary', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'channel');
      tracker.registerJob(runId, 'pl1');
      tracker.recordJobResult(runId, 'channel', {
        totalDownloaded: 4,
        totalSkipped: 1,
        totalFailed: 0,
        videoData: [{ youtubeId: 'a' }, { youtubeId: 'b' }],
        jobType: 'Channel Downloads',
      });
      tracker.recordJobResult(runId, 'pl1', {
        totalDownloaded: 2,
        totalSkipped: 3,
        totalFailed: 1,
        failedVideos: [{ youtubeId: 'x' }],
        videoData: [{ youtubeId: 'c' }],
        jobType: 'Playlist: Creators',
      });
      tracker.seal(runId);

      const summary = emittedSummary().finalSummary;
      expect(summary.totalDownloaded).toBe(6);
      expect(summary.totalSkipped).toBe(4);
      expect(summary.totalFailed).toBe(1);
      expect(summary.failedVideos).toHaveLength(1);
    });

    test('merges diagnoses across jobs by key, summing counts', () => {
      const cookie403 = { key: 'http-403-cookies-enabled', title: 't', message: 'm', count: 1 };
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.registerJob(runId, 'j2');
      tracker.recordJobResult(runId, 'j1', {
        totalFailed: 1,
        failedVideos: [{ youtubeId: 'x' }],
        diagnoses: [cookie403],
        jobType: 'Channel Downloads',
      });
      tracker.recordJobResult(runId, 'j2', {
        totalFailed: 2,
        failedVideos: [{ youtubeId: 'y' }, { youtubeId: 'z' }],
        diagnoses: [
          { ...cookie403, count: 1 },
          { key: 'bot-check-cookies-disabled', title: 'bt', message: 'bm', count: 1 },
        ],
        jobType: 'Playlist: Foo',
      });
      tracker.seal(runId);

      const summary = emittedSummary().finalSummary;
      expect(summary.diagnoses).toHaveLength(2);
      expect(summary.diagnoses.find((d) => d.key === 'http-403-cookies-enabled').count).toBe(2);
      expect(summary.diagnoses.find((d) => d.key === 'bot-check-cookies-disabled').count).toBe(1);
    });

    test('emits an empty diagnoses list when no job reported any', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
      tracker.seal(runId);

      expect(emittedSummary().finalSummary.diagnoses).toEqual([]);
    });

    test('sends a notification for a failure-only run when diagnoses exist', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', {
        totalFailed: 1,
        failedVideos: [{ youtubeId: 'x' }],
        diagnoses: [{ key: 'http-403-cookies-enabled', title: 't', message: 'm', count: 1 }],
        jobType: 'Channel Downloads',
      });
      tracker.seal(runId);

      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledTimes(1);
    });

    test('stays silent for a failure-only run without diagnoses', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', {
        totalFailed: 1,
        failedVideos: [{ youtubeId: 'x' }],
        jobType: 'Channel Downloads',
      });
      tracker.seal(runId);

      expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
    });

    test('waits for every registered job to reach a terminal state', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.registerJob(runId, 'j2');
      // j2 has not reported and is still running.
      jobModule.getJob.mockImplementation((id) => (id === 'j2' ? { status: 'In Progress' } : undefined));

      tracker.seal(runId);
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();

      tracker.recordJobResult(runId, 'j2', { totalDownloaded: 1, jobType: 'Playlist: Foo' });
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
    });

    test('finalizes a sealed run whose remaining job ended without reporting once its grace runs out', () => {
      jest.useFakeTimers();
      try {
        const runId = tracker.startRun();
        tracker.registerJob(runId, 'j1');
        tracker.registerJob(runId, 'j2');
        jobModule.getJob.mockReturnValue({ status: 'Error', output: 'Job finalization error: db down' });

        tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
        tracker.seal(runId);
        expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();

        jest.advanceTimersByTime(tracker.REPORT_GRACE_MS);

        expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
        expect(emittedSummary().finalSummary.jobIssues).toEqual([
          { status: 'Error', reason: 'Job finalization error: db down', byUser: false },
        ]);
      } finally {
        jest.useRealTimers();
      }
    });

    test('emits nothing when the run had no jobs', () => {
      const runId = tracker.startRun();
      tracker.seal(runId);
      expect(MessageEmitter.emitMessage).not.toHaveBeenCalled();
      expect(tracker.isActive(runId)).toBe(false);
    });

    test('finalizes only once', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
      tracker.seal(runId);
      tracker.seal(runId);
      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
    });

    test('labels an all-manual run as Manual downloads', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'job-1');
      tracker.registerJob(runId, 'job-2');
      tracker.recordJobResult(runId, 'job-1', { jobType: 'Manually Added Urls', totalDownloaded: 1 });
      tracker.recordJobResult(runId, 'job-2', { jobType: 'Manually Added Urls', totalDownloaded: 2 });
      tracker.seal(runId);

      expect(emittedSummary().finalSummary.jobType).toBe('Manual downloads');
    });
  });

  describe('summary labelling', () => {
    const finalizeWith = (jobs) => {
      const runId = tracker.startRun();
      jobs.forEach((job, i) => {
        const id = `j${i}`;
        tracker.registerJob(runId, id);
        tracker.recordJobResult(runId, id, { totalDownloaded: 1, jobType: job });
      });
      tracker.seal(runId);
      return emittedSummary().finalSummary.jobType;
    };

    test('labels a channel-only run as a channel update', () => {
      expect(finalizeWith(['Channel Downloads'])).toBe('Channel Downloads');
    });

    test('labels a single-playlist run with the playlist label', () => {
      expect(finalizeWith(['Playlist: Creators'])).toBe('Playlist: Creators');
    });

    test('labels a multi-playlist run generically', () => {
      expect(finalizeWith(['Playlist: A', 'Playlist: B'])).toBe('Playlist downloads');
    });

    test('labels a mixed channel + playlist run', () => {
      expect(finalizeWith(['Channel Downloads', 'Playlist: A'])).toBe('Channel & playlist update');
    });

    test.each([
      [['Playlist Retry: A'], 'Playlist Retry: A'],
      [['Playlist: A', 'Playlist Retry: A'], 'Playlist downloads'],
      [['Channel Downloads', 'Playlist Retry: A'], 'Channel & playlist update'],
    ])('labels runs containing saved retries: %j', (jobs, expected) => {
      expect(finalizeWith(jobs)).toBe(expected);
    });
  });

  describe('warnings, dedupe, and notifications', () => {
    test('marks the summary as a warning when there are failures', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, totalFailed: 2, jobType: 'Channel Downloads' });
      tracker.seal(runId);

      const payload = emittedSummary();
      expect(payload.warning).toBe(true);
      expect(payload.progress.state).toBe('warning');
    });

    describe('a grouped channel job that stopped partway', () => {
      function runWithStoppedGroup() {
        const runId = tracker.startRun();
        tracker.registerJob(runId, 'j1');
        tracker.recordJobResult(runId, 'j1', {
          totalDownloaded: 3,
          jobType: 'Channel Downloads',
          stoppedGroup: { group: 'Group 2/3 (720p)', reason: 'Bot detection encountered', terminated: false },
        });
        tracker.seal(runId);
        return emittedSummary();
      }

      test('says the run stopped early, where, and why', () => {
        expect(runWithStoppedGroup().text).toBe(
          'Download stopped early: 3 videos downloaded, stopped at Group 2/3 (720p) (Bot detection encountered), later groups skipped'
        );
      });

      test('notifies even when nothing downloaded', () => {
        const runId = tracker.startRun();
        tracker.registerJob(runId, 'j1');
        tracker.recordJobResult(runId, 'j1', {
          totalDownloaded: 0,
          jobType: 'Channel Downloads',
          stoppedGroup: { group: 'Group 1/2 (1080p)', reason: 'Bot detection encountered', terminated: false },
        });
        tracker.seal(runId);

        expect(notificationModule.sendDownloadNotification).toHaveBeenCalled();
      });

      test('does not notify for a user termination alone', () => {
        const runId = tracker.startRun();
        tracker.registerJob(runId, 'j1');
        tracker.recordJobResult(runId, 'j1', {
          totalDownloaded: 0,
          jobType: 'Channel Downloads',
          stoppedGroup: { group: 'Group 1/2 (1080p)', reason: 'User requested termination', terminated: true },
        });
        tracker.seal(runId);

        expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
      });

      test('describes a termination as terminated', () => {
        const runId = tracker.startRun();
        tracker.registerJob(runId, 'j1');
        tracker.recordJobResult(runId, 'j1', {
          totalDownloaded: 1,
          jobType: 'Channel Downloads',
          stoppedGroup: { group: 'Group 1/2 (1080p)', reason: null, terminated: true },
        });
        tracker.seal(runId);

        expect(emittedSummary().text).toBe(
          'Download stopped early: 1 video downloaded, terminated in Group 1/2 (1080p), later groups skipped'
        );
      });

      test('marks the run as a warning even with no failed videos', () => {
        expect(runWithStoppedGroup().progress.state).toBe('warning');
      });

      test('lists the stopped group in the final summary', () => {
        expect(runWithStoppedGroup().finalSummary.stoppedGroups).toEqual([
          { group: 'Group 2/3 (720p)', reason: 'Bot detection encountered', terminated: false },
        ]);
      });
    });

    test('leaves stoppedGroups out of the final summary when every group finished', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
      tracker.seal(runId);

      expect(emittedSummary().finalSummary).not.toHaveProperty('stoppedGroups');
    });

    test('deduplicates terminated channels across jobs', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.registerJob(runId, 'j2');
      tracker.recordJobResult(runId, 'j1', {
        terminatedChannels: [{ channelId: 'A', uploader: 'Alpha' }],
        jobType: 'Channel Downloads',
      });
      tracker.recordJobResult(runId, 'j2', {
        terminatedChannels: [{ channelId: 'A', uploader: 'Alpha' }],
        jobType: 'Channel Downloads',
      });
      tracker.seal(runId);

      const summary = emittedSummary().finalSummary;
      expect(summary.terminatedChannels).toHaveLength(1);
      expect(summary.totalTerminatedChannels).toBe(1);
    });

    test('sends a single aggregated notification when videos were downloaded', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', {
        totalDownloaded: 3,
        videoData: [{ youtubeId: 'a' }],
        jobType: 'Channel Downloads',
      });
      tracker.seal(runId);

      expect(notificationModule.sendDownloadNotification).toHaveBeenCalledTimes(1);
      const arg = notificationModule.sendDownloadNotification.mock.calls[0][0];
      expect(arg.finalSummary.totalDownloaded).toBe(3);
    });

    test('does not notify when nothing was downloaded or terminated', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 0, totalSkipped: 5, jobType: 'Channel Downloads' });
      tracker.seal(runId);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
      expect(notificationModule.sendDownloadNotification).not.toHaveBeenCalled();
    });
  });
});
