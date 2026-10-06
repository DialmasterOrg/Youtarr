/**
 * Episode conflicts: videos that lost their episode number to another upload
 * (duplicates) and videos whose title could not be classified.
 *
 * A duplicate that isn't downloaded is ignored on the channel and suppressed
 * in complete.list (through archiveSuppressor), so Download All and channel
 * downloads skip it. The conflict row records what Youtarr did, the ignore
 * (`youtarr_ignored`) and the archive line (`archive_suppressed`, only when
 * Youtarr wrote it), and only that is undone when the conflict is released:
 * an ignore the user set, or an archive line that was already there (a real
 * download's, kept when the video was deleted), is never touched. A
 * downloaded duplicate is never ignored or deleted.
 */

const { EpisodeConflict } = require('../../models');
const ChannelVideo = require('../../models/channelvideo');
const { ARCHIVE_ADD, ARCHIVE_REMOVE, KIND_RELEASED } = require('./archiveSuppressor');
const { CONFLICT_KIND_DUPLICATE: KIND_DUPLICATE } = require('./constants');

const KIND_ERROR = 'classification_error';

function parseDetails(text) {
  if (!text) return {};
  try {
    return JSON.parse(text) || {};
  } catch (err) {
    return {};
  }
}

// Youtarr wrote the video's archive line, or is waiting to.
function ownsArchiveLine(row) {
  return Boolean(row.archive_suppressed) || row.archive_pending === ARCHIVE_ADD;
}

async function setIgnored(channelId, youtubeId, ignored, transaction) {
  const where = { channel_id: channelId, youtube_id: youtubeId };
  if (!ignored) where.ignored = true;
  await ChannelVideo.update(
    ignored ? { ignored: true, ignored_at: new Date() } : { ignored: false, ignored_at: null },
    { where, transaction }
  );
}

async function ignoredByUser(channelId, youtubeId, transaction) {
  const rows = await ChannelVideo.findAll({
    where: { channel_id: channelId, youtube_id: youtubeId }, attributes: ['ignored'], transaction,
  });
  return rows.some((entry) => entry.ignored);
}

/**
 * Record that a video lost its number to another upload.
 *
 * @param {Object} params
 * @param {string} params.youtubeId
 * @param {string} params.channelId
 * @param {number} params.showId
 * @param {number} params.season
 * @param {number} params.episode
 * @param {string} params.duplicateOf - The video holding the number
 * @param {boolean} params.downloaded
 * @param {Object} [params.transaction]
 */
async function recordDuplicate({ youtubeId, channelId, showId, season, episode, duplicateOf, downloaded, transaction = null }) {
  const values = {
    channel_id: channelId,
    show_id: showId,
    kind: KIND_DUPLICATE,
    duplicate_of: duplicateOf,
    details: JSON.stringify({ season, episode }),
  };
  const existing = await EpisodeConflict.findByPk(youtubeId, { transaction });
  if (existing && existing.kind !== KIND_ERROR) {
    if (existing.kind === KIND_RELEASED && existing.archive_pending === ARCHIVE_REMOVE && !downloaded) {
      // Released, but its line is still there: suppress it again as it is.
      await setIgnored(channelId, youtubeId, true, transaction);
      await existing.update({ ...values, archive_pending: null, youtarr_ignored: true }, { transaction });
      return;
    }
    await existing.update(values, { transaction });
    return;
  }

  const suppress = !downloaded && !(await ignoredByUser(channelId, youtubeId, transaction));
  if (suppress) await setIgnored(channelId, youtubeId, true, transaction);
  const row = { ...values, youtarr_ignored: suppress, archive_suppressed: false, archive_pending: suppress ? ARCHIVE_ADD : null };
  if (existing) await existing.update(row, { transaction });
  else await EpisodeConflict.create({ youtube_id: youtubeId, ...row }, { transaction });
}

/**
 * Release a conflict: the video holds its number now, matches no show, or
 * its show is gone. Youtarr's ignore is taken back and its archive line
 * removed (deferred); anything else stays as the user left it.
 */
async function release(youtubeId, { transaction = null } = {}) {
  const row = await EpisodeConflict.findByPk(youtubeId, { transaction });
  if (!row || row.kind === KIND_RELEASED) return;
  if (row.youtarr_ignored) await setIgnored(row.channel_id, youtubeId, false, transaction);
  if (row.archive_suppressed) {
    await row.update({ kind: KIND_RELEASED, archive_pending: ARCHIVE_REMOVE, youtarr_ignored: false }, { transaction });
  } else {
    // A pending add goes with the row.
    await row.destroy({ transaction });
  }
}

/**
 * An explicit download removed these videos' archive lines before yt-dlp
 * ran. A suppressed duplicate's line is written again after the job unless
 * the video downloads (noteDownloaded).
 */
async function noteArchiveLinesRemoved(youtubeIds) {
  if (!youtubeIds.length) return;
  const rows = await EpisodeConflict.findAll({ where: { youtube_id: youtubeIds, archive_suppressed: true } });
  for (const row of rows) await row.update({ archive_suppressed: false, archive_pending: ARCHIVE_ADD });
}

/**
 * A duplicate was downloaded after all: the download's archive line stands
 * and Youtarr's ignore is taken back. It stays a (downloaded) duplicate.
 */
async function noteDownloaded(youtubeId) {
  const row = await EpisodeConflict.findByPk(youtubeId);
  if (!row || !(row.youtarr_ignored || ownsArchiveLine(row))) return;
  if (row.youtarr_ignored) await setIgnored(row.channel_id, youtubeId, false, null);
  await row.update({ youtarr_ignored: false, archive_suppressed: false, archive_pending: null });
}

/**
 * Record that a video's title could not be classified (the Python check
 * failed). A duplicate conflict is left as it is; a released row (a
 * duplicate whose archive line is still being taken back) becomes the error,
 * keeping that pending removal.
 */
async function recordError({ youtubeId, channelId, message, transaction = null }) {
  const existing = await EpisodeConflict.findByPk(youtubeId, { transaction });
  const values = { channel_id: channelId, show_id: null, kind: KIND_ERROR, duplicate_of: null, details: JSON.stringify({ message }) };
  if (!existing) {
    await EpisodeConflict.create({ youtube_id: youtubeId, ...values }, { transaction });
  } else if (existing.kind !== KIND_DUPLICATE) {
    await existing.update(values, { transaction });
  }
}

async function clearError(youtubeId, { transaction = null } = {}) {
  const row = await EpisodeConflict.findByPk(youtubeId, { transaction });
  if (row && row.kind === KIND_ERROR) await row.destroy({ transaction });
}

/**
 * Forget a channel's classification errors: its titles just classified.
 * @param {string} channelId
 * @param {Object} [options]
 * @param {Object} [options.transaction]
 * @param {string[]|null} [options.youtubeIds] - Only these videos' errors (null: every one of the channel's)
 */
async function clearErrorsForChannel(channelId, { transaction = null, youtubeIds = null } = {}) {
  if (youtubeIds && youtubeIds.length === 0) return;
  const where = { channel_id: channelId, kind: KIND_ERROR };
  if (youtubeIds) where.youtube_id = youtubeIds;
  await EpisodeConflict.destroy({ where, transaction });
}

/**
 * The channel's videos recorded as duplicates.
 * @returns {Promise<Set<string>>}
 */
async function duplicateIdsForChannel(channelId, { transaction = null } = {}) {
  const rows = await EpisodeConflict.findAll({
    where: { channel_id: channelId, kind: KIND_DUPLICATE }, attributes: ['youtube_id'], transaction,
  });
  return new Set(rows.map((row) => row.youtube_id));
}

/**
 * @returns {Promise<Array<{youtubeId: string, kind: string, showId: number|null, duplicateOf: string|null,
 *   season: number|null, episode: number|null, message: string|null, suppressed: boolean}>>}
 */
async function listForChannel(channelId) {
  const rows = await EpisodeConflict.findAll({ where: { channel_id: channelId, kind: [KIND_DUPLICATE, KIND_ERROR] } });
  return rows.map((row) => {
    const details = parseDetails(row.details);
    return {
      youtubeId: row.youtube_id,
      kind: row.kind,
      showId: row.show_id,
      duplicateOf: row.duplicate_of,
      season: details.season === undefined ? null : details.season,
      episode: details.episode === undefined ? null : details.episode,
      message: details.message || null,
      suppressed: Boolean(row.youtarr_ignored),
    };
  });
}

module.exports = {
  KIND_DUPLICATE,
  KIND_ERROR,
  recordDuplicate,
  release,
  noteArchiveLinesRemoved,
  noteDownloaded,
  recordError,
  clearError,
  clearErrorsForChannel,
  duplicateIdsForChannel,
  listForChannel
};
