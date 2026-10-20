import { describeMissing, describeRemoval, describeRow, getRemovalState, removalFromRow } from '../videoRemoval';
import { formatDate } from '../formatters';

const AT = '2026-10-03T12:00:00.000Z';
const ON = ` on ${formatDate(AT)}`;

describe('getRemovalState', () => {
  test('is present while the row is not removed, whatever the reason says', () => {
    expect(getRemovalState(false, null)).toBe('present');
    expect(getRemovalState(undefined, undefined)).toBe('present');
    expect(getRemovalState(false, 'not_found')).toBe('present');
  });

  test('is missing for a removed row whose file was not found', () => {
    expect(getRemovalState(true, 'not_found')).toBe('missing');
  });

  test('is deleted for a removed row with any other reason', () => {
    expect(getRemovalState(true, 'user_deleted')).toBe('deleted');
    expect(getRemovalState(true, 'auto_removal')).toBe('deleted');
    expect(getRemovalState(true, 'marked_deleted')).toBe('deleted');
  });

  test('treats a removed row without a recorded reason as deleted', () => {
    expect(getRemovalState(true, null)).toBe('deleted');
    expect(getRemovalState(true, undefined)).toBe('deleted');
  });
});

describe('describeRemoval', () => {
  test('describes a present file', () => {
    expect(describeRemoval('present', { reason: null, at: null, detail: null })).toBe('Video file exists on disk');
  });

  test('explains a row removed before the reason was recorded', () => {
    expect(describeRemoval('deleted', { reason: null, at: null, detail: null })).toBe('Removed before Youtarr recorded why. It can be downloaded again.');
  });

  test('explains a delete made in Youtarr', () => {
    expect(describeRemoval('deleted', { reason: 'user_deleted', at: AT, detail: null })).toBe(
      `Deleted in Youtarr${ON}. It can be downloaded again.`
    );
  });

  test('explains automatic cleanup with the rule that removed it', () => {
    expect(describeRemoval('deleted', { reason: 'auto_removal', at: AT, detail: 'older than 30 days' })).toBe(
      `Deleted by automatic cleanup${ON} (older than 30 days). It can be downloaded again.`
    );
    expect(describeRemoval('deleted', { reason: 'auto_removal', at: null, detail: null })).toBe(
      'Deleted by automatic cleanup. It can be downloaded again.'
    );
  });

  test('explains a missing video the user marked as deleted', () => {
    expect(describeRemoval('deleted', { reason: 'marked_deleted', at: AT, detail: null })).toBe(
      `Marked as deleted${ON}. Its file was missing from disk when it was marked. It can be downloaded again.`
    );
  });

  test('explains a missing file, with the path it looked at and when', () => {
    expect(describeRemoval('missing', { reason: 'not_found', at: AT, detail: null }, '/data/Channel/video.mp4')).toBe(
      `Youtarr expected a file at /data/Channel/video.mp4 and could not find it (checked ${formatDate(AT)}). If the drive is mounted and the file is really gone, mark it as deleted.`
    );
    expect(describeRemoval('missing', { reason: 'not_found', at: null, detail: null })).toBe(
      'Youtarr expected a file and could not find it. If the drive is mounted and the file is really gone, mark it as deleted.'
    );
  });
});

describe('describeMissing', () => {
  test('splits the missing-file sentence around the path', () => {
    expect(describeMissing({ reason: 'not_found', at: AT, detail: null }, '/usr/src/app/data/Channel/v.mp4')).toEqual({
      path: 'Channel/v.mp4',
      rest: `and could not find it (checked ${formatDate(AT)}). If the drive is mounted and the file is really gone, mark it as deleted.`,
    });
  });

  test('has no path when none is stored', () => {
    expect(describeMissing({ reason: 'not_found', at: null, detail: null }, null).path).toBeNull();
  });
});

describe('row helpers', () => {
  test('removalFromRow reads the snake_case columns, defaulting to null', () => {
    expect(removalFromRow({ removed_reason: 'auto_removal', removed_at: AT, removed_detail: 'older than 30 days' })).toEqual({
      reason: 'auto_removal', at: AT, detail: 'older than 30 days',
    });
    expect(removalFromRow({})).toEqual({ reason: null, at: null, detail: null });
  });

  test('shows the path as the user knows it, without the container prefix', () => {
    expect(describeRow({ removed: true, removed_reason: 'not_found', filePath: '/usr/src/app/data/Channel/v.mp4' })).toContain(
      'expected a file at Channel/v.mp4 and'
    );
    expect(describeRemoval('missing', { reason: 'not_found', at: null, detail: null }, '/mnt/nas/Channel/v.mp4')).toContain(
      'expected a file at /mnt/nas/Channel/v.mp4 and'
    );
  });

  test('describeRow derives the state and text from a listing row', () => {
    expect(describeRow({ removed: true, removed_reason: 'not_found', removed_at: null, removed_detail: null, filePath: '/d/v.mp4' })).toBe(
      'Youtarr expected a file at /d/v.mp4 and could not find it. If the drive is mounted and the file is really gone, mark it as deleted.'
    );
    expect(describeRow({ removed: false })).toBe('Video file exists on disk');
  });
});
