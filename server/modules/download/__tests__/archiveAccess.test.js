/* eslint-env jest */
const { ArchiveAccess } = require('../archiveAccess');

describe('archive access', () => {
  let access;

  beforeEach(() => {
    access = new ArchiveAccess();
  });

  test('refuses a purge until the entire download and finalization finish', async () => {
    let finish;
    const download = access.withDownload(() => new Promise((resolve) => { finish = resolve; }));
    expect(() => access.acquirePurge()).toThrow(/active downloads/);
    finish();
    await download;
    const release = access.acquirePurge();
    release();
  });

  test('waits for the purge before starting a new download', async () => {
    const release = access.acquirePurge();
    const run = jest.fn().mockResolvedValue('complete');
    const download = access.withDownload(run);
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    release();
    await expect(download).resolves.toBe('complete');
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('reports whether a download is active', async () => {
    let finish;
    expect(access.isDownloading()).toBe(false);
    const download = access.withDownload(() => new Promise((resolve) => { finish = resolve; }));
    expect(access.isDownloading()).toBe(true);
    finish();
    await download;
    expect(access.isDownloading()).toBe(false);
  });

  test('releases access even when a download throws', async () => {
    await expect(access.withDownload(async () => { throw new Error('failed'); })).rejects.toThrow('failed');
    const release = access.acquirePurge();
    release();
  });

  test('keeps the archive occupied until every overlapping download finishes', async () => {
    let finish;
    const first = access.withDownload(() => new Promise((resolve) => { finish = resolve; }));
    await access.withDownload(async () => {});
    expect(() => access.acquirePurge()).toThrow(/active downloads/);
    finish();
    await first;
    const release = access.acquirePurge();
    release();
  });
});
