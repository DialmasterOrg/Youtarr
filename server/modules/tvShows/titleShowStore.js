/**
 * Stored title shows (tv_shows rows of kind 'title' with their patterns and
 * seasons): reading them, saving a channel's whole set of definitions, order
 * high-water marks, folder availability and download filters.
 *
 * A save replaces each show's patterns and retires the active shows it
 * leaves out (a retired show keeps its row, location and numbers so it can
 * be restored).
 */

const { randomUUID } = require('crypto');
const { TvShow, TvShowPattern, TvShowSeason } = require('../../models');
const { KIND_TITLE_SHOW } = require('./constants');
const { folderNameKey } = require('./showFolderNames');
const { buildShowFilter, excludeTermRegex } = require('./patternCompiler');

function storeError(message, status, details = null) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function parseTerms(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((term) => typeof term === 'string') : [];
  } catch (err) {
    return [];
  }
}

function serializePattern(row, showKey) {
  return {
    id: row.id,
    key: `${showKey}#${row.position}`,
    position: row.position,
    text: row.pattern_text,
    kind: row.pattern_kind,
    compiledRegex: row.compiled_regex,
    filterRegex: row.filter_regex,
    seasonSource: row.season_source,
    seasonFixed: row.season_fixed,
    episodeSource: row.episode_source,
  };
}

function serializeShow(row) {
  const key = `title:${row.id}`;
  const seasonNames = {};
  for (const season of row.seasons || []) {
    if (season.name) seasonNames[season.season] = season.name;
  }
  return {
    id: row.id,
    key,
    channelId: row.channel_id,
    name: row.name,
    folderName: row.folder_name,
    libraryFolder: row.library_folder || '',
    position: row.position,
    externalKey: row.external_key,
    excludeTerms: parseTerms(row.exclude_terms),
    seasonNames,
    retired: Boolean(row.retired_at),
    retiredAt: row.retired_at || null,
    patterns: [...(row.patterns || [])].sort((a, b) => a.position - b.position).map((pattern) => serializePattern(pattern, key)),
  };
}

const INCLUDE = [
  { model: TvShowPattern, as: 'patterns' },
  { model: TvShowSeason, as: 'seasons' },
];

/**
 * @param {string} channelId
 * @param {{includeRetired?: boolean}} [options]
 * @returns {Promise<Array<Object>>} Serialized shows, active ones by position first
 */
async function listTitleShows(channelId, { includeRetired = false } = {}) {
  const where = { channel_id: channelId, kind: KIND_TITLE_SHOW };
  if (!includeRetired) where.retired_at = null;
  const rows = await TvShow.findAll({ where, include: INCLUDE });
  return rows.map(serializeShow).sort((a, b) => (a.retired === b.retired ? a.position - b.position : a.retired ? 1 : -1));
}

/**
 * Active title shows of several channels, by channel id.
 * @returns {Promise<Map<string, Array<Object>>>}
 */
async function listActiveByChannel(channelIds) {
  const result = new Map();
  if (channelIds.length === 0) return result;
  const rows = await TvShow.findAll({ where: { channel_id: channelIds, kind: KIND_TITLE_SHOW, retired_at: null }, include: INCLUDE });
  for (const show of rows.map(serializeShow).sort((a, b) => a.position - b.position)) {
    if (!result.has(show.channelId)) result.set(show.channelId, []);
    result.get(show.channelId).push(show);
  }
  return result;
}

/**
 * A stored show as the draft that would save it unchanged.
 */
function toDraft(show) {
  return {
    id: show.id,
    name: show.name,
    folderName: show.folderName,
    libraryFolder: show.libraryFolder,
    excludeTerms: [...show.excludeTerms],
    seasonNames: { ...show.seasonNames },
    patterns: show.patterns.map((pattern) => ({
      text: pattern.text,
      kind: pattern.kind,
      seasonSource: pattern.seasonSource,
      seasonFixed: pattern.seasonFixed,
      episodeSource: pattern.episodeSource,
    })),
  };
}

async function saveSeasonNames(showId, seasonNames, transaction) {
  const rows = await TvShowSeason.findAll({ where: { show_id: showId }, transaction });
  const bySeason = new Map(rows.map((row) => [row.season, row]));
  for (const [key, name] of Object.entries(seasonNames)) {
    const season = Number(key);
    const row = bySeason.get(season);
    if (!row) await TvShowSeason.create({ show_id: showId, season, name }, { transaction });
    else if (row.name !== name) await row.update({ name }, { transaction });
  }
  for (const row of rows) {
    if (row.name && !Object.prototype.hasOwnProperty.call(seasonNames, row.season)) {
      await row.update({ name: null }, { transaction });
    }
  }
}

/**
 * Write a channel's title shows: create or update each draft (by position),
 * replace its patterns and season names, and retire the channel's active
 * shows the drafts leave out.
 *
 * @param {Object} params
 * @param {string} params.channelId
 * @param {Array<Object>} params.drafts - Normalized drafts (titleShowDrafts)
 * @param {Object} [params.transaction]
 * @returns {Promise<{showIds: Map<string, number>, patternIds: Map<string, number>}>} By draft and pattern key
 */
async function saveDefinitions({ channelId, drafts, transaction = null }) {
  const existing = await TvShow.findAll({ where: { channel_id: channelId, kind: KIND_TITLE_SHOW }, transaction });
  const byId = new Map(existing.map((row) => [row.id, row]));
  const showIds = new Map();
  const patternIds = new Map();
  const kept = new Set();

  for (const draft of drafts) {
    const values = {
      name: draft.name,
      folder_name: draft.folderName,
      library_folder: draft.libraryFolder || '',
      position: draft.position,
      exclude_terms: JSON.stringify(draft.excludeTerms),
      retired_at: null,
    };
    let showId;
    if (draft.id) {
      const row = byId.get(draft.id);
      if (!row) throw storeError('Show not found', 404);
      await row.update(values, { transaction });
      showId = row.id;
      kept.add(row.id);
    } else {
      const row = await TvShow.create({
        ...values, channel_id: channelId, kind: KIND_TITLE_SHOW, external_key: randomUUID(),
      }, { transaction });
      showId = row.id;
    }
    showIds.set(draft.key, showId);

    await TvShowPattern.destroy({ where: { show_id: showId }, transaction });
    const created = await TvShowPattern.bulkCreate(draft.patterns.map((pattern) => ({
      show_id: showId,
      position: pattern.position,
      pattern_text: pattern.text,
      pattern_kind: pattern.kind,
      compiled_regex: pattern.compiledRegex,
      filter_regex: pattern.filterRegex,
      season_source: pattern.seasonSource,
      season_fixed: pattern.seasonFixed,
      episode_source: pattern.episodeSource,
    })), { transaction });
    draft.patterns.forEach((pattern, index) => patternIds.set(pattern.key, created[index].id));
    await saveSeasonNames(showId, draft.seasonNames, transaction);
  }

  for (const row of existing) {
    if (!kept.has(row.id) && !row.retired_at) await row.update({ retired_at: new Date() }, { transaction });
  }
  return { showIds, patternIds };
}

/**
 * Refuse drafts whose folder another show already uses in that library
 * folder (retired shows included: their folder is kept for a restore).
 * @throws {Error} status 409 with details { suggestion, retiredShowId? }
 */
async function assertFolderNamesFree({ channelId, channelTitle, drafts }) {
  if (drafts.length === 0) return;
  const folders = [...new Set(drafts.map((draft) => draft.libraryFolder || ''))];
  const rows = await TvShow.findAll({
    where: { library_folder: folders },
    attributes: ['id', 'name', 'folder_name', 'library_folder', 'channel_id', 'kind', 'retired_at'],
  });
  const ownIds = new Set(drafts.filter((draft) => draft.id).map((draft) => draft.id));
  for (const draft of drafts) {
    const key = folderNameKey(draft.libraryFolder, draft.folderName);
    const holder = rows.find((row) => !ownIds.has(row.id) && folderNameKey(row.library_folder, row.folder_name) === key);
    if (!holder) continue;
    const restorable = holder.kind === KIND_TITLE_SHOW && holder.retired_at && holder.channel_id === channelId;
    const details = { suggestion: `${draft.name} (${channelTitle})` };
    if (restorable) details.retiredShowId = holder.id;
    throw storeError(
      restorable
        ? `The removed show "${holder.name}" used the folder "${draft.folderName}". Restore it, or choose another folder name.`
        : `The folder "${draft.folderName}" is already used by the show "${holder.name}". Try "${details.suggestion}".`,
      409,
      details
    );
  }
}

/**
 * @returns {Promise<Map<string, number>>} order_high_water by `title:<id>|<season>`
 */
async function highWaterMarks(showIds) {
  const marks = new Map();
  if (showIds.length === 0) return marks;
  const rows = await TvShowSeason.findAll({ where: { show_id: showIds }, attributes: ['show_id', 'season', 'order_high_water'] });
  for (const row of rows) marks.set(`title:${row.show_id}|${row.season}`, row.order_high_water);
  return marks;
}

/**
 * Every title show id of a channel, retired ones included.
 * @returns {Promise<number[]>}
 */
async function titleShowIds(channelId, { transaction = null } = {}) {
  const rows = await TvShow.findAll({ where: { channel_id: channelId, kind: KIND_TITLE_SHOW }, attributes: ['id'], transaction });
  return rows.map((row) => row.id);
}

/**
 * Delete title shows outright (their patterns and seasons go with them), for
 * shows a change created and then took back. Nothing may still reference them.
 */
async function deleteShows(showIds, { transaction = null } = {}) {
  if (showIds.length === 0) return;
  await TvShow.destroy({ where: { id: showIds, kind: KIND_TITLE_SHOW }, transaction });
}

/**
 * Record an allocated order number; the mark never goes down.
 */
async function raiseHighWater(showId, season, value, { transaction = null } = {}) {
  let row = await TvShowSeason.findOne({ where: { show_id: showId, season }, transaction });
  if (!row) {
    try {
      await TvShowSeason.create({ show_id: showId, season, order_high_water: value }, { transaction });
      return;
    } catch (err) {
      // Another writer (a download or a save) created the season meanwhile.
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      row = await TvShowSeason.findOne({ where: { show_id: showId, season }, transaction });
      if (!row) throw err;
    }
  }
  if (value > row.order_high_water) await row.update({ order_high_water: value }, { transaction });
}

/**
 * The show-only download filters of channels: per active title show, its
 * patterns as one alternation and its exclude terms.
 * @returns {Promise<Map<string, Array<{filterRegex: string, excludeRegexes: string[]}>>>}
 */
async function showFiltersByChannel(channelIds) {
  const filters = new Map();
  for (const [channelId, shows] of await listActiveByChannel(channelIds)) {
    filters.set(channelId, shows.map((show) => ({
      filterRegex: buildShowFilter(show.patterns.map((pattern) => pattern.filterRegex)),
      excludeRegexes: show.excludeTerms.map(excludeTermRegex),
    })));
  }
  return filters;
}

module.exports = {
  serializeShow,
  listTitleShows,
  listActiveByChannel,
  toDraft,
  saveDefinitions,
  assertFolderNamesFree,
  highWaterMarks,
  raiseHighWater,
  titleShowIds,
  deleteShows,
  showFiltersByChannel
};
