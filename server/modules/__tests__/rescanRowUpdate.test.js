/* eslint-env jest */
const { isRescanCandidate, resolveRescanUpdate } = require('../rescanRowUpdate');

const MP4 = '/videos/Channel/Video [abc].mp4';
const MP3 = '/videos/Channel/Video [abc].mp3';
const MOVED_MP4 = '/videos/Other/Video [abc].mp4';

const row = (overrides = {}) => ({
  id: 1,
  youtubeId: 'abc',
  removed: 0,
  filePath: null,
  fileSize: null,
  audioFilePath: null,
  audioFileSize: null,
  video_resolution: null,
  last_downloaded_at: null,
  ...overrides,
});

const fsError = (code) => Object.assign(new Error(code), { code });

// Files on disk right now, keyed by path; any other path is missing.
// `dirs` lists paths that exist as directories.
const diskWith = (files, errors = {}, dirs = []) => async (filePath) => {
  if (errors[filePath]) throw fsError(errors[filePath]);
  if (dirs.includes(filePath)) return { size: 4096, isFile: () => false };
  if (filePath in files) return { size: files[filePath], isFile: () => true };
  throw fsError('ENOENT');
};

describe('isRescanCandidate', () => {
  test('nominates a row the walk did not find unless it is already missing', () => {
    expect(isRescanCandidate(row({ filePath: MP4 }), undefined, null)).toBe(true);
    expect(isRescanCandidate(row({ filePath: MP4, removed: 1 }), undefined, null)).toBe(false);
  });

  test('skips a row that already matches the walk', () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    expect(isRescanCandidate(row({ filePath: MP4, fileSize: '1000' }), fileInfo, null)).toBe(false);
  });

  test('nominates a row whose size differs from the walk', () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    expect(isRescanCandidate(row({ filePath: MP4, fileSize: '900' }), fileInfo, null)).toBe(true);
  });

  test('nominates a missing row the walk found again', () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    expect(isRescanCandidate(row({ filePath: MP4, fileSize: '1000', removed: 1 }), fileInfo, null)).toBe(true);
  });

  test('nominates a row with a fresh probe result', () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    expect(isRescanCandidate(row({ filePath: MP4, fileSize: '1000' }), fileInfo, '1920x1080')).toBe(true);
  });

  test('nominates a row whose stored format the walk did not find', () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    expect(isRescanCandidate(
      row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500' }), fileInfo, null
    )).toBe(true);
  });
});

describe('resolveRescanUpdate', () => {
  test('marks a row missing when every format is confirmed gone, keeping stored paths', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500', video_resolution: '1920x1080' }),
      undefined, null, diskWith({})
    );
    expect(update).toEqual({ removed: true });
  });

  test('writes nothing for a row already missing whose files are still gone', async () => {
    expect(await resolveRescanUpdate(row({ filePath: MP4, removed: 1 }), undefined, null, diskWith({}))).toBeNull();
  });

  test('writes nothing when the stored file exists even though the walk missed it', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), undefined, null, diskWith({ [MP4]: 1000 })
    );
    expect(update).toBeNull();
  });

  test('restores a missing row whose file is back', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000', removed: 1 }),
      { videoFilePath: MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1000 })
    );
    expect(update).toEqual({ removed: false });
  });

  test('records a moved file at the path the walk found, with its fresh size', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }),
      { videoFilePath: MOVED_MP4, videoFileSize: 1000 }, null, diskWith({ [MOVED_MP4]: 1200 })
    );
    expect(update).toEqual({ filePath: MOVED_MP4, fileSize: 1200, removed: false });
  });

  test('falls back to the stored path when the walked path is gone', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }),
      { videoFilePath: MOVED_MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1000 })
    );
    expect(update).toBeNull();
  });

  test('clears a missing format when the other format is confirmed present', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500', video_resolution: '1920x1080' }),
      { audioFilePath: MP3, audioFileSize: 500 }, null, diskWith({ [MP3]: 500 })
    );
    expect(update).toEqual({ filePath: null, fileSize: null, video_resolution: null, removed: false });
  });

  test('keeps a format that appeared after the walk', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500' }),
      { videoFilePath: MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1000, [MP3]: 500 })
    );
    expect(update).toBeNull();
  });

  test('uses the fresh size, not the walk size, for a file replaced after the walk', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '900' }),
      { videoFilePath: MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1100 })
    );
    expect(update).toEqual({ fileSize: 1100, removed: false });
  });

  test('stores a probed resolution only while the probed file is unchanged', async () => {
    const fileInfo = { videoFilePath: MP4, videoFileSize: 1000 };
    const unchanged = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), fileInfo, '1920x1080', diskWith({ [MP4]: 1000 })
    );
    const replaced = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), fileInfo, '1920x1080', diskWith({ [MP4]: 2000 })
    );
    expect(unchanged).toEqual({ video_resolution: '1920x1080', removed: false });
    expect(replaced).toEqual({ fileSize: 2000, removed: false });
  });

  test('leaves the row alone when its only file cannot be checked', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), undefined, null, diskWith({}, { [MP4]: 'EACCES' })
    );
    expect(update).toBeNull();
  });

  test('marks a row missing when a directory in its stored path is now a file', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), undefined, null, diskWith({}, { [MP4]: 'ENOTDIR' })
    );
    expect(update).toEqual({ removed: true });
  });

  test('does not record a directory at the stored path as the file', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }), undefined, null, diskWith({}, {}, [MP4])
    );
    expect(update).toEqual({ removed: true });
  });

  test('neither clears nor marks missing while one format cannot be checked', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500' }),
      undefined, null, diskWith({}, { [MP3]: 'EIO' })
    );
    expect(update).toBeNull();
  });

  test('refreshes a present format while the other cannot be checked, leaving the unchecked one as stored', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '900', audioFilePath: MP3, audioFileSize: '500' }),
      undefined, null, diskWith({ [MP4]: 1000 }, { [MP3]: 'EIO' })
    );
    expect(update).toEqual({ fileSize: 1000, removed: false });
  });

  test('restores a missing row whose video is back even though its audio cannot be checked', async () => {
    const update = await resolveRescanUpdate(
      row({ removed: 1, filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500' }),
      { videoFilePath: MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1000 }, { [MP3]: 'EIO' })
    );
    expect(update).toEqual({ removed: false });
  });

  // videoRowGuard can't tell a no-op write from a conflict (Sequelize connects
  // with -FOUND_ROWS), so every update must change at least one column.
  test.each([
    ['restoring a missing row', row({ filePath: MP4, fileSize: '1000', removed: 1 }), { videoFilePath: MP4, videoFileSize: 1000 }, { [MP4]: 1000 }],
    ['marking a row missing', row({ filePath: MP4, fileSize: '1000' }), undefined, {}],
    ['recording a new size', row({ filePath: MP4, fileSize: '900' }), { videoFilePath: MP4, videoFileSize: 1000 }, { [MP4]: 1000 }],
    ['clearing a missing format', row({ filePath: MP4, fileSize: '1000', audioFilePath: MP3, audioFileSize: '500' }), { audioFilePath: MP3, audioFileSize: 500 }, { [MP3]: 500 }],
  ])('never returns a write that changes nothing when %s', async (_label, current, fileInfo, files) => {
    const update = await resolveRescanUpdate(current, fileInfo, null, diskWith(files));
    const changed = Object.entries(update).filter(([column, value]) => String(value) !== String(current[column]));
    expect(changed.length).toBeGreaterThan(0);
  });

  test('treats a present path as present even if another candidate path errors', async () => {
    const update = await resolveRescanUpdate(
      row({ filePath: MP4, fileSize: '1000' }),
      { videoFilePath: MOVED_MP4, videoFileSize: 1000 }, null, diskWith({ [MP4]: 1000 }, { [MOVED_MP4]: 'EIO' })
    );
    expect(update).toBeNull();
  });
});
