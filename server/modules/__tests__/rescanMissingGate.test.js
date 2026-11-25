/* eslint-env jest */
jest.mock('../../logger');
const { buildMissingGate, loadMissingGate } = require('../rescanMissingGate');

const ROOT = '/data/youtube';

const rowsIn = (folder, count, idPrefix = folder) => Array.from({ length: count }, (_, i) => ({
  youtubeId: `${idPrefix}-${i}`,
  filePath: `${ROOT}/${folder}/Video ${i}/Video [${idPrefix}-${i}].mp4`,
  audioFilePath: null,
}));
const walkFound = (rows) => new Map(rows.map((row) => [row.youtubeId, { videoFilePath: row.filePath }]));

describe('buildMissingGate', () => {
  test('holds nothing back when the walk found the library', () => {
    const rows = rowsIn('Channel', 100);
    const gate = buildMissingGate(rows, walkFound(rows.slice(0, 60)), ROOT);

    expect(gate.held).toEqual([]);
    expect(gate.message).toBeNull();
    expect(gate.holdsBack(rows[99])).toBe(false);
  });

  test('holds back the downloads folder when most of its videos were not found', () => {
    const rows = rowsIn('Channel', 16801);
    const gate = buildMissingGate(rows, walkFound(rows.slice(0, 2)), ROOT);

    expect(gate.held).toEqual([{ dir: ROOT, total: 16801, notFound: 16799, channelFolderGone: 16799 }]);
    expect(gate.holdsBack(rows[500])).toBe(true);
    expect(gate.message).toBe('Only 2 of the 16,801 downloaded videos stored in the downloads folder were found.');
  });

  test('lets a few gone videos through, however large their share', () => {
    const rows = rowsIn('Channel', 24);
    const gate = buildMissingGate(rows, new Map(), ROOT);

    expect(gate.held).toEqual([]);
  });

  test('judges each subfolder on its own', () => {
    const music = rowsIn('__Music/Artist', 40, 'music');
    const channels = rowsIn('Channel', 200);
    const gate = buildMissingGate([...music, ...channels], walkFound(channels), ROOT);

    expect(gate.held).toEqual([{ dir: `${ROOT}/__Music`, total: 40, notFound: 40, channelFolderGone: 40 }]);
    expect(gate.holdsBack(music[0])).toBe(true);
    expect(gate.holdsBack(channels[0])).toBe(false);
    expect(gate.message).toBe('Only 0 of the 40 downloaded videos stored in the subfolder __Music were found.');
  });

  test('places a video by its audio file when it has no video file', () => {
    const rows = rowsIn('__Music/Artist', 30, 'music').map((row) => ({
      ...row, filePath: null, audioFilePath: row.filePath.replace('.mp4', '.mp3'),
    }));
    const gate = buildMissingGate(rows, new Map(), ROOT);

    expect(gate.held).toEqual([{ dir: `${ROOT}/__Music`, total: 30, notFound: 30, channelFolderGone: 30 }]);
  });

  test('ignores videos stored outside the downloads folder', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ youtubeId: `x${i}`, filePath: `/elsewhere/v [x${i}].mp4`, audioFilePath: null }));
    const gate = buildMissingGate(rows, new Map(), ROOT);

    expect(gate.held).toEqual([]);
    expect(gate.holdsBack(rows[0])).toBe(false);
  });

  test('treats a file directly in a __ folder name at the root as the root', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ youtubeId: `r${i}`, filePath: `${ROOT}/__odd name [r${i}].mp4`, audioFilePath: null }));
    const gate = buildMissingGate(rows, new Map(), ROOT);

    expect(gate.held).toEqual([{ dir: ROOT, total: 30, notFound: 30, channelFolderGone: 30 }]);
  });

  test('does not count videos gone from a channel folder that is still on disk', () => {
    const rows = rowsIn('Channel', 56);
    const gate = buildMissingGate(rows, walkFound(rows.slice(0, 15)), ROOT, new Set([`${ROOT}/Channel`]));

    expect(gate.held).toEqual([]);
    expect(gate.holdsBack(rows[55])).toBe(false);
  });

  test('still holds a folder back when most of its videos went with their channel folders', () => {
    const deleted = rowsIn('Kept Channel', 10, 'kept');
    const gone = rowsIn('Gone Channel', 40, 'gone');
    const gate = buildMissingGate([...deleted, ...gone], new Map(), ROOT, new Set([`${ROOT}/Kept Channel`]));

    expect(gate.held).toEqual([{ dir: ROOT, total: 50, notFound: 50, channelFolderGone: 40 }]);
    expect(gate.message).toBe('Only 0 of the 50 downloaded videos stored in the downloads folder were found.');
  });

  test('finds the channel folder inside a subfolder', () => {
    const music = rowsIn('__Music/Artist', 40, 'music');
    const gate = buildMissingGate(music, new Map(), ROOT, new Set([`${ROOT}/__Music/Artist`]));

    expect(gate.held).toEqual([]);
  });

  test('counts a video stored with no channel folder as gone with it', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ youtubeId: `m${i}`, filePath: `${ROOT}/__Music/Track [m${i}].mp3`, audioFilePath: null }));
    const gate = buildMissingGate(rows, new Map(), ROOT, new Set([`${ROOT}/__Music`]));

    expect(gate.held).toEqual([{ dir: `${ROOT}/__Music`, total: 30, notFound: 30, channelFolderGone: 30 }]);
  });
});

describe('loadMissingGate', () => {
  const fsError = (code) => Object.assign(new Error(code), { code });
  // A stat that finds only the given folders.
  const statFinding = (...folders) => jest.fn(async (target) => {
    if (folders.includes(target)) return { isDirectory: () => true };
    throw fsError('ENOENT');
  });

  test('reads the location of every present video', async () => {
    const rows = rowsIn('Channel', 30);
    const Video = { findAll: jest.fn().mockResolvedValue(rows) };

    const gate = await loadMissingGate(Video, new Map(), ROOT, { stat: statFinding() });

    expect(Video.findAll).toHaveBeenCalledWith({
      attributes: ['youtubeId', 'filePath', 'audioFilePath'],
      where: { removed: false },
      raw: true,
    });
    expect(gate.held).toHaveLength(1);
  });

  test('holds nothing back when the missing videos\' channel folders are still on disk', async () => {
    const rows = [...rowsIn('Channel A', 30, 'a'), ...rowsIn('Channel B', 26, 'b')];
    const Video = { findAll: jest.fn().mockResolvedValue(rows) };
    const stat = statFinding(`${ROOT}/Channel A`, `${ROOT}/Channel B`);

    const gate = await loadMissingGate(Video, walkFound(rows.slice(0, 15)), ROOT, { stat });

    expect(gate.held).toEqual([]);
    expect(gate.holdsBack(rows[55])).toBe(false);
  });

  test('checks each channel folder once', async () => {
    const rows = [...rowsIn('Channel A', 30, 'a'), ...rowsIn('Channel B', 26, 'b')];
    const stat = statFinding();

    await loadMissingGate({ findAll: jest.fn().mockResolvedValue(rows) }, new Map(), ROOT, { stat });

    expect(stat.mock.calls.map(([target]) => target).sort()).toEqual([`${ROOT}/Channel A`, `${ROOT}/Channel B`]);
  });

  test('holds the folder back when a channel folder cannot be checked', async () => {
    const rows = rowsIn('Channel', 30);
    const stat = jest.fn().mockRejectedValue(fsError('EACCES'));

    const gate = await loadMissingGate({ findAll: jest.fn().mockResolvedValue(rows) }, new Map(), ROOT, { stat });

    expect(gate.held).toEqual([{ dir: ROOT, total: 30, notFound: 30, channelFolderGone: 30 }]);
  });

  test('does not touch the disk when the walk found the library', async () => {
    const rows = rowsIn('Channel', 100);
    const stat = statFinding();

    await loadMissingGate({ findAll: jest.fn().mockResolvedValue(rows) }, walkFound(rows.slice(0, 60)), ROOT, { stat });

    expect(stat).not.toHaveBeenCalled();
  });
});
