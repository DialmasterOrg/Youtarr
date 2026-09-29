/* eslint-env jest */
const { toRunRecord } = require('../sweepRunSummary');

const finished = (totals = {}) => ({ endedBy: 'finished', finishedAt: new Date(), totals });

describe('toRunRecord', () => {
  test('says so when there were no new videos', () => {
    expect(toRunRecord({ sweep: finished({ jobCount: 0 }) })).toEqual({
      finishedAt: expect.any(Date),
      status: 'success',
      outcome: 'completed',
      message: 'No new videos.',
      details: { endedBy: 'finished', downloaded: 0, skipped: 0, failed: 0, membersOnly: 0, jobs: 0 },
    });
  });

  test('counts what downloaded and what was skipped', () => {
    const record = toRunRecord({ sweep: finished({ totalDownloaded: 3, totalSkipped: 6, jobCount: 2 }) });
    expect(record).toMatchObject({ status: 'success', outcome: 'completed' });
    expect(record.message).toBe('3 videos downloaded, 6 skipped (already downloaded or filtered).');
  });

  test('marks a sweep with failed videos as partly failed, with the counts', () => {
    const record = toRunRecord({ sweep: finished({ totalDownloaded: 3, totalFailed: 2, totalSkipped: 6 }) });
    expect(record).toMatchObject({ status: 'error', outcome: 'partial' });
    expect(record.message).toBe('3 videos downloaded, 2 failed, 6 skipped (already downloaded or filtered).');
    expect(record.details).toMatchObject({ downloaded: 3, failed: 2 });
  });

  test('names failed videos plainly when nothing downloaded', () => {
    expect(toRunRecord({ sweep: finished({ totalFailed: 1 }) }).message).toBe('1 video failed.');
  });

  test('marks a job that failed outright as partly failed, with its reason', () => {
    const record = toRunRecord({ sweep: finished({
      jobIssues: [{ status: 'Failed', reason: 'No valid channel URLs to download', byUser: false }],
    }) });
    expect(record).toMatchObject({ status: 'error', outcome: 'partial' });
    expect(record.message).toBe('No new videos. A download job failed: No valid channel URLs to download.');
  });

  test('marks a terminated job as partly failed, with the termination reason', () => {
    const record = toRunRecord({ sweep: finished({
      totalDownloaded: 2,
      jobIssues: [{ status: 'Terminated', reason: 'Download terminated due to timeout', byUser: false }],
    }) });
    expect(record).toMatchObject({ status: 'error', outcome: 'partial' });
    expect(record.message).toBe('2 videos downloaded. A download job was terminated: Download terminated due to timeout.');
  });

  test('passes on when the sweep really ended', () => {
    const endedAt = new Date('2026-09-28T16:21:17.000Z');
    expect(toRunRecord({ sweep: { endedBy: 'idle', finishedAt: endedAt, totals: null } }).finishedAt).toBe(endedAt);
  });

  test('says where a grouped download stopped early', () => {
    const record = toRunRecord({ sweep: finished({
      totalDownloaded: 1, stoppedGroups: [{ group: 'Group 2/3 (1080p)', reason: 'bot check', terminated: false }],
    }) });
    expect(record.outcome).toBe('partial');
    expect(record.message).toContain('Stopped early at Group 2/3 (1080p) (bot check); later groups were skipped.');
  });

  test('keeps playlist check failures from queueing', () => {
    const record = toRunRecord({
      sweep: finished({ totalDownloaded: 1 }),
      queueResult: { playlistError: null, playlistsFailed: 1, playlistsChecked: 3 },
    });
    expect(record).toMatchObject({ status: 'error', outcome: 'partial' });
    expect(record.message).toBe('1 video downloaded. 1 of 3 playlists could not be checked.');
    expect(record.details).toMatchObject({ playlistsChecked: 3, playlistsFailed: 1 });
  });

  test('reports a playlist check that failed outright', () => {
    const record = toRunRecord({ sweep: finished(), queueResult: { playlistError: 'Playlist API down' } });
    expect(record.message).toBe('No new videos. The playlist check failed: Playlist API down.');
  });

  test('notes playlists skipped by a pause during queueing without calling it a failure', () => {
    const record = toRunRecord({ sweep: finished(), queueResult: { playlistsPausedReason: 'Downloads are paused: over the limit' } });
    expect(record).toMatchObject({ status: 'success', outcome: 'completed' });
    expect(record.message).toBe('No new videos. Playlist downloads were skipped: Downloads are paused: over the limit.');
  });

  test('ends a sweep stopped by a storage pause with the reason and what is still queued', () => {
    const record = toRunRecord({
      sweep: { endedBy: 'paused', finishedAt: new Date(), totals: { totalDownloaded: 2 }, remainingJobs: 4 },
      pauseMessage: 'Downloads are paused: over the 10 GB limit',
    });
    expect(record).toMatchObject({ status: 'success', outcome: 'paused' });
    expect(record.message).toBe(
      'Stopped when downloads were paused: Downloads are paused: over the 10 GB limit. 4 queued jobs will run when downloads resume. 2 videos downloaded.'
    );
    expect(record.details.remainingJobs).toBe(4);
  });

  test('keeps failures amber for a paused sweep', () => {
    const record = toRunRecord({
      sweep: { endedBy: 'paused', finishedAt: new Date(), totals: { totalFailed: 1 }, remainingJobs: 1 },
      pauseMessage: 'Downloads are paused.',
    });
    expect(record).toMatchObject({ status: 'error', outcome: 'partial' });
  });

  test('says tracking stopped after the maximum wait', () => {
    const record = toRunRecord({ sweep: { endedBy: 'timeout', finishedAt: new Date(), totals: null, remainingJobs: 2 } });
    expect(record).toMatchObject({ status: 'error', outcome: 'timed-out' });
    expect(record.message).toBe('Stopped tracking after 48 hours; 2 jobs still queued or running. No new videos.');
  });

  test('reports a failed check as an error', () => {
    const record = toRunRecord({ sweep: { endedBy: 'error', finishedAt: new Date(), totals: null, error: 'boom' } });
    expect(record).toMatchObject({ status: 'error', outcome: 'error' });
    expect(record.message).toBe('Could not tell when the downloads finished: boom. No new videos.');
  });
});
