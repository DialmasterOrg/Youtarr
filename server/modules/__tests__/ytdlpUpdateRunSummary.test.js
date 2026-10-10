/* eslint-env jest */
const { TASK_KEY, toRunRecord, toUpdateState } = require('../ytdlpUpdateRunSummary');

describe('ytdlpUpdateRunSummary', () => {
  test('targets the yt-dlp update schedule', () => {
    expect(TASK_KEY).toBe('ytdlpUpdateFrequency');
  });

  describe('toRunRecord', () => {
    test('records an installed version', () => {
      expect(toRunRecord({ success: true, reason: 'updated', message: 'Successfully updated to 2026.04.20', newVersion: '2026.04.20' })).toEqual({
        status: 'success', outcome: 'updated', message: 'Updated to 2026.04.20', details: { version: '2026.04.20' },
      });
    });

    test('records an already current install', () => {
      expect(toRunRecord({ success: true, reason: 'up-to-date', message: 'yt-dlp is already up to date' })).toEqual({
        status: 'success', outcome: 'up-to-date', message: 'Already up to date.', details: null,
      });
    });

    test('records a deferred update as skipped', () => {
      expect(toRunRecord({ success: false, reason: 'skipped', message: 'An update is already in progress' })).toEqual({
        status: 'skipped', outcome: 'skipped', message: 'An update is already in progress', details: null,
      });
    });

    // yt-dlp's own messages restate the failure; the record's status already says it failed.
    test('records a failed update by its reason alone', () => {
      expect(toRunRecord({ success: false, reason: 'error', message: 'Update failed: Permission denied.' })).toEqual({
        status: 'error', outcome: 'error', message: 'Permission denied.', details: null,
      });
    });

    test('names the exit code of a failed update', () => {
      expect(toRunRecord({ success: false, reason: 'error', message: 'Update failed with exit code 1' })).toEqual(
        expect.objectContaining({ status: 'error', message: 'yt-dlp exited with code 1' })
      );
    });

    test('keeps a failure message that already stands alone', () => {
      expect(toRunRecord({ success: false, reason: 'error', message: 'Update timed out. Please try again later.' })).toEqual(
        expect.objectContaining({ status: 'error', message: 'Update timed out. Please try again later.' })
      );
    });
  });

  describe('toUpdateState', () => {
    const legacyConfig = {
      ytdlpLastChecked: '2026-04-25T04:00:00.000Z',
      ytdlpLastUpdated: '2026-04-20T04:00:00.000Z',
      ytdlpLastResult: { status: 'up-to-date' },
    };

    test('falls back to the legacy config fields when nothing has been recorded', () => {
      expect(toUpdateState({ lastRun: null, lastUpdate: null, config: legacyConfig })).toEqual({
        lastChecked: '2026-04-25T04:00:00.000Z',
        lastUpdated: '2026-04-20T04:00:00.000Z',
        lastResult: { status: 'up-to-date' },
      });
    });

    test('reports null fields when neither history nor legacy values exist', () => {
      expect(toUpdateState({ lastRun: null, lastUpdate: null, config: {} })).toEqual({
        lastChecked: null, lastUpdated: null, lastResult: null,
      });
    });

    test('derives the state from recorded runs', () => {
      const lastRun = { startedAt: '2026-09-20T04:00:00.000Z', status: 'success', outcome: 'updated', message: 'Updated to 2026.09.19', details: { version: '2026.09.19' } };
      expect(toUpdateState({ lastRun, lastUpdate: lastRun, config: legacyConfig })).toEqual({
        lastChecked: '2026-09-20T04:00:00.000Z',
        lastUpdated: '2026-09-20T04:00:00.000Z',
        lastResult: { status: 'updated', message: 'Updated to 2026.09.19', version: '2026.09.19' },
      });
    });

    test('keeps the legacy last-updated stamp until a recorded install exists', () => {
      const lastRun = { startedAt: '2026-09-20T04:00:00.000Z', status: 'success', outcome: 'up-to-date', message: 'Already up to date.', details: null };
      expect(toUpdateState({ lastRun, lastUpdate: null, config: legacyConfig })).toEqual({
        lastChecked: '2026-09-20T04:00:00.000Z',
        lastUpdated: '2026-04-20T04:00:00.000Z',
        lastResult: { status: 'up-to-date', message: 'Already up to date.' },
      });
    });

    test('reports an interrupted run as an error', () => {
      const lastRun = { startedAt: '2026-09-20T04:00:00.000Z', status: 'interrupted', outcome: null, message: 'Interrupted by a restart.', details: null };
      expect(toUpdateState({ lastRun, lastUpdate: null, config: {} }).lastResult).toEqual({
        status: 'error', message: 'Interrupted by a restart.',
      });
    });

    test('reports a skipped run as skipped', () => {
      const lastRun = { startedAt: '2026-09-20T04:00:00.000Z', status: 'skipped', outcome: 'skipped', message: 'An update is already in progress', details: null };
      expect(toUpdateState({ lastRun, lastUpdate: null, config: {} }).lastResult).toEqual({
        status: 'skipped', message: 'An update is already in progress',
      });
    });
  });
});
