/* eslint-env jest */
jest.mock('../../logger');
const path = require('path');
const { Op } = require('sequelize');
const {
  LIBRARY_CHECK_REASONS, checkLibraryRoot, describeLibraryCheck, isUnderLibraryCheckPath, isRowUnderLibraryCheck, libraryCheckCoversRows,
} = require('../libraryRootCheck');

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
      message: 'The downloads folder does not exist.',
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
      message: 'The downloads folder could not be read.',
    });
  });

  test('fails as empty when the root has no entries at all', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: [] }) });
    expect(result).toEqual({
      ok: false,
      reason: 'empty',
      path: ROOT,
      message: 'The downloads folder is empty.',
    });
  });

  test('reports empty when the root holds only Youtarr\'s temp folder', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: [dir('.youtarr_tmp')] }) });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'empty', path: ROOT }));
  });

  test('reports empty when the root holds only the Sonarr/Radarr staging folder', async () => {
    const result = await checkLibraryRoot(ROOT, { readdir: diskWith({ [ROOT]: [dir('.arr-staging')] }) });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'empty', path: ROOT }));
  });

  test('reports empty when the root holds only entries Youtarr itself creates', async () => {
    const readdir = diskWith({
      [ROOT]: [dir('.youtarr_tmp'), dir('__playlists__'), file('.youtarr_healthcheck_1234')],
      [path.join(ROOT, '__playlists__')]: [],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'empty', path: ROOT })
    );
  });

  test('does not treat the playlists folder as a library subfolder', async () => {
    const readdir = diskWith({
      [ROOT]: [dir('Channel A'), dir('__playlists__')],
      [path.join(ROOT, '__playlists__')]: [],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({ ok: true });
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
      paths: [music],
      message: 'The subfolder __Music is empty.',
    });
  });

  // Two shares can be down at once (a NAS reboot); each must stay protected.
  test('reports every failing subfolder, not just the first', async () => {
    const music = path.join(ROOT, '__Music');
    const kids = path.join(ROOT, '__Kids');
    const readdir = diskWith({
      [ROOT]: [dir('Channel A'), dir('__Music'), dir('__Kids')],
      [music]: [],
      [kids]: [],
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({
      ok: false,
      reason: 'subfolder-empty',
      path: music,
      paths: [music, kids],
      message: 'The subfolders __Music and __Kids are empty.',
    });
  });

  // An unreadable share must never be looked past as "emptied on purpose".
  test('reports the strictest reason when one subfolder is empty and another unreadable', async () => {
    const music = path.join(ROOT, '__Music');
    const kids = path.join(ROOT, '__Kids');
    const readdir = diskWith({
      [ROOT]: [dir('__Music'), dir('__Kids')],
      [music]: [],
      [kids]: 'EIO',
    });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({
      ok: false,
      reason: 'subfolder-unreadable',
      path: kids,
      paths: [music, kids],
      message: 'The subfolder __Music is empty. The subfolder __Kids could not be read.',
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

  test('fails as subfolder-unreadable when a __subfolder cannot be listed, naming that subfolder', async () => {
    const music = path.join(ROOT, '__Music');
    const readdir = diskWith({ [ROOT]: [dir('__Music')], [music]: 'EIO' });
    await expect(checkLibraryRoot(ROOT, { readdir })).resolves.toEqual({
      ok: false,
      reason: 'subfolder-unreadable',
      path: music,
      paths: [music],
      message: 'The subfolder __Music could not be read.',
    });
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
  // The container path (/usr/src/app/data) means nothing on the host, so the
  // root is "the downloads folder" and a subfolder goes by its own name.
  test('describes each reason in one sentence, without the container path', () => {
    expect(describeLibraryCheck({ reason: 'missing', path: '/d' })).toBe('The downloads folder does not exist.');
    expect(describeLibraryCheck({ reason: 'empty', path: '/d' })).toBe('The downloads folder is empty.');
    expect(describeLibraryCheck({ reason: 'unreadable', path: '/d' })).toBe('The downloads folder could not be read.');
    expect(describeLibraryCheck({ reason: 'not-found', path: '/d' })).toBe(
      'Most downloaded videos are not where Youtarr saved them; if you moved files inside the downloads folder, run a rescan.'
    );
    expect(describeLibraryCheck({ reason: 'subfolder-empty', path: '/d/__Music' })).toBe('The subfolder __Music is empty.');
    expect(describeLibraryCheck({ reason: 'subfolder-unreadable', path: '/d/__Music' })).toBe('The subfolder __Music could not be read.');
  });
});

describe('isUnderLibraryCheckPath', () => {
  const music = path.join(ROOT, '__Music');

  test('a failing root covers every file path', () => {
    expect(isUnderLibraryCheckPath({ ok: false, reason: 'empty', path: ROOT }, '/data/youtube/Channel/v [abc].mp4')).toBe(true);
    expect(isUnderLibraryCheckPath({ ok: false, reason: 'missing', path: ROOT }, '/elsewhere/v [abc].mp4')).toBe(true);
  });

  test('a failing subfolder covers only the files under it', () => {
    const check = { ok: false, reason: 'subfolder-empty', path: music };
    expect(isUnderLibraryCheckPath(check, path.join(music, 'Artist', 'song [abc].mp3'))).toBe(true);
    expect(isUnderLibraryCheckPath(check, path.join(ROOT, '__Music2', 'song [abc].mp3'))).toBe(false);
    expect(isUnderLibraryCheckPath(check, path.join(ROOT, 'Channel', 'v [abc].mp4'))).toBe(false);
  });

  test('every failing subfolder covers the files under it', () => {
    const kids = path.join(ROOT, '__Kids');
    const check = { ok: false, reason: 'subfolder-empty', path: music, paths: [music, kids] };
    expect(isUnderLibraryCheckPath(check, path.join(kids, 'Channel', 'v [abc].mp4'))).toBe(true);
    expect(isUnderLibraryCheckPath(check, path.join(music, 'Artist', 'song [abc].mp3'))).toBe(true);
    expect(isUnderLibraryCheckPath(check, path.join(ROOT, '__Videos', 'Channel', 'v [abc].mp4'))).toBe(false);
  });

  test('a passing check and a video without a file path cover nothing', () => {
    expect(isUnderLibraryCheckPath({ ok: true }, '/data/youtube/Channel/v [abc].mp4')).toBe(false);
    expect(isUnderLibraryCheckPath({ ok: false, reason: 'empty', path: ROOT }, null)).toBe(false);
  });
});

describe('isRowUnderLibraryCheck', () => {
  const music = path.join(ROOT, '__Music');
  const check = { ok: false, reason: 'subfolder-empty', path: music };

  test('covers a row whose video file is under the failing subfolder', () => {
    expect(isRowUnderLibraryCheck(check, { filePath: path.join(music, 'Artist', 'v [abc].mp4'), audioFilePath: null })).toBe(true);
  });

  test('covers a row whose audio file is under the failing subfolder', () => {
    expect(isRowUnderLibraryCheck(check, { filePath: null, audioFilePath: path.join(music, 'Artist', 'v [abc].mp3') })).toBe(true);
  });

  test('leaves a row stored elsewhere alone', () => {
    expect(isRowUnderLibraryCheck(check, { filePath: path.join(ROOT, '__Videos', 'Channel', 'v [abc].mp4'), audioFilePath: null })).toBe(false);
  });
});

describe('libraryCheckCoversRows', () => {
  const music = path.join(ROOT, '__Music');
  const present = { removed: false };
  const videoModel = (count) => ({ count: jest.fn().mockResolvedValue(count) });

  test('a passing check covers nothing and reads no rows', async () => {
    const Video = videoModel(5);
    await expect(libraryCheckCoversRows({ ok: true }, Video, present)).resolves.toBe(false);
    expect(Video.count).not.toHaveBeenCalled();
  });

  test('a failing root covers every row the filter matches', async () => {
    const Video = videoModel(3);
    await expect(libraryCheckCoversRows({ ok: false, reason: 'empty', path: ROOT }, Video, present)).resolves.toBe(true);
    expect(Video.count).toHaveBeenCalledWith({ where: present });
  });

  test('a failing root with no matching rows covers nothing', async () => {
    await expect(libraryCheckCoversRows({ ok: false, reason: 'empty', path: ROOT }, videoModel(0), present)).resolves.toBe(false);
  });

  test('a failing subfolder covers only rows stored under it, matching its name literally', async () => {
    const Video = videoModel(0);
    const check = { ok: false, reason: 'subfolder-empty', path: music };

    await expect(libraryCheckCoversRows(check, Video, present)).resolves.toBe(false);

    // `_` is a LIKE wildcard, and every subfolder name starts with two of them.
    const prefix = `${ROOT}/\\_\\_Music/%`;
    expect(Video.count).toHaveBeenCalledWith({
      where: {
        [Op.and]: [
          present,
          { [Op.or]: [{ filePath: { [Op.like]: prefix } }, { audioFilePath: { [Op.like]: prefix } }] },
        ],
      },
    });
  });

  test('covers rows under any of several failing subfolders', async () => {
    const Video = videoModel(1);
    const kids = path.join(ROOT, '__Kids');
    const check = { ok: false, reason: 'subfolder-empty', path: music, paths: [music, kids] };

    await expect(libraryCheckCoversRows(check, Video, present)).resolves.toBe(true);

    const musicPrefix = `${ROOT}/\\_\\_Music/%`;
    const kidsPrefix = `${ROOT}/\\_\\_Kids/%`;
    expect(Video.count).toHaveBeenCalledWith({
      where: {
        [Op.and]: [
          present,
          {
            [Op.or]: [
              { filePath: { [Op.like]: musicPrefix } }, { audioFilePath: { [Op.like]: musicPrefix } },
              { filePath: { [Op.like]: kidsPrefix } }, { audioFilePath: { [Op.like]: kidsPrefix } },
            ],
          },
        ],
      },
    });
  });
});

describe('checkLibraryAvailable', () => {
  let checkLibraryAvailable;
  let forgetStoredFilesProbe;
  const mountedRoot = diskWith({ [ROOT]: [dir('Channel A')] });
  const fileStat = { isFile: () => true };
  const storedAt = (n) => Array.from({ length: n }, (_, i) => ({ filePath: `${ROOT}/Channel A/v${i} [id${i}].mp4`, audioFilePath: null }));
  const videoModel = (rows) => ({ findAll: jest.fn().mockResolvedValue(rows), sequelize: { random: () => 'RAND()' } });
  // A stat that finds the first `present` of the given rows' files.
  const statFinding = (rows, present) => jest.fn(async (filePath) => {
    const index = rows.findIndex((row) => row.filePath === filePath);
    if (index >= 0 && index < present) return fileStat;
    throw fsError('ENOENT');
  });

  beforeEach(() => {
    // The probe caches its answer per folder; each test starts without one.
    jest.isolateModules(() => {
      ({ checkLibraryAvailable, forgetStoredFilesProbe } = require('../libraryRootCheck'));
    });
  });

  test('returns a failing root check without probing', async () => {
    const Video = videoModel(storedAt(20));
    const result = await checkLibraryAvailable(ROOT, Video, { readdir: diskWith({ [ROOT]: [] }) });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'empty' }));
    expect(Video.findAll).not.toHaveBeenCalled();
  });

  test('samples present videos stored under the root, at random', async () => {
    const rows = storedAt(20);
    const Video = videoModel(rows);
    await checkLibraryAvailable(ROOT, Video, { readdir: mountedRoot, stat: statFinding(rows, 20) });

    const prefix = `${ROOT}/%`;
    expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { removed: false, [Op.or]: [{ filePath: { [Op.like]: prefix } }, { audioFilePath: { [Op.like]: prefix } }] },
      order: 'RAND()',
      limit: 20,
    }));
  });

  test('passes when at least half of the sampled videos are on disk', async () => {
    const rows = storedAt(20);
    const result = await checkLibraryAvailable(ROOT, videoModel(rows), { readdir: mountedRoot, stat: statFinding(rows, 10) });
    expect(result).toEqual({ ok: true });
  });

  test('fails as not-found when most sampled videos are gone from a folder that is not empty', async () => {
    const rows = storedAt(20);
    const result = await checkLibraryAvailable(ROOT, videoModel(rows), { readdir: mountedRoot, stat: statFinding(rows, 2) });
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: LIBRARY_CHECK_REASONS.NOT_FOUND, path: ROOT }));
  });

  test('looks again once a rescan has made its cached answer stale', async () => {
    const rows = storedAt(20);
    const Video = videoModel(rows);
    await checkLibraryAvailable(ROOT, Video, { readdir: mountedRoot, stat: statFinding(rows, 0) });

    forgetStoredFilesProbe();
    const result = await checkLibraryAvailable(ROOT, Video, { readdir: mountedRoot, stat: statFinding(rows, 20) });

    expect(result).toEqual({ ok: true });
    expect(Video.findAll).toHaveBeenCalledTimes(2);
  });

  test('counts a video whose audio file is still there as found', async () => {
    const rows = storedAt(10).map((row) => ({ ...row, audioFilePath: row.filePath.replace('.mp4', '.mp3') }));
    const stat = jest.fn(async (filePath) => {
      if (filePath.endsWith('.mp3')) return fileStat;
      throw fsError('ENOENT');
    });
    await expect(checkLibraryAvailable(ROOT, videoModel(rows), { readdir: mountedRoot, stat })).resolves.toEqual({ ok: true });
  });

  test('passes with too few videos to judge', async () => {
    const rows = storedAt(9);
    const result = await checkLibraryAvailable(ROOT, videoModel(rows), { readdir: mountedRoot, stat: statFinding(rows, 0) });
    expect(result).toEqual({ ok: true });
  });

  test('leaves files that could not be checked out of the judgement', async () => {
    const rows = storedAt(20);
    // 12 unreadable, 3 found, 5 gone: only 8 definite answers, too few to judge.
    const stat = jest.fn(async (filePath) => {
      const index = rows.findIndex((row) => row.filePath === filePath);
      if (index < 12) throw fsError('EACCES');
      if (index < 15) return fileStat;
      throw fsError('ENOENT');
    });
    await expect(checkLibraryAvailable(ROOT, videoModel(rows), { readdir: mountedRoot, stat })).resolves.toEqual({ ok: true });
  });

  test('reuses its answer for a while, then probes again', async () => {
    const rows = storedAt(20);
    const Video = videoModel(rows);
    let clock = 1000;
    const deps = { readdir: mountedRoot, stat: statFinding(rows, 0), now: () => clock };

    await checkLibraryAvailable(ROOT, Video, deps);
    clock += 29 * 1000;
    await expect(checkLibraryAvailable(ROOT, Video, deps)).resolves.toEqual(expect.objectContaining({ reason: 'not-found' }));
    expect(Video.findAll).toHaveBeenCalledTimes(1);

    clock += 2 * 1000;
    await checkLibraryAvailable(ROOT, Video, deps);
    expect(Video.findAll).toHaveBeenCalledTimes(2);
  });

  test('passes, without remembering it, when the sample cannot be read', async () => {
    const Video = { findAll: jest.fn().mockRejectedValue(new Error('db down')), sequelize: { random: () => 'RAND()' } };
    await expect(checkLibraryAvailable(ROOT, Video, { readdir: mountedRoot })).resolves.toEqual({ ok: true });
    await checkLibraryAvailable(ROOT, Video, { readdir: mountedRoot });
    expect(Video.findAll).toHaveBeenCalledTimes(2);
  });
});

describe('countRowsUnderLibraryCheck', () => {
  const { countRowsUnderLibraryCheck } = require('../libraryRootCheck');

  test('counts nothing for a passing check', async () => {
    const Video = { count: jest.fn() };
    await expect(countRowsUnderLibraryCheck({ ok: true }, Video, { removed: false })).resolves.toBe(0);
    expect(Video.count).not.toHaveBeenCalled();
  });

  test('counts every matching row for a failing root', async () => {
    const Video = { count: jest.fn().mockResolvedValue(16800) };
    await expect(countRowsUnderLibraryCheck({ ok: false, reason: 'empty', path: ROOT }, Video, { removed: false })).resolves.toBe(16800);
    expect(Video.count).toHaveBeenCalledWith({ where: { removed: false } });
  });
});

describe('downloadsFolderBlock', () => {
  const { notStateWhere } = require('../videoRemovalState');
  const fileStat = { isFile: () => true };
  let downloadsFolderBlock;

  beforeEach(() => {
    jest.isolateModules(() => {
      ({ downloadsFolderBlock } = require('../libraryRootCheck'));
    });
  });

  // The real check reads the disk through fs; these tests point it at a fake root.
  const withDisk = (listing) => {
    const fs = require('fs');
    jest.spyOn(fs.promises, 'readdir').mockImplementation(diskWith(listing));
    jest.spyOn(fs.promises, 'stat').mockResolvedValue(fileStat);
  };
  afterEach(() => jest.restoreAllMocks());

  test('holds downloads while the downloads folder is empty and videos are on record', async () => {
    withDisk({ [ROOT]: [] });
    const Video = { count: jest.fn().mockResolvedValue(3) };

    await expect(downloadsFolderBlock(ROOT, Video)).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'empty' }));
  });

  test('lets a fresh install download into an empty folder', async () => {
    withDisk({ [ROOT]: [] });
    await expect(downloadsFolderBlock(ROOT, { count: jest.fn().mockResolvedValue(0) })).resolves.toBeNull();
  });

  test('never holds downloads for a subfolder', async () => {
    withDisk({ [ROOT]: [dir('Channel'), dir('__Music')], [path.join(ROOT, '__Music')]: [] });
    const Video = {
      count: jest.fn().mockResolvedValue(3),
      findAll: jest.fn().mockResolvedValue([]),
      sequelize: { random: () => 'RAND()' },
    };
    await expect(downloadsFolderBlock(ROOT, Video)).resolves.toBeNull();
  });

  test('counts videos that are present or missing, not deleted ones', async () => {
    withDisk({ [ROOT]: [] });
    const Video = { count: jest.fn().mockResolvedValue(1) };

    await downloadsFolderBlock(ROOT, Video);

    expect(Video.count).toHaveBeenCalledWith({ where: notStateWhere('deleted') });
  });
});
