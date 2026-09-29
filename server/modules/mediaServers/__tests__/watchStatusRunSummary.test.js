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

  test('summarizes a clean sync with the servers synced and videos changed', () => {
    expect(toRunRecord({
      servers: { plex: { changed: 700 }, emby: { changed: 600 } },
      totals: { changed: 1200 },
    })).toEqual({
      status: 'success',
      outcome: 'completed',
      message: 'Synced 2 servers; 1,200 videos had watch status changes.',
      details: { servers: 2, failed: 0, changed: 1200 },
    });
  });

  test('says so when nothing changed', () => {
    expect(toRunRecord({
      servers: { plex: { changed: 0 } },
      totals: { changed: 0 },
    }).message).toBe('Synced 1 server; no watch status changes.');
  });

  test('uses the singular for a single change', () => {
    expect(toRunRecord({
      servers: { plex: { changed: 1 } },
      totals: { changed: 1 },
    }).message).toBe('Synced 1 server; 1 video had a watch status change.');
  });

  test('reports a per-server failure as a partial run with the surviving counts', () => {
    expect(toRunRecord({
      servers: { plex: { changed: 4 }, jellyfin: { error: 'server took too long to respond' } },
      totals: { changed: 4 },
    })).toEqual({
      status: 'error',
      outcome: 'partial',
      message: 'Synced 1 of 2 servers; 4 videos had watch status changes. '
        + 'Jellyfin failed: server took too long to respond.',
      details: { servers: 2, failed: 1, changed: 4 },
    });
  });

  test('lists only the failures when every server failed', () => {
    expect(toRunRecord({
      servers: { plex: { error: 'timeout' }, emby: { error: 'request failed (HTTP 401)' } },
      totals: { changed: 0 },
    }).message).toBe('Plex failed: timeout. Emby failed: request failed (HTTP 401).');
  });

  test('treats a missing summary as a failure', () => {
    expect(toRunRecord(undefined)).toEqual(expect.objectContaining({ status: 'error' }));
  });
});
