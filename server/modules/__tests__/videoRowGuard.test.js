/* eslint-env jest */
const { unchangedSinceRead, GUARDED_COLUMNS } = require('../videoRowGuard');

describe('unchangedSinceRead', () => {
  const downloadedAt = new Date('2026-09-27T03:31:07Z');
  const row = {
    id: 42,
    removed: 0,
    filePath: '/videos/Channel/Video [abc].mp4',
    fileSize: '1024',
    audioFilePath: null,
    audioFileSize: null,
    video_resolution: '1920x1080',
    last_downloaded_at: downloadedAt,
  };

  test('matches the row by id and every guarded value as read', () => {
    expect(unchangedSinceRead(row)).toEqual({
      id: 42,
      removed: false,
      filePath: '/videos/Channel/Video [abc].mp4',
      fileSize: '1024',
      audioFilePath: null,
      audioFileSize: null,
      video_resolution: '1920x1080',
      last_downloaded_at: downloadedAt,
    });
  });

  test('normalizes a raw 1 for removed to true', () => {
    expect(unchangedSinceRead({ ...row, removed: 1 }).removed).toBe(true);
  });

  test('keeps nulls so the query compares with IS NULL', () => {
    expect(unchangedSinceRead({ ...row, filePath: null }).filePath).toBeNull();
  });

  test.each(GUARDED_COLUMNS)('rejects a row read without %s', (column) => {
    const partial = { ...row };
    delete partial[column];
    expect(() => unchangedSinceRead(partial)).toThrow(column);
  });
});
