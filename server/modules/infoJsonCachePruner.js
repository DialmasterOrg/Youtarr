const path = require('path');
const fs = require('fs');
const { Video } = require('../models');
const archiveModule = require('./archiveModule');
const configModule = require('./configModule');
const logger = require('../logger');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');

// Opening a video's details caches its yt-dlp metadata in jobs/info whether
// or not the video is ever downloaded. A downloaded video's file lives and
// dies with its Videos row (Empty trash unlinks both), but a video that was
// only looked at has no row, so nothing else would ever remove its file.
// Recent files are kept so reopening the same video stays fast; a file's age
// is its modification time, which only a fetch sets.
const UNTRACKED_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;
const LOOKUP_CHUNK_SIZE = 500;
const FS_CONCURRENCY = 8;
const INFO_FILE_PATTERN = /^([A-Za-z0-9_-]{11})\.info\.json$/;

// Ids the download archive lists. Read directly rather than through
// filterArchivedVideoIds, which treats an unreadable archive as empty: here
// that would remove every file library repair could still rebuild a row from.
// A missing archive reads as empty; any other read error throws.
function readArchivedIds() {
  const archived = new Set();
  for (const line of archiveModule.readCompleteListLines()) {
    const [extractor, youtubeId] = line.split(/\s+/);
    if (extractor === 'youtube' && youtubeId) archived.add(youtubeId);
  }
  return archived;
}

class InfoJsonCachePruner {
  constructor() {
    this._running = false;
  }

  /**
   * Removes jobs/info files older than UNTRACKED_MAX_AGE_MS whose video has
   * no Videos row and is not in the download archive (library repair rebuilds
   * a lost row from the archive entry plus this file). Both lookups run
   * before anything is removed and either one failing rejects the run, so a
   * failed lookup removes nothing.
   * @param {{ now?: number }} [options]
   * @returns {Promise<{scanned:number, removed:number, failed:number}|{skipped:true, reason:string}>}
   */
  async pruneUntracked({ now = Date.now() } = {}) {
    if (this._running) return { skipped: true, reason: 'already-running' };
    this._running = true;
    try {
      const result = await this._prune(now);
      if (result.removed > 0 || result.failed > 0) {
        logger.info(result, 'Pruned cached metadata of videos that were never downloaded');
      }
      return result;
    } finally {
      this._running = false;
    }
  }

  async _prune(now) {
    const infoDir = path.join(configModule.getJobsPath(), 'info');
    const entries = await this._listInfoFiles(infoDir);
    const result = { scanned: entries.length, removed: 0, failed: 0 };
    if (entries.length === 0) return result;

    const cutoff = now - UNTRACKED_MAX_AGE_MS;
    const limit = createLimiter(FS_CONCURRENCY);
    const oldIds = new Set();
    await Promise.all(entries.map((entry) => limit(async () => {
      const older = await this._isOlderThan(entry.filePath, cutoff);
      if (older === null) result.failed += 1;
      else if (older) oldIds.add(entry.youtubeId);
    })));
    const old = entries.filter((entry) => oldIds.has(entry.youtubeId));
    if (old.length === 0) return result;

    const untracked = await this._withoutTrackedVideos(old);
    await Promise.all(untracked.map((entry) => limit(async () => {
      // A download that finished since the first check rewrote the file, and
      // videoMetadataProcessor still needs it to persist the video.
      const stillOld = await this._isOlderThan(entry.filePath, cutoff);
      if (stillOld === null) {
        result.failed += 1;
        return;
      }
      if (!stillOld) return;
      try {
        await fs.promises.unlink(entry.filePath);
        result.removed += 1;
      } catch (err) {
        if (err.code === 'ENOENT') return;
        result.failed += 1;
        logger.warn({ err, filePath: entry.filePath }, 'Could not remove a cached metadata file');
      }
    })));
    return result;
  }

  async _listInfoFiles(infoDir) {
    let names;
    try {
      names = await fs.promises.readdir(infoDir);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const entries = [];
    for (const name of names) {
      const match = INFO_FILE_PATTERN.exec(name);
      if (match) entries.push({ youtubeId: match[1], filePath: path.join(infoDir, name) });
    }
    return entries;
  }

  // true when the file is older than the cutoff, false when it is recent or
  // already gone (removed by something else, e.g. Empty trash), null when it
  // could not be checked.
  async _isOlderThan(filePath, cutoff) {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.mtimeMs < cutoff;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      logger.warn({ err, filePath }, 'Could not check a cached metadata file');
      return null;
    }
  }

  // Leaves out the videos the download archive lists and the ones with a Videos row.
  async _withoutTrackedVideos(entries) {
    const archived = readArchivedIds();
    const tracked = new Set();
    for (let i = 0; i < entries.length; i += LOOKUP_CHUNK_SIZE) {
      const ids = entries.slice(i, i + LOOKUP_CHUNK_SIZE).map((entry) => entry.youtubeId);
      const rows = await Video.findAll({ where: { youtubeId: ids }, attributes: ['youtubeId'], raw: true });
      for (const row of rows) tracked.add(row.youtubeId);
    }
    return entries.filter((entry) => !archived.has(entry.youtubeId) && !tracked.has(entry.youtubeId));
  }
}

module.exports = new InfoJsonCachePruner();
