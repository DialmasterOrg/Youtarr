/* eslint-env jest */
const { toRunRecord } = require('../watchStatusRunSummary');

describe('watchStatusRunSummary.toRunRecord', () => {
  test('reports a sync that was skipped because one was already running', () => {
    expect(toRunRecord({ skipped: 'already running', trigger: 'scheduled' })).toEqual({
      status: 'skipped', outcome: 'skipped', message: 'Already running.', details: null,
    });
  });

  test('reports a sync skipped for lack of servers', () => {
    expect(toRunRecord({ skipped: 'no media servers configured', servers: {} })).toEqual(expect.objectContaining({
      status: 'skipped', message: 'No media servers configured.',
    }));
  });

  test('reports an unexpected failure', () => {
    expect(toRunRecord({ error: 'Database unavailable', servers: {} })).toEqual({
      status: 'error', outcome: 'error', message: 'Database unavailable', details: null,
    });
  });

  test('summarizes a clean sync with the videos checked and changed', () => {
    expect(toRunRecord({
      servers: { plex: { checked: 3120, changed: 4 }, emby: { checked: 5000, changed: 10 } },
      totals: { checked: 6738, changed: 12 },
    })).toEqual({
      status: 'success',
      outcome: 'completed',
      message: 'Checked 6,738 videos on 2 servers; 12 had watch status changes.',
      details: { servers: 2, failed: 0, checked: 6738, changed: 12 },
    });
  });

  test('says so when nothing changed', () => {
    expect(toRunRecord({
      servers: { plex: { checked: 6738, changed: 0 } },
      totals: { checked: 6738, changed: 0 },
    }).message).toBe('Checked 6,738 videos on 1 server; no watch status changes.');
  });

  test('uses the singular for a single change', () => {
    expect(toRunRecord({
      servers: { plex: { checked: 1, changed: 1 } },
      totals: { checked: 1, changed: 1 },
    }).message).toBe('Checked 1 video on 1 server; 1 had a watch status change.');
  });

  test('reports a per-server failure as a partial run with the surviving counts', () => {
    expect(toRunRecord({
      servers: { plex: { checked: 3120, changed: 4 }, jellyfin: { error: 'server not reachable or not responding' } },
      totals: { checked: 3120, changed: 4 },
    })).toEqual({
      status: 'error',
      outcome: 'partial',
      message: 'Checked 3,120 videos on 1 of 2 servers; 4 had watch status changes. '
        + 'Jellyfin failed: server not reachable or not responding.',
      details: { servers: 2, failed: 1, checked: 3120, changed: 4 },
    });
  });

  test('lists only the failures when every server failed', () => {
    expect(toRunRecord({
      servers: { plex: { error: 'timeout' }, emby: { error: 'request failed (HTTP 401)' } },
      totals: { checked: 0, changed: 0 },
    }).message).toBe('Plex failed: timeout. Emby failed: request failed (HTTP 401).');
  });

  test('treats a missing summary as a failure', () => {
    expect(toRunRecord(undefined)).toEqual(expect.objectContaining({ status: 'error' }));
  });
});
