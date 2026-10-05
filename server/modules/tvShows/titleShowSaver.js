/**
 * Saving a channel's title shows. Every change (a show added, edited,
 * retired, restored or reordered, a manual episode assignment, "Not an
 * episode") is a new set of drafts plus overrides for the whole channel,
 * planned through titlePlanner. When no downloaded video's show, number or
 * folder changes it is saved right away; otherwise the caller gets a
 * reorganizeRequired 409 naming the change, which the reorganize previews and
 * applies (it moves the files).
 */

const { sequelize } = require('../../db');
const configModule = require('../configModule');
const reorganizeLock = require('../reorganize/reorganizeLock');
const { getLayoutResolver, listTvFolders } = require('./libraryLayouts');
const { effectiveLibraryFolder } = require('./channelFolders');
const { normalizeDrafts, defaultLibraryFolder, assertDraftsCompile } = require('./titleShowDrafts');
const titleShowStore = require('./titleShowStore');
const { planChannel } = require('./titlePlanner');
const { applyPlan, isRowChangedError } = require('./titleRowWriter');
const archiveSuppressor = require('./archiveSuppressor');
const { reorganizeRequiredError } = require('./layoutGuards');
const { MAX_SEASON, MIN_YEAR_SEASON, MAX_YEAR_SEASON, isAssignableSeason, PatternError } = require('./patternCompiler');

const CHANGE_TITLE_SHOWS = 'titleShows';
const MAX_EPISODE = 2147483647;
const MAX_OVERRIDES = 100;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MOVE_MESSAGE = 'Downloaded videos of this channel move with this change. Review the move first.';

function invalid(message) {
  return new PatternError(message);
}

function isUniqueConstraintError(err) {
  return Boolean(err && err.name === 'SequelizeUniqueConstraintError');
}

/**
 * @param {Array<Object>} rawOverrides - [{ youtubeId, showId, season, episode }], [{ youtubeId, notAnEpisode: true }]
 *   or [{ youtubeId, automatic: true }] (back to automatic classification)
 * @param {Array<Object>} drafts - Normalized drafts the assignments must point into
 * @returns {Map<string, Object>}
 */
function normalizeOverrides(rawOverrides, drafts) {
  if (!Array.isArray(rawOverrides)) throw invalid('overrides must be a list.');
  if (rawOverrides.length > MAX_OVERRIDES) throw invalid(`At most ${MAX_OVERRIDES} episode assignments at a time.`);
  const keys = new Set(drafts.map((draft) => draft.key));
  const overrides = new Map();
  for (const raw of rawOverrides) {
    if (!raw || typeof raw.youtubeId !== 'string' || !YOUTUBE_ID.test(raw.youtubeId)) throw invalid('Each assignment needs a video id.');
    if (raw.notAnEpisode === true) {
      overrides.set(raw.youtubeId, { optOut: true });
      continue;
    }
    if (raw.automatic === true) {
      overrides.set(raw.youtubeId, { reset: true });
      continue;
    }
    const showKey = `title:${raw.showId}`;
    if (!Number.isInteger(raw.showId) || !keys.has(showKey)) throw invalid('Choose one of this channel\'s shows.');
    if (!isAssignableSeason(raw.season)) {
      throw invalid(`The season must be 0 to ${MAX_SEASON}, or an upload year from ${MIN_YEAR_SEASON} to ${MAX_YEAR_SEASON}.`);
    }
    if (!Number.isInteger(raw.episode) || raw.episode < 1 || raw.episode > MAX_EPISODE) {
      throw invalid('The episode must be a whole number of at least 1.');
    }
    overrides.set(raw.youtubeId, { showKey, season: raw.season, episode: raw.episode });
  }
  return overrides;
}

/**
 * Validate the drafts and overrides and plan the channel with them.
 *
 * @param {Object} params
 * @param {Object} params.channel - channels row
 * @param {Array<Object>} params.rawShows - The channel's title shows after the change, in order
 * @param {Array<Object>} [params.rawOverrides]
 * @returns {Promise<{drafts: Array<Object>, overrides: Map<string, Object>, plan: Object}>}
 */
async function prepare({ channel, rawShows, rawOverrides = [] }) {
  const layoutOf = await getLayoutResolver();
  const tvFolders = await listTvFolders();
  const drafts = normalizeDrafts(rawShows, {
    layoutOf,
    tvFolders,
    defaultLibraryFolder: defaultLibraryFolder({
      channelFolder: effectiveLibraryFolder(channel.sub_folder),
      defaultFolder: configModule.getDefaultSubfolder() || '',
      tvFolders,
      layoutOf,
    }),
  });
  const overrides = normalizeOverrides(rawOverrides, drafts);
  await assertDraftsCompile(drafts);
  await titleShowStore.assertOwnShows({ channelId: channel.channel_id, drafts });
  await titleShowStore.assertFolderNamesFree({
    channelId: channel.channel_id,
    channelTitle: channel.title || channel.uploader || channel.channel_id,
    drafts,
  });
  const plan = await planChannel({ channel, drafts, overrides, downloadsDir: configModule.directoryPath });
  return { drafts, overrides, plan };
}

/**
 * The marks a plan started from (its allocations raise them).
 */
async function highWaterOf(plan) {
  const ids = [...plan.storedShows.values()].filter((show) => show.kind === 'title').map((show) => show.id);
  return titleShowStore.highWaterMarks(ids);
}

/**
 * Write a prepared plan (definitions, rows, conflicts) in one transaction,
 * then apply the archive changes it queued. The reorganize calls this when
 * it starts a title show change.
 * @param {Object} prepared
 * @param {Object} prepared.channel
 * @param {Array<Object>} prepared.drafts
 * @param {Object} prepared.plan
 * @param {(saved: Object, transaction: Object) => Promise<void>} [prepared.onWritten] - Runs inside
 *   the write's transaction with what was saved (the reorganize records its operation as applied)
 * @returns {Promise<{showIds: Map<string, number>, patternIds: Map<string, number>}>}
 */
async function applyPrepared({ channel, drafts, plan, onWritten = null }) {
  const highWaterBefore = await highWaterOf(plan);
  const saved = await sequelize.transaction(async (transaction) => {
    const result = await applyPlan({ channel, drafts, plan, highWaterBefore, transaction });
    if (onWritten) await onWritten(result, transaction);
    return result;
  });
  await archiveSuppressor.flush();
  return saved;
}

/**
 * Save a change to a channel's title shows, or refuse with reorganizeRequired.
 *
 * @param {Object} params
 * @param {Object} params.channel
 * @param {Array<Object>} params.rawShows
 * @param {Array<Object>} [params.rawOverrides]
 * @returns {Promise<Object>} The plan that was saved
 */
async function save({ channel, rawShows, rawOverrides = [] }) {
  reorganizeLock.assertChannelFree(channel.channel_id);
  for (let attempt = 0; ; attempt += 1) {
    const { drafts, plan } = await prepare({ channel, rawShows, rawOverrides });
    if (plan.requiresReorganize) {
      throw reorganizeRequiredError(MOVE_MESSAGE, {
        type: CHANGE_TITLE_SHOWS, channelId: channel.channel_id, shows: rawShows, overrides: rawOverrides,
      });
    }
    try {
      await applyPrepared({ channel, drafts, plan });
    } catch (err) {
      // A download post-processed meanwhile took a number this plan gave
      // away, or numbered a row this plan rewrites: plan again, once.
      if (attempt === 0 && (isUniqueConstraintError(err) || isRowChangedError(err))) continue;
      throw err;
    }
    return plan;
  }
}

/**
 * Classify videos a listing refresh just found, with the channel's stored
 * shows. Every other video keeps its row exactly (a creator's retitle never
 * renumbers); a new video whose file is already downloaded somewhere else is
 * left for the next show save, which moves it through the reorganize.
 *
 * @param {Object} params
 * @param {Object} params.channel
 * @param {string[]} params.youtubeIds - The new videos
 * @returns {Promise<Object|null>} The plan written, or null when there was nothing to classify
 */
async function classifyNew({ channel, youtubeIds }) {
  if (youtubeIds.length === 0) return null;
  const shows = await titleShowStore.listTitleShows(channel.channel_id);
  if (shows.length === 0 || reorganizeLock.coversChannel(channel.channel_id)) return null;
  const definitions = {
    showIds: new Map(shows.map((show) => [show.key, show.id])),
    patternIds: new Map(shows.flatMap((show) => show.patterns.map((pattern) => [pattern.key, pattern.id]))),
  };
  const planFor = (ids) => planChannel({ channel, drafts: shows, onlyIds: ids, downloadsDir: configModule.directoryPath });
  const newMovers = (planned, moving) => planned.entries
    .filter((entry) => entry.moves && !moving.has(entry.youtubeId)).map((entry) => entry.youtubeId);
  for (let attempt = 0; ; attempt += 1) {
    // Videos that would have to move are left out and the channel planned
    // again without them, until no other one would (a duplicate of one can
    // win next): otherwise their order numbers would be spent (high-water
    // marks only go up) and the videos losing to them recorded as duplicates
    // of a video that holds nothing. Each pass leaves out at least one video.
    const moving = new Set();
    let planned = await planFor(new Set(youtubeIds));
    for (let found = newMovers(planned, moving); found.length > 0; found = newMovers(planned, moving)) {
      for (const youtubeId of found) moving.add(youtubeId);
      planned = await planFor(new Set(youtubeIds.filter((youtubeId) => !moving.has(youtubeId))));
    }
    const plan = {
      ...planned,
      entries: planned.entries.filter((entry) => !moving.has(entry.youtubeId)),
      duplicates: planned.duplicates.filter((duplicate) => !moving.has(duplicate.youtubeId)),
    };
    const highWaterBefore = await highWaterOf(plan);
    try {
      await sequelize.transaction((transaction) => applyPlan({
        channel,
        drafts: shows,
        plan,
        highWaterBefore,
        transaction,
        definitions,
        clearErrorsOf: youtubeIds.filter((youtubeId) => !moving.has(youtubeId)),
      }));
    } catch (err) {
      if (attempt === 0 && (isUniqueConstraintError(err) || isRowChangedError(err))) continue;
      throw err;
    }
    await archiveSuppressor.flush();
    return plan;
  }
}

module.exports = {
  CHANGE_TITLE_SHOWS,
  applyPrepared,
  classifyNew,
  normalizeOverrides,
  prepare,
  save
};
