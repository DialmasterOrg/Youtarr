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
    // Default: unknown jobs are treated as finished (terminal).
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

    test('finalizes a sealed run whose remaining jobs are already terminal but never reported', () => {
      const runId = tracker.startRun();
      tracker.registerJob(runId, 'j1');
      tracker.registerJob(runId, 'j2');
      jobModule.getJob.mockReturnValue({ status: 'Error' });

      tracker.recordJobResult(runId, 'j1', { totalDownloaded: 1, jobType: 'Channel Downloads' });
      tracker.seal(runId);

      expect(MessageEmitter.emitMessage).toHaveBeenCalledTimes(1);
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
