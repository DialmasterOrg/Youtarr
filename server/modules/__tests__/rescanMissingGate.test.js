/* eslint-env jest */
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

    expect(gate.held).toEqual([{ dir: ROOT, total: 16801, notFound: 16799 }]);
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

    expect(gate.held).toEqual([{ dir: `${ROOT}/__Music`, total: 40, notFound: 40 }]);
    expect(gate.holdsBack(music[0])).toBe(true);
    expect(gate.holdsBack(channels[0])).toBe(false);
    expect(gate.message).toBe('Only 0 of the 40 downloaded videos stored in the subfolder __Music were found.');
  });

  test('places a video by its audio file when it has no video file', () => {
    const rows = rowsIn('__Music/Artist', 30, 'music').map((row) => ({
      ...row, filePath: null, audioFilePath: row.filePath.replace('.mp4', '.mp3'),
    }));
    const gate = buildMissingGate(rows, new Map(), ROOT);

    expect(gate.held).toEqual([{ dir: `${ROOT}/__Music`, total: 30, notFound: 30 }]);
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

    expect(gate.held).toEqual([{ dir: ROOT, total: 30, notFound: 30 }]);
  });
});

describe('loadMissingGate', () => {
  test('reads the location of every present video', async () => {
    const rows = rowsIn('Channel', 30);
    const Video = { findAll: jest.fn().mockResolvedValue(rows) };

    const gate = await loadMissingGate(Video, new Map(), ROOT);

    expect(Video.findAll).toHaveBeenCalledWith({
      attributes: ['youtubeId', 'filePath', 'audioFilePath'],
      where: { removed: false },
      raw: true,
    });
    expect(gate.held).toHaveLength(1);
  });
});
