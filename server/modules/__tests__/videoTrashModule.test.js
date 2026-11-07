/* eslint-env jest */
const { Op } = require('sequelize');

// `mock` prefix: jest hoists the factory above this declaration and only lets it see mock* variables.
const mockModels = {
  Video: { count: jest.fn(), update: jest.fn(), findAll: jest.fn(), destroy: jest.fn() },
  JobVideo: { findAll: jest.fn(), destroy: jest.fn() },
  VideoWatchStatus: { destroy: jest.fn() },
  PlaylistVideo: { update: jest.fn() },
};

jest.mock('../../models', () => mockModels);
jest.mock('../../db.js', () => ({
  sequelize: { transaction: jest.fn(async (fn) => fn('tx')) },
}));
jest.mock('../libraryRootCheck', () => ({ ...jest.requireActual('../libraryRootCheck'), checkLibraryRoot: jest.fn() }));
jest.mock('../configModule', () => ({
  directoryPath: '/data/youtube',
  getJobsPath: () => '/app/jobs',
  getImagePath: () => '/app/images',
}));
jest.mock('../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../archiveModule', () => ({ removeVideosFromArchive: jest.fn() }));
jest.mock('fs', () => ({ promises: { unlink: jest.fn() } }));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { Video, JobVideo, VideoWatchStatus, PlaylistVideo } = require('../../models');
const { sequelize } = require('../../db.js');
const { checkLibraryRoot } = require('../libraryRootCheck');
const messageEmitter = require('../messageEmitter');
const archiveModule = require('../archiveModule');
const archiveAccess = require('../download/archiveAccess');
const fs = require('fs');
const { stateWhere } = require('../videoRemovalState');
const videoTrashModule = require('../videoTrashModule');
const { LibraryUnavailableError, PurgeRunningError } = videoTrashModule;

const LIBRARY_OK = { ok: true };
const LIBRARY_EMPTY = { ok: false, reason: 'empty', path: '/data/youtube', message: 'The downloads folder is empty.' };
const LIBRARY_MISSING = { ok: false, reason: 'missing', path: '/data/youtube', message: 'The downloads folder does not exist.' };
const SUBFOLDER_EMPTY = { ok: false, reason: 'subfolder-empty', path: '/data/youtube/__Kids', message: 'The subfolder __Kids is empty.' };
// A Video.count for a library of `total` videos with none stored under a
// failing subfolder: a count scoped to the subfolder (an Op.and) finds nothing.
const countNoneUnderSubfolder = (total) => async ({ where }) => (where[Op.and] ? 0 : total);
// A Video.count for a failing subfolder that holds present videos but no
// missing ones: a subfolder-scoped count of missing rows finds nothing.
const countOnlyPresentUnderSubfolder = (total) => async ({ where }) => {
  if (!where[Op.and]) return total;
  const [filter] = where[Op.and];
  return filter.removed_reason === 'not_found' ? 0 : 2;
};

beforeEach(() => {
  jest.clearAllMocks();
  checkLibraryRoot.mockResolvedValue(LIBRARY_OK);
  Video.update.mockResolvedValue([0]);
});

describe('getRemovedSummary', () => {
  test('counts deleted, missing, and legacy rows and reports the library check', async () => {
    Video.count
      .mockResolvedValueOnce(12) // deleted
      .mockResolvedValueOnce(4) // missing
      .mockResolvedValueOnce(3); // legacy

    const summary = await videoTrashModule.getRemovedSummary();

    expect(summary).toEqual({
      deleted: 12,
      missing: 4,
      legacy: 3,
      libraryCheck: { ok: true, reason: null, path: null, message: null },
      missingActionsBlocked: false,
      downloadsActive: false,
    });
    expect(Video.count).toHaveBeenNthCalledWith(1, { where: stateWhere('deleted') });
    expect(Video.count).toHaveBeenNthCalledWith(2, { where: stateWhere('missing') });
    expect(Video.count).toHaveBeenNthCalledWith(3, { where: { removed: true, removed_reason: null } });
  });

  test('says when a download is active, so the archive choice can be disabled up front', async () => {
    Video.count.mockResolvedValue(0);

    await archiveAccess.withDownload(async () => {
      const summary = await videoTrashModule.getRemovedSummary();
      expect(summary.downloadsActive).toBe(true);
    });
  });

  test('passes a failed library check through so the page can disable the missing actions', async () => {
    Video.count.mockResolvedValue(2);
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);

    const summary = await videoTrashModule.getRemovedSummary();

    expect(summary.libraryCheck).toEqual({ ok: false, reason: 'empty', path: '/data/youtube', message: LIBRARY_EMPTY.message });
    expect(summary.missingActionsBlocked).toBe(true);
    expect(checkLibraryRoot).toHaveBeenCalledWith('/data/youtube');
  });

  // The warning still shows (the Videos page banner sends people to Rescan
  // anyway), but marking and emptying missing videos stay open.
  test('warns about a failing subfolder that holds only present videos without blocking the missing actions', async () => {
    Video.count.mockImplementation(countOnlyPresentUnderSubfolder(5));
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);

    const summary = await videoTrashModule.getRemovedSummary();

    expect(summary.libraryCheck.ok).toBe(false);
    expect(summary.missingActionsBlocked).toBe(false);
  });

  test('reports the folder as fine when the failing subfolder holds no present or missing video', async () => {
    Video.count.mockImplementation(countNoneUnderSubfolder(5));
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);

    const summary = await videoTrashModule.getRemovedSummary();

    expect(summary.libraryCheck).toEqual({ ok: true, reason: null, path: null, message: null });
  });
});

describe('markMissingAsDeleted', () => {
  beforeEach(() => {
    Video.count.mockReset().mockResolvedValue(3); // videos on record, so a failing check covers some
  });

  test('marks only the selected rows that are missing, leaving present and deleted ones alone', async () => {
    Video.update.mockResolvedValue([2]);

    const result = await videoTrashModule.markMissingAsDeleted({ videoIds: [1, 2, 3] });

    expect(result).toEqual({ updated: 2 });
    expect(Video.update).toHaveBeenCalledWith(
      expect.objectContaining({ removed: true, removed_reason: 'marked_deleted', removed_at: expect.any(Date), removed_detail: null }),
      { where: { removed: true, removed_reason: 'not_found', id: [1, 2, 3] } },
    );
  });

  test('marks every missing row when asked for all', async () => {
    Video.update.mockResolvedValue([40]);

    const result = await videoTrashModule.markMissingAsDeleted({ all: true });

    expect(result).toEqual({ updated: 40 });
    expect(Video.update).toHaveBeenCalledWith(
      expect.objectContaining({ removed_reason: 'marked_deleted' }),
      { where: { removed: true, removed_reason: 'not_found' } },
    );
  });

  test('refuses to mark all while the downloads folder looks unmounted', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);

    await expect(videoTrashModule.markMissingAsDeleted({ all: true })).rejects.toBeInstanceOf(LibraryUnavailableError);
    await expect(videoTrashModule.markMissingAsDeleted({ all: true })).rejects.toMatchObject({
      code: 'LIBRARY_UNAVAILABLE',
      message: LIBRARY_EMPTY.message,
      libraryCheck: LIBRARY_EMPTY,
    });
    expect(Video.update).not.toHaveBeenCalled();
  });

  test('marks all while only an empty subfolder no video is stored in fails the check', async () => {
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);
    Video.count.mockImplementation(countNoneUnderSubfolder(3));
    Video.update.mockResolvedValue([2]);

    await expect(videoTrashModule.markMissingAsDeleted({ all: true })).resolves.toEqual({ updated: 2 });
  });

  test('marks all without asking while the failing subfolder holds present videos but no missing ones', async () => {
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);
    Video.count.mockImplementation(countOnlyPresentUnderSubfolder(3));
    Video.update.mockResolvedValue([2]);

    await expect(videoTrashModule.markMissingAsDeleted({ all: true })).resolves.toEqual({ updated: 2 });
  });

  test('marks all anyway when asked to, for a folder the user emptied on purpose', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);
    Video.update.mockResolvedValue([5]);

    await expect(videoTrashModule.markMissingAsDeleted({ all: true, ignoreLibraryCheck: true })).resolves.toEqual({ updated: 5 });
  });

  test('still refuses to mark all when the folder is gone, even when asked to ignore the check', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_MISSING);

    await expect(videoTrashModule.markMissingAsDeleted({ all: true, ignoreLibraryCheck: true }))
      .rejects.toBeInstanceOf(LibraryUnavailableError);
    expect(Video.update).not.toHaveBeenCalled();
  });

  test('still marks a chosen selection while the downloads folder looks unmounted', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);
    Video.update.mockResolvedValue([1]);

    await expect(videoTrashModule.markMissingAsDeleted({ videoIds: [7] })).resolves.toEqual({ updated: 1 });
  });

  test('tells listing pages to refresh when rows changed, and stays quiet when none did', async () => {
    Video.update.mockResolvedValueOnce([3]).mockResolvedValueOnce([0]);

    await videoTrashModule.markMissingAsDeleted({ videoIds: [1, 2, 3] });
    expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'videosUpdated', { source: 'mark-deleted', updated: 3 });

    messageEmitter.emitMessage.mockClear();
    await videoTrashModule.markMissingAsDeleted({ videoIds: [9] });
    expect(messageEmitter.emitMessage).not.toHaveBeenCalled();
  });

  test('exposes the Sequelize operators it builds its where with', () => {
    // The "deleted" count must include rows without a recorded reason.
    expect(stateWhere('deleted')[Op.or]).toEqual(expect.arrayContaining([{ removed_reason: null }]));
  });
});

describe('purgeRemoved', () => {
  const { Op } = require('sequelize');
  const rows = [
    { id: 1, youtubeId: 'aaaaaaaaaaa' },
    { id: 2, youtubeId: 'bbbbbbbbbbb' },
  ];
  const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

  beforeEach(() => {
    // mockReset: a queued chunk left over by a test that never reached findAll must not leak.
    // First call: the chunk's candidates; second: the same rows re-read under lock; then empty.
    Video.findAll.mockReset();
    Video.findAll.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows).mockResolvedValue([]);
    sequelize.transaction.mockReset().mockImplementation(async (fn) => fn('tx'));
    JobVideo.findAll.mockResolvedValue([{ job_id: 'job-1' }, { job_id: 'job-2' }, { job_id: 'job-1' }]);
    VideoWatchStatus.destroy.mockResolvedValue(2);
    JobVideo.destroy.mockResolvedValue(3);
    PlaylistVideo.update.mockResolvedValue([1]);
    Video.destroy.mockResolvedValue(2);
    fs.promises.unlink.mockResolvedValue(undefined);
    archiveModule.removeVideosFromArchive.mockResolvedValue(2);
    Video.count.mockReset().mockResolvedValue(3); // videos on record, so a failing check covers some
  });

  test('selects deleted rows only, including ones removed before the reason was recorded', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    const where = Video.findAll.mock.calls[0][0].where;
    expect(where[Op.or]).toEqual([stateWhere('deleted')]);
    expect(Video.findAll.mock.calls[0][0]).toEqual(expect.objectContaining({ attributes: ['id', 'youtubeId'], limit: 500 }));
  });

  test('selects both states when asked', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted', 'missing'], removeFromArchive: false });

    expect(Video.findAll.mock.calls[0][0].where[Op.or]).toEqual([stateWhere('deleted'), stateWhere('missing')]);
  });

  test('forgets every trace of the rows, in an order the foreign keys allow', async () => {
    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(VideoWatchStatus.destroy).toHaveBeenCalledWith({ where: { video_id: [1, 2] }, transaction: 'tx' });
    expect(JobVideo.destroy).toHaveBeenCalledWith({ where: { video_id: [1, 2] }, transaction: 'tx' });
    expect(PlaylistVideo.update).toHaveBeenCalledWith(
      { downloaded_at: null },
      { where: { youtube_id: ['aaaaaaaaaaa', 'bbbbbbbbbbb'] }, transaction: 'tx' }
    );
    // The destroy keeps the state predicate, so a row that became present in between survives.
    expect(Video.destroy).toHaveBeenCalledWith({ where: { id: [1, 2], [Op.or]: [stateWhere('deleted')] }, transaction: 'tx' });
    const order = [VideoWatchStatus.destroy, JobVideo.destroy, Video.destroy].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(result).toEqual({ purged: 2, archiveEntriesRemoved: 0, jobIds: ['job-1', 'job-2'] });
  });

  test('re-reads the chunk under lock inside the transaction before touching anything', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    expect(Video.findAll.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: { id: [1, 2], [Op.or]: [stateWhere('deleted')] },
      transaction: 'tx',
      lock: true,
    }));
    expect(Video.findAll.mock.invocationCallOrder[1]).toBeLessThan(VideoWatchStatus.destroy.mock.invocationCallOrder[0]);
  });

  test('keeps a video that came back (re-downloaded or restored) between the select and the transaction', async () => {
    Video.findAll.mockReset();
    Video.findAll
      .mockResolvedValueOnce(rows) // candidates
      .mockResolvedValueOnce([rows[0]]) // under lock, bbbbbbbbbbb is present again
      .mockResolvedValue([]);
    Video.destroy.mockResolvedValue(1);

    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true });

    expect(VideoWatchStatus.destroy).toHaveBeenCalledWith({ where: { video_id: [1] }, transaction: 'tx' });
    expect(JobVideo.destroy).toHaveBeenCalledWith({ where: { video_id: [1] }, transaction: 'tx' });
    expect(Video.destroy).toHaveBeenCalledWith({ where: { id: [1], [Op.or]: [stateWhere('deleted')] }, transaction: 'tx' });
    const unlinked = fs.promises.unlink.mock.calls.map(([p]) => p);
    expect(unlinked).toHaveLength(3);
    expect(unlinked.every((p) => p.includes('aaaaaaaaaaa'))).toBe(true);
    expect(archiveModule.removeVideosFromArchive).toHaveBeenCalledWith(['aaaaaaaaaaa']);
    expect(result.purged).toBe(1);
  });

  test('walks the trash in chunks until the selection comes back empty', async () => {
    const more = [{ id: 3, youtubeId: 'ccccccccccc' }, { id: 4, youtubeId: 'ddddddddddd' }];
    Video.findAll.mockReset();
    Video.findAll
      .mockResolvedValueOnce(rows).mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(more).mockResolvedValueOnce(more)
      .mockResolvedValue([]);

    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    expect(sequelize.transaction).toHaveBeenCalledTimes(2);
    expect(Video.destroy).toHaveBeenNthCalledWith(2, { where: { id: [3, 4], [Op.or]: [stateWhere('deleted')] }, transaction: 'tx' });
    expect(result.purged).toBe(4);
  });

  test('stops when a chunk has nothing left to forget under lock', async () => {
    Video.findAll.mockReset();
    Video.findAll.mockResolvedValueOnce(rows).mockResolvedValue([]); // under lock: every candidate is present again

    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true });

    expect(Video.destroy).not.toHaveBeenCalled();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(archiveModule.removeVideosFromArchive).not.toHaveBeenCalled();
    expect(result).toEqual({ purged: 0, archiveEntriesRemoved: 0, jobIds: [] });
  });

  test('refreshes the download history before telling it to refetch', async () => {
    const reloadJobVideos = jest.fn().mockResolvedValue(undefined);

    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false }, { reloadJobVideos });

    expect(reloadJobVideos).toHaveBeenCalledWith(['job-1', 'job-2']);
    const jobsUpdatedCall = messageEmitter.emitMessage.mock.calls.findIndex(([, , , type]) => type === 'jobsUpdated');
    expect(jobsUpdatedCall).toBeGreaterThanOrEqual(0);
    expect(reloadJobVideos.mock.invocationCallOrder[0]).toBeLessThan(messageEmitter.emitMessage.mock.invocationCallOrder[jobsUpdatedCall]);
  });

  test('still broadcasts when refreshing the download history fails', async () => {
    const reloadJobVideos = jest.fn().mockRejectedValue(new Error('boom'));

    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false }, { reloadJobVideos });

    expect(result.purged).toBe(2);
    expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'jobsUpdated', { source: 'purge' });
  });

  test('removes the cached info.json and thumbnails, so library repair cannot recreate the rows', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    const unlinked = fs.promises.unlink.mock.calls.map(([p]) => p);
    expect(unlinked).toEqual(expect.arrayContaining([
      '/app/jobs/info/aaaaaaaaaaa.info.json',
      '/app/images/videothumb-aaaaaaaaaaa.jpg',
      '/app/images/videothumb-aaaaaaaaaaa-small.jpg',
      '/app/jobs/info/bbbbbbbbbbb.info.json',
    ]));
    expect(unlinked).toHaveLength(6);
  });

  test('ignores files that are already gone', async () => {
    fs.promises.unlink.mockRejectedValue(enoent);

    await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false })).resolves.toEqual(
      expect.objectContaining({ purged: 2 })
    );
  });

  test('leaves the download archive alone unless asked', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });
    expect(archiveModule.removeVideosFromArchive).not.toHaveBeenCalled();
  });

  test('removes the archive entries for every purged video when asked', async () => {
    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true });

    expect(archiveModule.removeVideosFromArchive).toHaveBeenCalledTimes(1);
    expect(archiveModule.removeVideosFromArchive).toHaveBeenCalledWith(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(result.archiveEntriesRemoved).toBe(2);
  });

  test('tells the listing and history pages to refresh', async () => {
    await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });

    expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'videosUpdated', { source: 'purge', purged: 2 });
    expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'jobsUpdated', { source: 'purge' });
  });

  test('refuses to purge missing videos while the downloads folder looks unmounted, before touching anything', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);

    await expect(videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: false })).rejects.toBeInstanceOf(LibraryUnavailableError);
    expect(Video.destroy).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test('purges missing videos while only an empty subfolder no video is stored in fails the check', async () => {
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);
    Video.count.mockImplementation(countNoneUnderSubfolder(3));

    await expect(videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: false })).resolves.toEqual(
      expect.objectContaining({ purged: 2 })
    );
  });

  test('purges missing videos while the failing subfolder holds present videos but no missing ones', async () => {
    checkLibraryRoot.mockResolvedValue(SUBFOLDER_EMPTY);
    Video.count.mockImplementation(countOnlyPresentUnderSubfolder(3));

    await expect(videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: false })).resolves.toEqual(
      expect.objectContaining({ purged: 2 })
    );
  });

  test('still purges deleted videos while the downloads folder looks unmounted', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);

    await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false })).resolves.toEqual(
      expect.objectContaining({ purged: 2 })
    );
  });

  test('runs one purge at a time', async () => {
    let release;
    sequelize.transaction.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    const first = videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false });
    await new Promise((resolve) => setImmediate(resolve));
    expect(videoTrashModule.isPurgeRunning()).toBe(true);
    await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false })).rejects.toBeInstanceOf(PurgeRunningError);

    release([]); // the stalled transaction resolves to an empty confirmed chunk
    await first;
    expect(videoTrashModule.isPurgeRunning()).toBe(false);
  });

  test('runs one purge at a time while the first is still checking the downloads folder', async () => {
    let finishCheck;
    checkLibraryRoot.mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve; }));

    const first = videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: true });
    await expect(videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: true })).rejects.toBeInstanceOf(PurgeRunningError);

    finishCheck(LIBRARY_OK);
    await first;
  });

  test('releases the lock when the downloads folder looks unmounted', async () => {
    checkLibraryRoot.mockResolvedValue(LIBRARY_EMPTY);

    await expect(videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: false })).rejects.toBeInstanceOf(LibraryUnavailableError);
    expect(videoTrashModule.isPurgeRunning()).toBe(false);
  });

  test('releases the lock when a purge fails', async () => {
    sequelize.transaction.mockRejectedValueOnce(new Error('db down'));

    await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false })).rejects.toThrow('db down');
    expect(videoTrashModule.isPurgeRunning()).toBe(false);
  });

  describe('when a later chunk fails', () => {
    const more = [{ id: 3, youtubeId: 'ccccccccccc' }];

    beforeEach(() => {
      Video.findAll.mockReset();
      Video.findAll.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows).mockResolvedValueOnce(more).mockResolvedValue([]);
      sequelize.transaction
        .mockImplementationOnce(async (fn) => fn('tx'))
        .mockRejectedValueOnce(new Error('lock wait timeout'));
    });

    test('still removes the committed chunks from the download archive, then reports the failure', async () => {
      await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true })).rejects.toThrow('lock wait timeout');

      expect(archiveModule.removeVideosFromArchive).toHaveBeenCalledWith(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    });

    test('still refreshes the download history for the committed chunks', async () => {
      const reloadJobVideos = jest.fn().mockResolvedValue(undefined);

      await expect(
        videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false }, { reloadJobVideos })
      ).rejects.toThrow('lock wait timeout');

      expect(reloadJobVideos).toHaveBeenCalledWith(['job-1', 'job-2']);
    });

    test('still tells the listing and history pages to refresh', async () => {
      await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false })).rejects.toThrow('lock wait timeout');

      expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'videosUpdated', { source: 'purge', purged: 2 });
      expect(messageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'videos', 'jobsUpdated', { source: 'purge' });
    });
  });

  test('rolls back an archive failure so the same rows can be purged on retry', async () => {
    // Model transaction rollback explicitly: failed transactions restore rows.
    let remaining = [...rows];
    let inTransaction = false;
    Video.findAll.mockReset().mockImplementation(async () => [...remaining]);
    Video.destroy.mockImplementation(async () => { remaining = []; return 2; });
    sequelize.transaction.mockImplementation(async (fn) => {
      const before = [...remaining];
      inTransaction = true;
      try {
        return await fn('tx');
      } catch (err) {
        remaining = before;
        throw err;
      } finally {
        inTransaction = false;
      }
    });
    archiveModule.removeVideosFromArchive.mockImplementationOnce(async () => {
      expect(inTransaction).toBe(true);
      throw new Error('EACCES');
    });
    const reloadJobVideos = jest.fn().mockResolvedValue(undefined);

    await expect(
      videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true }, { reloadJobVideos })
    ).rejects.toThrow('EACCES');

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    const result = await videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true }, { reloadJobVideos });
    expect(result).toEqual({ purged: 2, archiveEntriesRemoved: 2, jobIds: ['job-1', 'job-2'] });
    expect(archiveModule.removeVideosFromArchive).toHaveBeenNthCalledWith(2, ['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  test('refuses archive removal during a download before deleting any rows', async () => {
    await archiveAccess.withDownload(async () => {
      await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true }))
        .rejects.toMatchObject({ code: 'ARCHIVE_BUSY' });
      expect(Video.destroy).not.toHaveBeenCalled();
    });
    await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: true }))
      .resolves.toMatchObject({ purged: 2 });
  });

  test('allows a purge that keeps the archive during a download', async () => {
    await archiveAccess.withDownload(async () => {
      await expect(videoTrashModule.purgeRemoved({ states: ['deleted'], removeFromArchive: false }))
        .resolves.toMatchObject({ purged: 2 });
    });
  });

  test('releases waiting downloads after a purge fails its library check', async () => {
    let finishCheck;
    checkLibraryRoot.mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve; }));
    const purge = videoTrashModule.purgeRemoved({ states: ['missing'], removeFromArchive: true });
    const rejected = expect(purge).rejects.toBeInstanceOf(LibraryUnavailableError);
    const run = jest.fn().mockResolvedValue(undefined);
    const download = archiveAccess.withDownload(run);
    try {
      expect(run).not.toHaveBeenCalled();
    } finally {
      // Always let the purge finish, or it would hold the lock for the rest of the file.
      finishCheck(LIBRARY_EMPTY);
    }
    await rejected;
    await download;
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('does nothing when the trash is empty', async () => {
    Video.findAll.mockReset();
    Video.findAll.mockResolvedValue([]);

    const result = await videoTrashModule.purgeRemoved({ states: ['deleted', 'missing'], removeFromArchive: true });

    expect(result).toEqual({ purged: 0, archiveEntriesRemoved: 0, jobIds: [] });
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(archiveModule.removeVideosFromArchive).not.toHaveBeenCalled();
    expect(messageEmitter.emitMessage).not.toHaveBeenCalled();
  });
});
