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

  test('reports a per-server failure as a failed run with the surviving counts', () => {
    expect(toRunRecord({ servers: { plex: { updated: 3 }, jellyfin: { error: 'timeout' } } })).toEqual({
      status: 'error',
      outcome: 'partial',
      message: 'Synced 1 of 2 servers (3 videos updated); jellyfin failed: timeout',
      details: { servers: 2, failed: 1, updated: 3 },
    });
  });

  test('summarizes a clean sync', () => {
    expect(toRunRecord({ servers: { plex: { updated: 3 }, emby: { updated: 1 } } })).toEqual({
      status: 'success',
      outcome: 'completed',
      message: 'Synced 2 servers, 4 videos updated.',
      details: { servers: 2, failed: 0, updated: 4 },
    });
  });

  test('treats a missing summary as a failure', () => {
    expect(toRunRecord(undefined)).toEqual(expect.objectContaining({ status: 'error' }));
  });
});
