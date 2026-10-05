// Real filesystem: the move must never replace another file and must be safe
// to repeat after an interruption, which a mocked fs could not show.
jest.mock('../../../logger', () => ({ debug: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const fs = require('fs');
const fsExtra = require('fs-extra');
const os = require('os');
const path = require('path');
const { moveFileNoClobber, NO_CLOBBER_STAGING_SUFFIX } = require('../fileOperations');

function exdev() {
  return Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
}

describe('filesystem/fileOperations moveFileNoClobber', () => {
  let root;
  let src;
  let dest;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'move-no-clobber-'));
    src = path.join(root, 'Channel', 'Title [abcdefghijk].mp4');
    dest = path.join(root, 'Show', 'Season 2024', 'S2024E01151200 - Title [abcdefghijk].mp4');
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, 'video');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('moves the file, creating the destination folder', async () => {
    await expect(moveFileNoClobber(src, dest)).resolves.toBe('moved');

    expect(fs.readFileSync(dest, 'utf8')).toBe('video');
    expect(fs.existsSync(src)).toBe(false);
  });

  it('refuses a destination that holds a different file and leaves both files', async () => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'someone else');

    await expect(moveFileNoClobber(src, dest)).rejects.toMatchObject({ code: 'EEXIST' });

    expect(fs.readFileSync(dest, 'utf8')).toBe('someone else');
    expect(fs.readFileSync(src, 'utf8')).toBe('video');
  });

  it('reports a source that was already moved', async () => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);

    await expect(moveFileNoClobber(src, dest)).resolves.toBe('already-moved');
    expect(fs.readFileSync(dest, 'utf8')).toBe('video');
  });

  it('finishes a copy that stopped before removing the source', async () => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    const { atime, mtime } = fs.statSync(src);
    fs.utimesSync(dest, atime, mtime);

    await expect(moveFileNoClobber(src, dest)).resolves.toBe('already-moved');

    expect(fs.existsSync(src)).toBe(false);
    expect(fs.readFileSync(dest, 'utf8')).toBe('video');
  });

  // A case-insensitive filesystem that reports another inode for each
  // spelling (SMB without server inode numbers) shows the same file at both
  // paths; two real files stand in for it. Taking it for a finished copy
  // would delete the only copy.
  it.each([
    ['case', 'cafe'],
    ['accents', 'Café'],
  ])('refuses, keeping the source, when the destination differs only in %s and looks like a finished copy', async (_label, destFolder) => {
    const source = path.join(root, 'Cafe', 'Title [abcdefghijk].mp4');
    const target = path.join(root, destFolder, 'Title [abcdefghijk].mp4');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, 'video');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    const { atime, mtime } = fs.statSync(source);
    fs.utimesSync(target, atime, mtime);

    await expect(moveFileNoClobber(source, target)).rejects.toMatchObject({ code: 'EEXIST' });

    expect(fs.readFileSync(source, 'utf8')).toBe('video');
  });

  it('removes a staging copy left by an interrupted move before moving', async () => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(`${dest}${NO_CLOBBER_STAGING_SUFFIX}`, 'partial');

    await moveFileNoClobber(src, dest);

    expect(fs.existsSync(`${dest}${NO_CLOBBER_STAGING_SUFFIX}`)).toBe(false);
    expect(fs.readFileSync(dest, 'utf8')).toBe('video');
  });

  it('throws ENOENT when neither the source nor the destination exists', async () => {
    fs.unlinkSync(src);

    await expect(moveFileNoClobber(src, dest)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('copies through a staging file when the destination is on another filesystem', async () => {
    const realRename = fs.promises.rename;
    const renames = [];
    jest.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      renames.push([from, to]);
      if (from === src) throw exdev();
      return realRename(from, to);
    });

    await expect(moveFileNoClobber(src, dest)).resolves.toBe('moved');

    expect(renames).toContainEqual([`${dest}${NO_CLOBBER_STAGING_SUFFIX}`, dest]);
    expect(fs.readFileSync(dest, 'utf8')).toBe('video');
    expect(fs.existsSync(src)).toBe(false);
  });

  it('keeps the source and removes the staging file when a cross-filesystem copy fails', async () => {
    jest.spyOn(fs.promises, 'rename').mockRejectedValue(exdev());
    jest.spyOn(fsExtra, 'copy').mockImplementation(async (from, to) => {
      fs.writeFileSync(to, 'part');
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    });

    await expect(moveFileNoClobber(src, dest, { retries: 0 })).rejects.toMatchObject({ code: 'ENOSPC' });

    expect(fs.readFileSync(src, 'utf8')).toBe('video');
    expect(fs.existsSync(`${dest}${NO_CLOBBER_STAGING_SUFFIX}`)).toBe(false);
    expect(fs.existsSync(dest)).toBe(false);
  });
});
