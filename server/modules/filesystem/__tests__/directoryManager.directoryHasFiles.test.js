const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { directoryHasFiles } = require('../directoryManager');

describe('directoryHasFiles', () => {
  let tmp;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'subf-'));
  });
  afterEach(async () => {
    await fs.remove(tmp);
  });

  test('returns false for a missing directory', async () => {
    expect(await directoryHasFiles(path.join(tmp, 'nope'))).toBe(false);
  });

  test('returns false for an empty tree (only empty subdirs)', async () => {
    await fs.ensureDir(path.join(tmp, 'channel', 'video'));
    expect(await directoryHasFiles(tmp)).toBe(false);
  });

  test('returns false when only ignorable files are present', async () => {
    await fs.ensureDir(path.join(tmp, 'channel'));
    await fs.writeFile(path.join(tmp, 'channel', 'poster.jpg'), 'x');
    await fs.writeFile(path.join(tmp, 'channel', '.DS_Store'), 'x');
    expect(await directoryHasFiles(tmp)).toBe(false);
  });

  test('returns true when a real file exists deep in the tree', async () => {
    await fs.ensureDir(path.join(tmp, 'channel', 'video'));
    await fs.writeFile(path.join(tmp, 'channel', 'video', 'clip.mp4'), 'x');
    expect(await directoryHasFiles(tmp)).toBe(true);
  });
});
