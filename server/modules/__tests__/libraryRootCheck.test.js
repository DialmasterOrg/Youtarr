/* eslint-env jest */
const path = require('path');
const { LIBRARY_CHECK_REASONS, checkLibraryRoot, describeLibraryCheck } = require('../libraryRootCheck');

const ROOT = '/data/youtube';

const dir = (name) => ({ name, isDirectory: () => true });
const file = (name) => ({ name, isDirectory: () => false });
const fsError = (code) => Object.assign(new Error(code), { code });

// A fake disk: readdir answers per path, with a thrown error code or a listing.
const diskWith = (listings) => async (dirPath) => {
  const entry = listings[dirPath];
  if (entry === undefined) throw fsError('ENOENT');
  if (typeof entry === 'string') throw fsError(entry);
  return entry;
};

describe('checkLibraryRoot', () => {
  test('passes for a root that has files and non-empty subfolders', async () => {
    const readdir = diskWith({
      [ROOT]: [dir('Channel A'), dir('__Music'), file('.keep')],
      [path.join(ROOT, '__Music')]: [dir('Artist')],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({ ok: true });
  });

  test('fails as missing when the root does not exist', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({}) });
    expect(result).toEqual({
      ok: false,
      reason: LIBRARY_CHECK_REASONS.MISSING,
      path: ROOT,
      message: 'The downloads folder /data/youtube does not exist.',
    });
  });

  test('fails as missing when the root path is not a directory', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: 'ENOTDIR' }) });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'missing', path: ROOT }));
  });

  test('fails as unreadable when the root cannot be listed', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: 'EACCES' }) });
    expect(result).toEqual({
      ok: false,
      reason: 'unreadable',
      path: ROOT,
      message: 'The downloads folder /data/youtube could not be read.',
    });
  });

  test('fails as empty when the root has no entries at all', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: [] }) });
    expect(result).toEqual({
      ok: false,
      reason: 'empty',
      path: ROOT,
      message: 'The downloads folder /data/youtube is empty.',
    });
  });

  test('fails when a __subfolder exists but is empty, naming that subfolder', async () => {
    const music = path.join(ROOT, '__Music');
    const readdir = diskWith({
      [ROOT]: [dir('Channel A'), dir('__Music')],
      [music]: [],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({
      ok: false,
      reason: 'subfolder-empty',
      path: music,
      message: 'The subfolder /data/youtube/__Music is empty.',
    });
  });

  test('only checks __ folders: an empty channel folder is fine', async () => {
    const readdir = diskWith({
      [ROOT]: [dir('Channel A'), dir('__Music')],
      [path.join(ROOT, 'Channel A')]: [],
      [path.join(ROOT, '__Music')]: [file('song [abc].mp3')],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({ ok: true });
  });

  test('ignores a __subfolder that vanished between the two listings', async () => {
    const readdir = diskWith({ [ROOT]: [dir('__Music'), file('a [abc].mp4')] });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({ ok: true });
  });

  test('fails as unreadable when a __subfolder cannot be listed', async () => {
    const music = path.join(ROOT, '__Music');
    const readdir = diskWith({ [ROOT]: [dir('__Music')], [music]: 'EIO' });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'unreadable', path: music })
    );
  });

  test('treats no configured folder as missing', async () => {
    const readdir = jest.fn();
    await expect(checkLibraryRoot('', { readdir })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'missing' })
    );
    expect(readdir).not.toHaveBeenCalled();
  });
});

describe('describeLibraryCheck', () => {
  test('describes each reason in one sentence', () => {
    expect(describeLibraryCheck({ reason: 'missing', path: '/d' })).toBe('The downloads folder /d does not exist.');
    expect(describeLibraryCheck({ reason: 'empty', path: '/d' })).toBe('The downloads folder /d is empty.');
    expect(describeLibraryCheck({ reason: 'unreadable', path: '/d' })).toBe('The downloads folder /d could not be read.');
    expect(describeLibraryCheck({ reason: 'subfolder-empty', path: '/d/__Music' })).toBe('The subfolder /d/__Music is empty.');
  });
});
