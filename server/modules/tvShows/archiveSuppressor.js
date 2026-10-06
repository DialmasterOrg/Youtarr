/**
 * The deferred writer for complete.list changes title shows make: a duplicate
 * episode is suppressed (its line added, so channel downloads skip it) and a
 * released one restored (its line removed).
 *
 * A channel download job finds what it downloaded by counting archive lines
 * from where it started, so the file must not change under a running job.
 * Requests are stored on their episode_conflicts row (archive_pending) and
 * applied when no download job is In Progress: right away when the queue is
 * idle, else before jobModule starts the next job (which waits for a pass
 * already running), and at startup.
 */

const { EpisodeConflict } = require('../../models');
const archiveModule = require('../archiveModule');
const logger = require('../../logger');

const ARCHIVE_ADD = 'add';
const ARCHIVE_REMOVE = 'remove';
const KIND_RELEASED = 'released';

class ArchiveSuppressor {
  constructor() {
    // Until wired, assume a download may be running: never write blind.
    this.isDownloadRunning = () => true;
    this.inFlight = null;
  }

  /**
   * @param {{isDownloadRunning: () => boolean}} deps
   */
  initialize({ isDownloadRunning }) {
    this.isDownloadRunning = isDownloadRunning;
  }

  /**
   * Apply every pending archive write, unless a download job is running.
   * Concurrent calls share one pass.
   * @returns {Promise<void>}
   */
  flush() {
    if (!this.inFlight) {
      this.inFlight = this._flush().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  async _flush() {
    if (this.isDownloadRunning()) return;
    // Callers flush after their own write committed, so a failed read is
    // logged, not thrown: the rows stay pending for the next flush.
    let rows;
    try {
      rows = await EpisodeConflict.findAll({ where: { archive_pending: [ARCHIVE_ADD, ARCHIVE_REMOVE] } });
    } catch (err) {
      logger.error({ err }, 'Could not read the pending complete.list changes for duplicate episodes');
      return;
    }
    for (const row of rows) {
      if (this.isDownloadRunning()) return;
      try {
        await this._apply(row);
      } catch (err) {
        logger.error({ err, youtubeId: row.youtube_id, pending: row.archive_pending }, 'Could not update complete.list for a duplicate episode');
      }
    }
  }

  async _apply(row) {
    const youtubeId = row.youtube_id;
    if (row.archive_pending === ARCHIVE_ADD) {
      if (!row.archive_suppressed) {
        // A line already there is a real download's (kept when the video was
        // deleted): never Youtarr's to remove.
        if (await archiveModule.isVideoInArchive(youtubeId)) {
          await row.update({ archive_pending: null, archive_suppressed: false });
          return;
        }
        // Ownership is recorded before the append: an append that lands
        // without this update would otherwise read as someone else's line.
        await row.update({ archive_suppressed: true });
      }
      if (!(await archiveModule.isVideoInArchive(youtubeId))) {
        await archiveModule.addVideoToArchive(youtubeId);
        if (!(await archiveModule.isVideoInArchive(youtubeId))) {
          logger.warn({ youtubeId }, 'A duplicate episode is still missing from complete.list; retrying later');
          return;
        }
      }
      await row.update({ archive_pending: null });
      return;
    }
    await archiveModule.removeVideoFromArchive(youtubeId);
    if (await archiveModule.isVideoInArchive(youtubeId)) {
      logger.warn({ youtubeId }, 'A released episode is still in complete.list; retrying later');
      return;
    }
    if (row.kind === KIND_RELEASED) await row.destroy();
    else await row.update({ archive_pending: null, archive_suppressed: false });
  }
}

module.exports = new ArchiveSuppressor();
module.exports.ARCHIVE_ADD = ARCHIVE_ADD;
module.exports.ARCHIVE_REMOVE = ARCHIVE_REMOVE;
module.exports.KIND_RELEASED = KIND_RELEASED;
