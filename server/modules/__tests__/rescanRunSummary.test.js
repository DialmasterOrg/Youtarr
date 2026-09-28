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
        message: 'Scanned 8,421 videos: 12 updated, 3 marked missing.',
        details: {
          videosScanned: 8421,
          filesFoundOnDisk: 8423,
          unreadableOnDisk: 0,
          videosUpdated: 12,
          videosMarkedMissing: 3,
          videosKept: 0,
          videosSkipped: 0,
          videosFailed: 0,
        },
      });
    });

    test('reports rows skipped because they changed during the scan without treating the run as skipped', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 1, removed: 0, skippedChanged: 2 });
      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: 'Scanned 10 videos: 1 updated, 0 marked missing, 2 skipped (changed during the scan).',
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
        message: 'Scanned 10 videos: 0 updated, 0 marked missing.',
      }));
      expect(record.details.videosKept).toBe(4);
    });

    test('records a finished scan with failed row writes as a partial failure', () => {
      const record = toRunRecord({ status: 'completed', processed: 10, updated: 3, removed: 1, failed: 2 });
      expect(record).toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Scanned 10 videos: 3 updated, 1 marked missing, 2 failed.',
      }));
      expect(record.details.videosFailed).toBe(2);
    });

    test('keeps a timed-out scan continuable and names its failed writes', () => {
      const record = toRunRecord({ status: 'timed-out', timedOut: true, processed: 500, failed: 1 });
      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'timed-out',
        message: 'Reached the time limit after 500 videos (1 failed); continues at the next run.',
      }));
    });

    test('shows a partial scan as an error on the Maintenance page, with its message', () => {
      const run = {
        startedAt: '2026-09-27T03:30:00Z', finishedAt: '2026-09-27T03:31:00Z', trigger: 'scheduled',
        ...toRunRecord({ status: 'completed', processed: 10, updated: 3, removed: 1, failed: 2 }),
      };
      expect(fromRunRecord(run)).toEqual(expect.objectContaining({
        status: 'error',
        errorMessage: 'Scanned 10 videos: 3 updated, 1 marked missing, 2 failed.',
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
        errorMessage: null,
      });
    });

    test('reports an interrupted run as an error with its message', () => {
      expect(fromRunRecord({ ...run, status: 'interrupted', outcome: null, message: 'Interrupted by a restart.', details: null })).toEqual(
        expect.objectContaining({ status: 'error', errorMessage: 'Interrupted by a restart.', videosScanned: 0 })
      );
    });
  });
});
