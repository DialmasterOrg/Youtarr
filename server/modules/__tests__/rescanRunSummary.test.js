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
        details: { videosScanned: 8421, filesFoundOnDisk: 8423, videosUpdated: 12, videosMarkedMissing: 3 },
      });
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
