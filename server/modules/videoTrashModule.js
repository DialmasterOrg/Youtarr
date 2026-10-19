// The trash: videos that have no file any more (see videoRemovalState for
// deleted vs. missing). Counts them, turns missing videos into deleted ones,
// and (purge) forgets them entirely.
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize } = require('../db.js');
const { Video, JobVideo, VideoWatchStatus, PlaylistVideo } = require('../models');
const configModule = require('./configModule');
const messageEmitter = require('./messageEmitter');
const archiveModule = require('./archiveModule');
const archiveAccess = require('./download/archiveAccess');
const logger = require('../logger');
const { LIBRARY_CHECK_REASONS, checkLibraryRoot, libraryCheckCoversRows } = require('./libraryRootCheck');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');
const { REMOVAL_REASONS, REMOVAL_STATES, stateWhere, notStateWhere, removedColumns } = require('./videoRemovalState');

// Rows are forgotten in chunks of this size, each in its own transaction.
const PURGE_CHUNK_SIZE = 500;
// Check results that can also mean the user emptied the folder on purpose,
// the only ones "mark all missing as deleted" may be told to look past.
const EMPTY_FOLDER_REASONS = [LIBRARY_CHECK_REASONS.EMPTY, LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY];
const PASSING_CHECK = { ok: true };
// Cached files (info.json, thumbnails) are unlinked this many at a time.
const UNLINK_CONCURRENCY = 16;

// Thrown when an action over every missing video is asked for while the
// downloads folder looks unmounted: those videos may well be fine.
class LibraryUnavailableError extends Error {
  constructor(libraryCheck) {
    super(libraryCheck.message);
    this.name = 'LibraryUnavailableError';
    this.code = 'LIBRARY_UNAVAILABLE';
    this.libraryCheck = libraryCheck;
  }
}

class PurgeRunningError extends Error {
  constructor() {
    super('A purge is already running');
    this.name = 'PurgeRunningError';
    this.code = 'PURGE_RUNNING';
  }
}

function normalizeLibraryCheck(check) {
  return {
    ok: check.ok,
    reason: check.reason ?? null,
    path: check.path ?? null,
    message: check.message ?? null,
  };
}

class VideoTrashModule {
  constructor() {
    this._purgeRunning = false;
  }

  /**
   * @returns {Promise<{deleted: number, missing: number, legacy: number, libraryCheck: Object,
   *   missingActionsBlocked: boolean, downloadsActive: boolean}>}
   *   legacy: deleted rows removed before the reason was recorded (a subset of deleted);
   *   libraryCheck: failing while it covers present or missing videos (the Maintenance card warns and
   *   offers Rescan anyway), passing otherwise; missingActionsBlocked: it covers missing videos, so
   *   marking all of them as deleted or emptying them from the trash is refused;
   *   downloadsActive: a purge that removes archive entries would be refused right now
   */
  async getRemovedSummary() {
    const deleted = await Video.count({ where: stateWhere(REMOVAL_STATES.DELETED) });
    const missing = await Video.count({ where: stateWhere(REMOVAL_STATES.MISSING) });
    const legacy = await Video.count({ where: { removed: true, removed_reason: null } });
    const libraryCheck = await checkLibraryRoot(configModule.directoryPath);
    // Present videos count for the warning: their missing marks are held back,
    // and Rescan anyway is how a user who emptied the folder releases them.
    const coversRecorded = await libraryCheckCoversRows(libraryCheck, Video, notStateWhere(REMOVAL_STATES.DELETED));
    const missingActionsBlocked = coversRecorded
      && await libraryCheckCoversRows(libraryCheck, Video, stateWhere(REMOVAL_STATES.MISSING));
    return {
      deleted,
      missing,
      legacy,
      libraryCheck: normalizeLibraryCheck(coversRecorded ? libraryCheck : PASSING_CHECK),
      missingActionsBlocked,
      downloadsActive: archiveAccess.isDownloading(),
    };
  }

  // The failing library check that puts missing videos in doubt, or null. The
  // missing-video actions touch nothing else: present videos under a failing
  // folder are already held back by the file check and the rescan.
  async _checkCoveringMissing() {
    const libraryCheck = await checkLibraryRoot(configModule.directoryPath);
    const covers = await libraryCheckCoversRows(libraryCheck, Video, stateWhere(REMOVAL_STATES.MISSING));
    return covers ? libraryCheck : null;
  }

  /**
   * Turn missing videos into deleted ones. Only rows that are missing change;
   * present and deleted ids in the selection are left alone.
   * @param {{videoIds?: (number[]|null), all?: boolean, ignoreLibraryCheck?: boolean}} options -
   *   ignoreLibraryCheck: the user emptied the downloads folder (or a subfolder) on purpose; honoured
   *   only while the check fails because a folder is empty, never because one is gone or unreadable
   * @returns {Promise<{updated: number}>}
   * @throws {LibraryUnavailableError} for `all` while the downloads folder looks unmounted
   */
  async markMissingAsDeleted({ videoIds = null, all = false, ignoreLibraryCheck = false } = {}) {
    if (all) {
      const libraryCheck = await this._checkCoveringMissing();
      if (libraryCheck) {
        if (!ignoreLibraryCheck || !EMPTY_FOLDER_REASONS.includes(libraryCheck.reason)) {
          throw new LibraryUnavailableError(libraryCheck);
        }
        logger.warn({ libraryCheck }, 'Marking every missing video as deleted without the downloads folder check, by request');
      }
    }

    const where = { ...stateWhere(REMOVAL_STATES.MISSING) };
    if (!all) where.id = videoIds;

    const [updated] = await Video.update(removedColumns(REMOVAL_REASONS.MARKED_DELETED), { where });
    if (updated > 0) {
      messageEmitter.emitMessage('broadcast', null, 'videos', 'videosUpdated', { source: 'mark-deleted', updated });
    }
    return { updated };
  }

  isPurgeRunning() {
    return this._purgeRunning;
  }

  /**
   * Forget removed videos entirely: their videos row, job links, synced watch
   * status, playlist download dates, cached info.json and thumbnails, and (if
   * asked) their download archive entries. Nothing on disk under the
   * downloads folder is touched.
   * @param {{states: string[], removeFromArchive: boolean}} options - states: 'deleted' and/or 'missing'
   * @param {{reloadJobVideos?: Function}} [deps] - Download History holds jobs in memory; given, it is
   *   called with the affected job ids before the pages are told to refetch, so they never see ghosts
   * @returns {Promise<{purged: number, archiveEntriesRemoved: number, jobIds: string[]}>}
   * @throws {PurgeRunningError} while another purge runs
   * @throws {LibraryUnavailableError} for missing videos while the downloads folder looks unmounted
   * @throws with code ARCHIVE_BUSY if archive removal would overlap a download
   * @throws a chunk failure after refreshing history and listings for committed chunks;
   *   archive failures roll back that chunk's database changes so it can be retried
   */
  async purgeRemoved({ states, removeFromArchive }, { reloadJobVideos = null } = {}) {
    if (this._purgeRunning) throw new PurgeRunningError();
    // Taken before the library check awaits, so a second request cannot slip in meanwhile.
    this._purgeRunning = true;
    let releaseArchive = null;
    try {
      if (removeFromArchive) releaseArchive = archiveAccess.acquirePurge();
      if (states.includes(REMOVAL_STATES.MISSING)) {
        const libraryCheck = await this._checkCoveringMissing();
        if (libraryCheck) throw new LibraryUnavailableError(libraryCheck);
      }

      const jobIds = new Set();
      const purgedYoutubeIds = [];
      const archiveProgress = { removed: 0 };
      let failure = null;
      try {
        await this._forgetInChunks(states.map((state) => stateWhere(state)), jobIds, purgedYoutubeIds, removeFromArchive, archiveProgress);
      } catch (err) {
        // Chunks that committed before the failure are gone for good, so the
        // steps below still run for them; the failure is rethrown after.
        failure = err;
      }

      const purged = purgedYoutubeIds.length;
      const archiveEntriesRemoved = archiveProgress.removed;

      // Refresh the in-memory jobs first: the pages refetch on the broadcast,
      // and a refetch that lands before the reload would still show the ghosts.
      if (jobIds.size > 0 && reloadJobVideos) {
        try {
          await reloadJobVideos([...jobIds]);
        } catch (err) {
          logger.error({ err, jobsAffected: jobIds.size }, 'Purged videos but could not refresh the download history');
        }
      }

      if (purged > 0) {
        logger.info(
          { purged, archiveEntriesRemoved, states, jobsAffected: jobIds.size },
          failure ? 'Emptied part of the trash before a failure' : 'Emptied the trash'
        );
        messageEmitter.emitMessage('broadcast', null, 'videos', 'videosUpdated', { source: 'purge', purged });
        messageEmitter.emitMessage('broadcast', null, 'videos', 'jobsUpdated', { source: 'purge' });
      }
      if (failure) throw failure;
      return { purged, archiveEntriesRemoved, jobIds: [...jobIds] };
    } finally {
      if (releaseArchive) releaseArchive();
      this._purgeRunning = false;
    }
  }

  /**
   * Forget the matching rows chunk by chunk, each chunk in its own transaction.
   * Each chunk's job ids and YouTube ids are added to the given collections
   * once it commits, so the caller still has them if a later chunk throws.
   * @param {Object[]} stateClauses - stateWhere() clauses, any of which a row may match
   * @param {Set<string>} jobIds - Jobs that lost videos
   * @param {string[]} purgedYoutubeIds - Videos forgotten so far
   * @param {boolean} removeFromArchive - Remove archive entries before committing each chunk
   * @param {{removed: number}} archiveProgress - Archive entries removed by committed chunks
   */
  async _forgetInChunks(stateClauses, jobIds, purgedYoutubeIds, removeFromArchive, archiveProgress) {
    const where = { [Op.or]: stateClauses };
    for (;;) {
      // Each chunk's rows are gone once it commits, so the same query finds the next chunk.
      const candidates = await Video.findAll({ where, attributes: ['id', 'youtubeId'], limit: PURGE_CHUNK_SIZE, raw: true });
      if (candidates.length === 0) return;

      let linkedJobIds = [];
      let archiveEntriesRemoved = 0;
      const confirmed = await sequelize.transaction(async (transaction) => {
        // Re-read under lock with the state predicate: a row re-downloaded or
        // restored since the select is present again and must stay.
        const rows = await Video.findAll({
          where: { id: candidates.map((row) => row.id), [Op.or]: stateClauses },
          attributes: ['id', 'youtubeId'],
          transaction,
          lock: true,
          raw: true,
        });
        if (rows.length === 0) return rows;
        const ids = rows.map((row) => row.id);
        const youtubeIds = rows.map((row) => row.youtubeId);

        const links = await JobVideo.findAll({ where: { video_id: ids }, attributes: ['job_id'], transaction, raw: true });
        linkedJobIds = links.map((link) => link.job_id);
        // jobvideos.video_id has a restricting foreign key: children first.
        await VideoWatchStatus.destroy({ where: { video_id: ids }, transaction });
        await JobVideo.destroy({ where: { video_id: ids }, transaction });
        await PlaylistVideo.update({ downloaded_at: null }, { where: { youtube_id: youtubeIds }, transaction });
        await Video.destroy({ where: { id: ids, [Op.or]: stateClauses }, transaction });
        // An archive error must abort the transaction: otherwise its IDs would
        // be lost and another purge could never retry the requested cleanup.
        // If the subsequent commit fails, rows remain and removing their
        // already-absent archive entries on retry is harmless.
        if (removeFromArchive) {
          archiveEntriesRemoved = await archiveModule.removeVideosFromArchive(youtubeIds);
        }
        return rows;
      });

      if (confirmed.length === 0) {
        logger.warn({ count: candidates.length }, 'Purge chunk had nothing left to forget; stopping');
        return;
      }
      for (const jobId of linkedJobIds) jobIds.add(jobId);
      archiveProgress.removed += archiveEntriesRemoved;
      const youtubeIds = confirmed.map((row) => row.youtubeId);
      purgedYoutubeIds.push(...youtubeIds);
      // The cached info.json is what library repair would recreate the row from.
      await this._removeCachedFiles(youtubeIds);
    }
  }

  async _removeCachedFiles(youtubeIds) {
    const infoDir = path.join(configModule.getJobsPath(), 'info');
    const imageDir = configModule.getImagePath();
    const limit = createLimiter(UNLINK_CONCURRENCY);
    const paths = youtubeIds.flatMap((youtubeId) => [
      path.join(infoDir, `${youtubeId}.info.json`),
      path.join(imageDir, `videothumb-${youtubeId}.jpg`),
      path.join(imageDir, `videothumb-${youtubeId}-small.jpg`),
    ]);
    await Promise.all(paths.map((filePath) => limit(async () => {
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn({ err, filePath }, 'Could not remove a purged video\'s cached file');
        }
      }
    })));
  }
}

module.exports = Object.assign(new VideoTrashModule(), { LibraryUnavailableError, PurgeRunningError });
