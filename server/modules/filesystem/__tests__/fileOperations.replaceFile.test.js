// Real filesystem: the replacement must never leave a window in which the
// destination is missing, which a mocked mover could not show.
jest.mock('../../../logger', () => ({ debug: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const fs = require('fs');
const fsExtra = require('fs-extra');
const os = require('os');
const path = require('path');
const { replaceFileWithRetries } = require('../fileOperations');

function enospc() {
  return Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
}

// Mirrors fs-extra's move across filesystems: with overwrite it removes the
// destination first, then the copy fails.
function failingMove(beforeFailing = () => {}) {
  return jest.spyOn(fsExtra, 'move').mockImplementation(async (from, to, opts) => {
    if (opts && opts.overwrite) await fsExtra.remove(to);
    beforeFailing(to);
    throw enospc();
  });
}

describe('filesystem/fileOperations replaceFileWithRetries', () => {
  let root;
  let src;
  let dest;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'replace-file-'));
    src = path.join(root, 'incoming', 'S01E01 [abcdefghijk].mp4');
    dest = path.join(root, 'Season 01', 'S01E01 [abcdefghijk].mp4');
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(src, 'new');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('replaces the destination with the source and removes the source', async () => {
    fs.writeFileSync(dest, 'old');

    await replaceFileWithRetries(src, dest);

    expect(fs.readFileSync(dest, 'utf8')).toBe('new');
    expect(fs.existsSync(src)).toBe(false);
  });

  it('creates a destination that does not exist yet', async () => {
    await replaceFileWithRetries(src, dest);

    expect(fs.readFileSync(dest, 'utf8')).toBe('new');
  });

  it('leaves no staging file behind after a replacement', async () => {
    fs.writeFileSync(dest, 'old');

    await replaceFileWithRetries(src, dest);

    expect(fs.readdirSync(path.dirname(dest))).toEqual([path.basename(dest)]);
  });

  it('keeps the destination when the transfer fails', async () => {
    fs.writeFileSync(dest, 'old');
    failingMove();

    await expect(replaceFileWithRetries(src, dest, { retries: 0 })).rejects.toThrow('no space left on device');

    expect(fs.readFileSync(dest, 'utf8')).toBe('old');
    expect(fs.readFileSync(src, 'utf8')).toBe('new');
  });

  it('removes a partial staging file when the transfer fails', async () => {
    fs.writeFileSync(dest, 'old');
    failingMove((to) => fs.writeFileSync(to, 'partial'));

    await expect(replaceFileWithRetries(src, dest, { retries: 0 })).rejects.toThrow('no space left on device');

    expect(fs.readdirSync(path.dirname(dest))).toEqual([path.basename(dest)]);
  });

  it('keeps the destination when the final rename fails', async () => {
    fs.writeFileSync(dest, 'old');
    jest.spyOn(fs.promises, 'rename').mockRejectedValue(Object.assign(new Error('permission denied'), { code: 'EACCES' }));

    await expect(replaceFileWithRetries(src, dest)).rejects.toThrow('permission denied');

    expect(fs.readFileSync(dest, 'utf8')).toBe('old');
    expect(fs.readdirSync(path.dirname(dest))).toEqual([path.basename(dest)]);
  });
});
