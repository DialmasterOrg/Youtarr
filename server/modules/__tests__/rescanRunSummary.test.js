/* eslint-env jest */
const { TASK_KEY, toRunRecord, fromRunRecord } = require('../rescanRunSummary');

describe('rescanRunSummary', () => {
  test('targets the rescan schedule', () => {
    expect(TASK_KEY).toBe('videoRescanFrequency');
  });

  describe('toRunRecord', () => {
    test('summarizes a completed scan', () => {
      expect(toRunRecord({ status: 'completed', processed: 8421, filesOnDisk: 8423, updated: 12, removed: 3 })).toEqual({
        status: 'success',
        outcome: 'completed',
        message: 'Scanned 8,421 videos and found 8,423 video files on disk: 12 updated, 3 marked missing.',
        details: {
          videosScanned: 8421,
          filesFoundOnDisk: 8423,
          unreadableOnDisk: 0,
          videosUpdated: 12,
          videosMarkedMissing: 3,
          videosKept: 0,
          videosSkipped: 0,
          videosFailed: 0,
          videosNotMarkedMissing: 0,
          videosMissing: null,
          probesDeferred: 0,
        },
      });
    });

    test('says when the downloads folder check was skipped on request', () => {
      const record = toRunRecord({ status: 'completed', processed: 5, updated: 1, removed: 2, libraryCheckSkipped: true });
      expect(record.status).toBe('success');
      expect(record.message).toBe('Scanned 5 videos and found 0 video files on disk: 1 updated, 2 marked missing. The downloads folder check was skipped.');
      expect(record.details.libraryCheckSkipped).toBe(true);
    });

    test('records a scan that held back missing marks behind a library check as partial, naming the cause', () => {
      const record = toRunRecord({
        status: 'completed', processed: 10, updated: 1, removed: 0,
        notMarkedMissing: 2, libraryCheckMessage: 'The subfolder __Music is empty.',
      });
      expect(record).toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Scanned 10 videos and found 0 video files on disk: 1 updated, 0 marked missing, 2 not marked missing (The subfolder __Music is empty).',
      }));
      expect(record.details.videosNotMarkedMissing).toBe(2);
    });

    test('reports rows skipped because they changed during the scan without treating the run as skipped', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 1, removed: 0, skippedChanged: 2 });
      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: 'Scanned 10 videos and found 0 video files on disk: 1 updated, 0 marked missing, 2 skipped (changed during the scan).',
      }));
      expect(record.details).toEqual(expect.objectContaining({ videosSkipped: 2, videosFailed: 0 }));
    });

    test('records folders or files the walk could not read in the details', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 0, removed: 0, unreadableOnDisk: 3 });
      expect(record.outcome).toBe('completed');
      expect(record.details.unreadableOnDisk).toBe(3);
    });

    test('records rows left as recorded in the details only', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 0, removed: 0, kept: 4 });
      expect(record).toEqual(expect.objectContaining({
        outcome: 'completed',
        message: 'Scanned 10 videos and found 0 video files on disk: 0 updated, 0 marked missing.',
      }));
      expect(record.details.videosKept).toBe(4);
    });

    test('says how many videos are missing after the scan', () => {
      const record = toRunRecord({ status: 'completed', processed: 16801, filesOnDisk: 2, updated: 0, removed: 0, missing: 16800 });
      expect(record.message).toBe('Scanned 16,801 videos and found 2 video files on disk: 0 updated, 0 marked missing. 16,800 videos are missing.');
      expect(record.details.videosMissing).toBe(16800);
    });

    test('says how many resolutions are still to be checked when the probe budget ran out', () => {
      const record = toRunRecord({ status: 'completed', processed: 300, filesOnDisk: 300, updated: 100, removed: 0, probesDeferred: 200 });
      expect(record.outcome).toBe('completed');
      expect(record.message).toBe(
        'Scanned 300 videos and found 300 video files on disk: 100 updated, 0 marked missing. '
        + 'The resolution of 200 videos is still to be checked; that continues at the next run.'
      );
      expect(record.details.probesDeferred).toBe(200);
    });

    test('records a finished scan with failed row writes as a partial failure', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 3, removed: 1, failed: 2 });
      expect(record).toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Scanned 10 videos and found 0 video files on disk: 3 updated, 1 marked missing, 2 failed.',
      }));
      expect(record.details.videosFailed).toBe(2);
    });

    test('describes a timed-out scan from an older release as starting over, naming its failed writes', () => {
      const record = toRunRecord({ status: 'timed-out', timedOut: true, processed: 500, failed: 1 });
      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'timed-out',
        message: 'Stopped at the time limit after 500 videos (1 failed); the next run starts over.',
      }));
    });

    test('shows a partial scan as an error on the Maintenance page, with its message', () => {
      const run = {
        startedAt: '2026-09-27T03:30:00Z', finishedAt: '2026-09-27T03:31:00Z', trigger: 'scheduled',
        ...toRunRecord({ status: 'completed', processed: 10, updated: 3, removed: 1, failed: 2 }),
      };
      expect(fromRunRecord(run)).toEqual(expect.objectContaining({
        status: 'error',
        errorMessage: 'Scanned 10 videos and found 0 video files on disk: 3 updated, 1 marked missing, 2 failed.',
      }));
    });

    test('summarizes a scan that hit the time limit', () => {
      const record = toRunRecord({ status: 'timed-out', timedOut: true, processed: 500, updated: 4, removed: 0 });
      expect(record).toEqual(expect.objectContaining({ status: 'success', outcome: 'timed-out' }));
      expect(record.message).toMatch(/time limit/);
    });

    test('summarizes a failed scan', () => {
      expect(toRunRecord({ status: 'error', errorMessage: 'boom' })).toEqual(expect.objectContaining({
        status: 'error', outcome: 'error', message: 'boom',
      }));
    });

    test('treats a result without a status as completed', () => {
      expect(toRunRecord({ processed: 100 })).toEqual(expect.objectContaining({ outcome: 'completed' }));
    });

    test('reports a scan that was skipped because one was already running', () => {
      expect(toRunRecord({ skipped: true, reason: 'already-running' })).toEqual({
        status: 'skipped',
        outcome: 'skipped',
        message: 'A rescan was already running.',
        details: null,
      });
    });
  });

  describe('fromRunRecord', () => {
    const run = {
      taskKey: TASK_KEY, trigger: 'manual', status: 'success', outcome: 'completed',
      message: 'Scanned 5 videos: 1 updated, 0 marked missing.',
      details: { videosScanned: 5, filesFoundOnDisk: 5, videosUpdated: 1, videosMarkedMissing: 0 },
      startedAt: '2026-05-04T15:00:00.000Z', finishedAt: '2026-05-04T15:01:00.000Z',
    };

    test('rebuilds the maintenance page shape from a recorded run', () => {
      expect(fromRunRecord(run)).toEqual({
        startedAt: '2026-05-04T15:00:00.000Z',
        completedAt: '2026-05-04T15:01:00.000Z',
        trigger: 'manual',
        status: 'completed',
        videosUpdated: 1,
        videosMarkedMissing: 0,
        videosScanned: 5,
        filesFoundOnDisk: 5,
        videosNotMarkedMissing: 0,
        videosMissing: null,
        errorMessage: null,
      });
    });

    test('carries the missing count and the rows held back through to the maintenance page', () => {
      const heldRun = { ...run, details: { ...run.details, videosNotMarkedMissing: 16799, videosMissing: 1 } };
      expect(fromRunRecord(heldRun)).toEqual(expect.objectContaining({ videosNotMarkedMissing: 16799, videosMissing: 1 }));
    });

    test('carries a skipped downloads folder check through to the maintenance page', () => {
      const skippedRun = { ...run, details: { ...run.details, libraryCheckSkipped: true } };
      expect(fromRunRecord(skippedRun).libraryCheckSkipped).toBe(true);
    });

    test('reports an interrupted run as an error with its message', () => {
      expect(fromRunRecord({ ...run, status: 'interrupted', outcome: null, message: 'Interrupted by a restart.', details: null })).toEqual(
        expect.objectContaining({ status: 'error', errorMessage: 'Interrupted by a restart.', videosScanned: 0 })
      );
    });
  });
});
