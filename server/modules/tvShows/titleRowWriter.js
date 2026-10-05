/**
 * Writes a titlePlanner plan: the channel's show definitions, every changed
 * video_classifications row, duplicate conflicts and their releases, and the
 * order high-water marks. One transaction (the caller's), so the unique
 * episode key never sees half a renumbering: rows that change give up their
 * numbers first, then take their new ones.
 *
 * Archive writes for duplicates are only queued here (archiveSuppressor);
 * the caller flushes them after the commit.
 */

const { VideoClassification } = require('../../models');
const titleShowStore = require('./titleShowStore');
const episodeConflicts = require('./episodeConflicts');
const { buildEpisodeStem } = require('./episodeNaming');
const { ROW_STATUS, SOURCE } = require('./titleNumbering');

function holdsNumber(row) {
  return Boolean(row) && row.season !== null && row.season !== undefined && row.episode !== null && row.episode !== undefined;
}

function sameRow(before, after) {
  return before.showKey === after.showKey && before.status === after.status && before.season === after.season
    && before.episode === after.episode && before.source === after.source
    && Boolean(before.titleOptOut) === Boolean(after.titleOptOut);
}

function isTitleShowKey(key) {
  return key.startsWith('title:') || key.startsWith('new:');
}

function storedOrNull(value) {
  return value === undefined ? null : value;
}

// The columns a plan entry's row should have.
function rowValues(entry, { channelId, patternId, showIdOf }) {
  const { youtubeId, before, after } = entry;
  const assigned = after.status === ROW_STATUS.ASSIGNED && holdsNumber(after);
  const sameNumber = assigned && before && before.showKey === after.showKey
    && before.season === after.season && before.episode === after.episode;
  return {
    channel_id: channelId,
    show_id: showIdOf(after.showKey, before ? before.showId : null),
    status: after.status,
    season: assigned ? after.season : null,
    episode: assigned ? after.episode : null,
    source: after.source || null,
    // A number that stays keeps its time source and its stem.
    timestamp_source: sameNumber ? storedOrNull(before.timestampSource) : null,
    pattern_id: patternId,
    episode_title: after.episodeTitle || entry.title || null,
    file_stem: sameNumber && before.fileStem
      ? before.fileStem
      : assigned
        ? buildEpisodeStem({
          season: after.season, episode: after.episode, dateNumbered: after.source === SOURCE.DATE,
          episodeTitle: after.episodeTitle, videoTitle: entry.title, youtubeId,
        })
        : null,
    title_opt_out: Boolean(after.titleOptOut),
  };
}

const STORED_FIELDS = {
  show_id: 'showId',
  status: 'status',
  season: 'season',
  episode: 'episode',
  source: 'source',
  timestamp_source: 'timestampSource',
  pattern_id: 'patternId',
  episode_title: 'episodeTitle',
  file_stem: 'fileStem',
};

// The columns whose planned value differs from the stored row.
function changedColumns(before, values) {
  const changed = Object.entries(STORED_FIELDS)
    .filter(([column, field]) => storedOrNull(before[field]) !== values[column])
    .map(([column]) => column);
  if (Boolean(before.titleOptOut) !== values.title_opt_out) changed.push('title_opt_out');
  return changed;
}

const ROW_CHANGED = 'ROW_CHANGED';

/** Another writer (a download's post-processor) changed a row after it was planned. */
function rowChangedError(youtubeId) {
  const err = new Error(`The episode row of ${youtubeId} changed while the shows were saved`);
  err.code = ROW_CHANGED;
  return err;
}

function isRowChangedError(err) {
  return Boolean(err) && err.code === ROW_CHANGED;
}

// The row only while it is still as planned. A row whose number this save
// freed is matched without it.
function unchangedSincePlan(youtubeId, before, numberFreed) {
  const where = { youtube_id: youtubeId, status: before.status, show_id: before.showId };
  if (!numberFreed) {
    where.season = before.season === undefined ? null : before.season;
    where.episode = before.episode === undefined ? null : before.episode;
  }
  return where;
}

/**
 * @param {Object} params
 * @param {Object} params.channel - channels row
 * @param {Array<Object>} params.drafts - Normalized title shows
 * @param {Object} params.plan - titlePlanner plan for those drafts
 * @param {Map<string, number>} params.highWaterBefore - The marks the plan started from
 * @param {Object} params.transaction
 * @param {{showIds: Map<string, number>, patternIds: Map<string, number>}} [params.definitions] - The stored
 *   shows' ids when the definitions are unchanged (a listing refresh); otherwise the drafts are saved
 * @param {string[]|null} [params.clearErrorsOf] - The videos whose classification errors the plan settles
 *   (a listing refresh classifies only its new videos); null for every one of the channel's
 * @returns {Promise<{showIds: Map<string, number>, patternIds: Map<string, number>}>}
 */
async function applyPlan({ channel, drafts, plan, highWaterBefore, transaction, definitions = null, clearErrorsOf = null }) {
  const channelId = channel.channel_id;
  const { showIds, patternIds } = definitions || await titleShowStore.saveDefinitions({ channelId, drafts, transaction });
  const showIdOf = (key, fallback = null) => (key.startsWith('channel:') ? fallback : showIds.get(key) || null);

  const patternIdOf = (row) => (row.patternKey ? patternIds.get(row.patternKey) || null : null);
  const writes = [];
  // Rows whose only change is their pattern's id (patterns are replaced on
  // save), by new pattern id.
  const repointed = new Map();
  const repoint = (patternId, youtubeId) => {
    if (!repointed.has(patternId)) repointed.set(patternId, []);
    repointed.get(patternId).push(youtubeId);
  };
  for (const entry of plan.entries) {
    const { before, after } = entry;
    if (!after) {
      if (before) writes.push({ entry, destroy: true });
      continue;
    }
    if (after.keep && before && sameRow(before, after)) {
      const patternId = patternIdOf(after);
      if (isTitleShowKey(after.showKey) && patternId !== storedOrNull(before.patternId)) repoint(patternId, entry.youtubeId);
      continue;
    }
    const values = rowValues(entry, { channelId, patternId: patternIdOf(after), showIdOf });
    const changed = before ? changedColumns(before, values) : null;
    if (changed && changed.length === 0) continue;
    if (changed && changed.length === 1 && changed[0] === 'pattern_id') {
      repoint(values.pattern_id, entry.youtubeId);
      continue;
    }
    writes.push({ entry, values });
  }

  for (const [patternId, youtubeIds] of repointed) {
    await VideoClassification.update({ pattern_id: patternId }, { where: { youtube_id: youtubeIds }, transaction });
  }

  const renumbered = writes.filter(({ entry }) => holdsNumber(entry.before)).map(({ entry }) => entry.youtubeId);
  if (renumbered.length) {
    await VideoClassification.update({ season: null, episode: null }, { where: { youtube_id: renumbered }, transaction });
  }
  const freed = new Set(renumbered);

  for (const { entry, destroy, values } of writes) {
    const { youtubeId, before } = entry;
    if (destroy) {
      const removed = await VideoClassification.destroy({ where: unchangedSincePlan(youtubeId, before, freed.has(youtubeId)), transaction });
      if (!removed) throw rowChangedError(youtubeId);
      continue;
    }
    if (!before) {
      // A row created meanwhile makes this fail on the primary key.
      await VideoClassification.create({ youtube_id: youtubeId, ...values }, { transaction });
      continue;
    }
    // Only rows with a changed column are written, so zero affected rows
    // means the row no longer matches (MySQL counts changed rows, not matched ones).
    const [updated] = await VideoClassification.update(values, {
      where: unchangedSincePlan(youtubeId, before, freed.has(youtubeId)), transaction,
    });
    if (!updated) throw rowChangedError(youtubeId);
  }

  const downloaded = new Set(plan.entries.filter((entry) => entry.downloaded).map((entry) => entry.youtubeId));
  for (const duplicate of plan.duplicates) {
    await episodeConflicts.recordDuplicate({
      youtubeId: duplicate.youtubeId,
      channelId,
      showId: showIdOf(duplicate.showKey),
      season: duplicate.season,
      episode: duplicate.episode,
      duplicateOf: duplicate.duplicateOf,
      downloaded: downloaded.has(duplicate.youtubeId),
      transaction,
    });
  }
  // A classified video that is no longer a duplicate gives its conflict up,
  // whatever its row says (a TV channel's duplicate keeps its channel-show row).
  // A duplicate row the plan kept (decided at the video's download) stays one.
  const stillDuplicate = new Set([
    ...plan.duplicates.map((duplicate) => duplicate.youtubeId),
    ...plan.entries.filter(({ after }) => after && after.status === ROW_STATUS.DUPLICATE).map(({ youtubeId }) => youtubeId),
  ]);
  const conflicted = await episodeConflicts.duplicateIdsForChannel(channelId, { transaction });
  for (const { youtubeId, classified } of plan.entries) {
    if (classified !== false && conflicted.has(youtubeId) && !stillDuplicate.has(youtubeId)) {
      await episodeConflicts.release(youtubeId, { transaction });
    }
  }

  await episodeConflicts.clearErrorsForChannel(channelId, { transaction, youtubeIds: clearErrorsOf });

  for (const [key, value] of plan.highWater) {
    if (value <= (highWaterBefore.get(key) || 0)) continue;
    const separator = key.lastIndexOf('|');
    const showId = showIdOf(key.slice(0, separator));
    if (showId) await titleShowStore.raiseHighWater(showId, Number(key.slice(separator + 1)), value, { transaction });
  }
  return { showIds, patternIds };
}

module.exports = {
  applyPlan,
  isRowChangedError
};
