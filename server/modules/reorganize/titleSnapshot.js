/**
 * A channel's title shows, episode rows and conflicts before a title show
 * change, kept with the operation so the change can be undone when no video
 * could be moved (the settings of a reorganize are applied when it starts).
 */

const { sequelize } = require('../../db');
const { VideoClassification, EpisodeConflict, Video } = require('../../models');
const titleShowStore = require('../tvShows/titleShowStore');
const episodeConflicts = require('../tvShows/episodeConflicts');
const archiveSuppressor = require('../tvShows/archiveSuppressor');

const ROW_FIELDS = [
  'youtube_id', 'channel_id', 'show_id', 'status', 'season', 'episode', 'source', 'timestamp_source',
  'pattern_id', 'episode_title', 'file_stem', 'title_opt_out',
];
const CONFLICT_KINDS = ['duplicate', 'classification_error'];

function pick(row, fields) {
  const values = {};
  for (const field of fields) values[field] = row[field] === undefined ? null : row[field];
  return values;
}

function parseDetails(text) {
  try {
    return JSON.parse(text || '{}') || {};
  } catch (err) {
    return {};
  }
}

/**
 * @param {string} channelId
 * @returns {Promise<{shows: Array<Object>, rows: Array<Object>, conflicts: Array<Object>}>}
 */
async function takeTitleSnapshot(channelId) {
  const shows = await titleShowStore.listTitleShows(channelId, { includeRetired: true });
  const rows = await VideoClassification.findAll({ where: { channel_id: channelId }, raw: true });
  const conflicts = await EpisodeConflict.findAll({ where: { channel_id: channelId, kind: CONFLICT_KINDS }, raw: true });
  return {
    shows,
    rows: rows.map((row) => pick(row, ROW_FIELDS)),
    conflicts: conflicts.map((conflict) => ({
      youtubeId: conflict.youtube_id,
      kind: conflict.kind,
      showId: conflict.show_id,
      duplicateOf: conflict.duplicate_of,
      details: conflict.details,
    })),
  };
}

async function restoreRows(channelId, snapshot, patternIds, transaction) {
  const patternKeys = new Map();
  for (const show of snapshot.shows) for (const pattern of show.patterns) patternKeys.set(pattern.id, pattern.key);
  const kept = new Set(snapshot.rows.map((row) => row.youtube_id));

  await VideoClassification.update({ season: null, episode: null }, { where: { channel_id: channelId }, transaction });
  const current = await VideoClassification.findAll({ where: { channel_id: channelId }, attributes: ['youtube_id'], transaction });
  const added = current.map((row) => row.youtube_id).filter((id) => !kept.has(id));
  if (added.length) await VideoClassification.destroy({ where: { youtube_id: added }, transaction });

  for (const values of snapshot.rows) {
    const patternKey = patternKeys.get(values.pattern_id);
    const restored = { ...values, pattern_id: patternKey ? patternIds.get(patternKey) || null : null };
    const row = await VideoClassification.findByPk(values.youtube_id, { transaction });
    if (row) await row.update(restored, { transaction });
    else await VideoClassification.create(restored, { transaction });
  }
}

async function restoreConflicts(channelId, snapshot, transaction) {
  const before = new Map(snapshot.conflicts.map((conflict) => [conflict.youtubeId, conflict]));
  const now = await EpisodeConflict.findAll({ where: { channel_id: channelId, kind: CONFLICT_KINDS }, transaction });
  const current = new Map(now.map((conflict) => [conflict.youtube_id, conflict]));
  // A conflict the change recorded, or turned into another kind (an error
  // that became a duplicate), is released first: that takes back the ignore
  // and archive line it came with, which the old kind never had.
  for (const conflict of now) {
    const was = before.get(conflict.youtube_id);
    if (!was || was.kind !== conflict.kind) await episodeConflicts.release(conflict.youtube_id, { transaction });
  }
  // Conflicts the change released, and ones it pointed at another episode,
  // holder or show, are recorded again as they were.
  const unchanged = (conflict) => {
    const row = current.get(conflict.youtubeId);
    return row && row.kind === conflict.kind && (row.show_id ?? null) === (conflict.showId ?? null)
      && (row.duplicate_of ?? null) === (conflict.duplicateOf ?? null) && (row.details ?? null) === (conflict.details ?? null);
  };
  const missing = snapshot.conflicts.filter((conflict) => !unchanged(conflict));
  if (missing.length === 0) return;
  const downloads = await Video.findAll({
    where: { youtubeId: missing.map((conflict) => conflict.youtubeId), removed: false }, attributes: ['youtubeId'], raw: true, transaction,
  });
  const downloaded = new Set(downloads.map((video) => video.youtubeId));
  for (const conflict of missing) {
    const details = parseDetails(conflict.details);
    if (conflict.kind === 'classification_error') {
      await episodeConflicts.recordError({ youtubeId: conflict.youtubeId, channelId, message: details.message || null, transaction });
      continue;
    }
    await episodeConflicts.recordDuplicate({
      youtubeId: conflict.youtubeId,
      channelId,
      showId: conflict.showId,
      season: details.season,
      episode: details.episode,
      duplicateOf: conflict.duplicateOf,
      downloaded: downloaded.has(conflict.youtubeId),
      transaction,
    });
  }
}

// Shows the change added are deleted, not retired: a retired show would hold
// its folder name, and a retry of the same change would be refused for it.
async function deleteAddedShows(channelId, snapshot, transaction) {
  const before = new Set(snapshot.shows.map((show) => show.id));
  const added = (await titleShowStore.titleShowIds(channelId, { transaction })).filter((id) => !before.has(id));
  if (added.length === 0) return;
  await EpisodeConflict.update({ show_id: null }, { where: { show_id: added }, transaction });
  await titleShowStore.deleteShows(added, { transaction });
}

/**
 * Put a channel's title shows, episode rows and conflicts back as they were.
 * Shows the change added are deleted; numbers allocated meanwhile stay used
 * (high-water marks never go down).
 * @param {Object} channel - channels row
 * @param {Object} snapshot - takeTitleSnapshot's result
 */
async function restoreTitleSnapshot(channel, snapshot) {
  const channelId = channel.channel_id;
  await sequelize.transaction(async (transaction) => {
    const drafts = snapshot.shows.filter((show) => !show.retired);
    const { patternIds } = await titleShowStore.saveDefinitions({ channelId, drafts, transaction });
    await restoreRows(channelId, snapshot, patternIds, transaction);
    await restoreConflicts(channelId, snapshot, transaction);
    await deleteAddedShows(channelId, snapshot, transaction);
  });
  await archiveSuppressor.flush();
}

module.exports = {
  takeTitleSnapshot,
  restoreTitleSnapshot
};
