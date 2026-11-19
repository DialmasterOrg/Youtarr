/* eslint-env jest */
const path = require('path');

// `mock` prefix: jest hoists the factory above this declaration and only lets it see mock* variables.
const mockModels = { Video: { findAll: jest.fn() } };

jest.mock('../../models', () => mockModels);
jest.mock('../archiveModule', () => ({ readCompleteListLines: jest.fn() }));
jest.mock('../configModule', () => ({ getJobsPath: () => '/app/jobs' }));
jest.mock('fs', () => ({ promises: { readdir: jest.fn(), stat: jest.fn(), unlink: jest.fn() } }));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const fs = require('fs');
const { Video } = require('../../models');
const archiveModule = require('../archiveModule');
const logger = require('../../logger');
const pruner = require('../infoJsonCachePruner');

const NOW = Date.parse('2026-11-04T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const INFO_DIR = path.join('/app/jobs', 'info');
const infoPath = (youtubeId) => path.join(INFO_DIR, `${youtubeId}.info.json`);
const errorWithCode = (code) => Object.assign(new Error(code), { code });

// files: { '<name>': age in days }
function givenFiles(files) {
  fs.promises.readdir.mockResolvedValue(Object.keys(files));
  fs.promises.stat.mockImplementation(async (filePath) => {
    const name = path.basename(filePath);
    if (!(name in files)) throw errorWithCode('ENOENT');
    return { mtimeMs: NOW - files[name] * DAY_MS };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Video.findAll.mockResolvedValue([]);
  archiveModule.readCompleteListLines.mockReturnValue([]);
  fs.promises.unlink.mockResolvedValue(undefined);
});

describe('pruneUntracked', () => {
  test('removes the file of a never-downloaded video once it is older than the threshold', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 22 });

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).toHaveBeenCalledWith(infoPath('aaaaaaaaaaa'));
    expect(result).toEqual({ scanned: 1, removed: 1, failed: 0 });
  });

  test('keeps a recently cached file so reopening the video stays fast', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 20 });

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, removed: 0, failed: 0 });
  });

  test('does not look up videos whose file is recent', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 2 });

    await pruner.pruneUntracked({ now: NOW });

    expect(Video.findAll).not.toHaveBeenCalled();
    expect(archiveModule.readCompleteListLines).not.toHaveBeenCalled();
  });

  test('keeps the file of a video that has a Videos row', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30, 'bbbbbbbbbbb.info.json': 30 });
    Video.findAll.mockResolvedValue([{ youtubeId: 'aaaaaaaaaaa' }]);

    await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect(fs.promises.unlink).toHaveBeenCalledWith(infoPath('bbbbbbbbbbb'));
  });

  test('keeps a file the download archive lists, which library repair rebuilds the row from', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30, 'bbbbbbbbbbb.info.json': 30 });
    archiveModule.readCompleteListLines.mockReturnValue(['youtube aaaaaaaaaaa']);

    await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect(fs.promises.unlink).toHaveBeenCalledWith(infoPath('bbbbbbbbbbb'));
  });

  test('only considers <youtube id>.info.json files', async () => {
    givenFiles({ 'default.info.json': 30, '.DS_Store': 30, 'aaaaaaaaaaa.json': 30, 'aaaaaaaaaaa.info.json.bak': 30 });

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.stat).not.toHaveBeenCalled();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, removed: 0, failed: 0 });
  });

  test('reports an empty run when the folder does not exist yet', async () => {
    fs.promises.readdir.mockRejectedValue(errorWithCode('ENOENT'));

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(result).toEqual({ scanned: 0, removed: 0, failed: 0 });
  });

  test('removes nothing when the database lookup fails', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30 });
    Video.findAll.mockRejectedValue(new Error('db down'));

    await expect(pruner.pruneUntracked({ now: NOW })).rejects.toThrow('db down');

    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  test('removes nothing when the download archive cannot be read', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30 });
    archiveModule.readCompleteListLines.mockImplementation(() => { throw errorWithCode('EACCES'); });

    await expect(pruner.pruneUntracked({ now: NOW })).rejects.toThrow('EACCES');

    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  test('counts a file it could not remove and keeps going', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30, 'bbbbbbbbbbb.info.json': 30, 'ccccccccccc.info.json': 30 });
    fs.promises.unlink.mockImplementation(async (filePath) => {
      if (filePath === infoPath('aaaaaaaaaaa')) throw errorWithCode('EACCES');
      if (filePath === infoPath('bbbbbbbbbbb')) throw errorWithCode('ENOENT');
    });

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(result).toEqual({ scanned: 3, removed: 1, failed: 1 });
  });

  test('counts a file it could not check and leaves it alone', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30 });
    fs.promises.stat.mockRejectedValue(errorWithCode('EACCES'));

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, removed: 0, failed: 1 });
  });

  test('treats a file removed since the folder was listed as gone, not failed', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30 });
    fs.promises.stat.mockRejectedValue(errorWithCode('ENOENT'));

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, removed: 0, failed: 0 });
  });

  test('keeps a file rewritten after the age check, as a download finishing meanwhile does', async () => {
    givenFiles({ 'aaaaaaaaaaa.info.json': 30 });
    fs.promises.stat
      .mockResolvedValueOnce({ mtimeMs: NOW - 30 * DAY_MS })
      .mockResolvedValueOnce({ mtimeMs: NOW });

    const result = await pruner.pruneUntracked({ now: NOW });

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, removed: 0, failed: 0 });
  });

  test('looks videos up in chunks', async () => {
    const files = {};
    for (let i = 0; i < 501; i++) {
      files[`${String(i).padStart(11, '0')}.info.json`] = 30;
    }
    givenFiles(files);

    await pruner.pruneUntracked({ now: NOW });

    expect(Video.findAll).toHaveBeenCalledTimes(2);
    expect(fs.promises.unlink).toHaveBeenCalledTimes(501);
  });

  test('skips a run that overlaps another', async () => {
    let finishFirst;
    fs.promises.readdir.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    const first = pruner.pruneUntracked({ now: NOW });

    const second = await pruner.pruneUntracked({ now: NOW });

    expect(second).toEqual({ skipped: true, reason: 'already-running' });
    finishFirst([]);
    await expect(first).resolves.toEqual({ scanned: 0, removed: 0, failed: 0 });
  });

  test('runs again after a failed run', async () => {
    fs.promises.readdir.mockRejectedValueOnce(errorWithCode('EACCES'));
    await expect(pruner.pruneUntracked({ now: NOW })).rejects.toThrow('EACCES');

    givenFiles({});
    const result = await pruner.pruneUntracked({ now: NOW });

    expect(result).toEqual({ scanned: 0, removed: 0, failed: 0 });
  });
});
