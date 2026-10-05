/**
 * The reorganize plan for a settings change: every video that moves, where
 * its files go, the shows it pins, what can't move, and a revision token.
 * The preview shows a summary of it; apply recomputes it under the lock and
 * refuses when the token no longer matches.
 */

const path = require('path');
const { Op } = require('sequelize');
const configModule = require('../configModule');
const VideoWatchStatus = require('../../models/videowatchstatus');
const { LAYOUT_TV } = require('../tvShows/constants');
const { episodeCode } = require('../tvShows/episodeNaming');
const { isHoldable } = require('../mediaServers/watchStatusHolds');
const { resolveChange } = require('./changeContext');
const { selectSubjects } = require('./changeScope');
const { planShows } = require('./showPlanner');
const { planDestinations } = require('./destinationPlanner');
const { planRevision } = require('./revision');
const { takeTitleSnapshot } = require('./titleSnapshot');
const { PREVIEW_ITEM_LIMIT, PROBLEM, FLAG, CHANGE_TITLE_SHOWS } = require('./constants');

// Date-numbered codes (channel shows, adopted preset names, year/date title
// patterns) are 8 digits; title, order and manual numbers 2.
const DATE_SOURCES = new Set(['date', 'adopted']);

// A planned show's key: its owner channel for a channel show, its show key for a title show.
function showKeyOf(show) {
  return show.key || show.ownerChannelId;
}

function itemShowKey(item) {
  return (item.classification && item.classification.showKey) || item.channelId;
}

/**
 * @param {Object} rawChange - The requested change (changeContext.resolveChange)
 * @returns {Promise<Object>} { context, items, problems, unchanged, shows, revision, snapshot }
 *   snapshot: a title show change's shows and episode rows before it (to undo it), else null
 */
async function buildPlan(rawChange) {
  const context = await resolveChange(rawChange);
  const { subjects, channels } = await selectSubjects(context);
  const { targets, shows, titleTargets } = await planShows(subjects, context, channels);
  const { items, problems, unchanged } = await planDestinations({ subjects, context, targets, shows, titleTargets });
  const receiving = new Set(items.filter((item) => item.layout === LAYOUT_TV).map(itemShowKey));
  const plannedShows = [...shows.values()].filter((show) => receiving.has(showKeyOf(show)));
  return {
    context,
    items,
    problems,
    unchanged,
    shows: plannedShows,
    revision: planRevision({ change: context.stored, shows: plannedShows, items }),
    snapshot: context.type === CHANGE_TITLE_SHOWS ? await takeTitleSnapshot(context.channel.channel_id) : null,
  };
}

function relative(filePath) {
  if (!filePath) return null;
  return path.relative(configModule.directoryPath, filePath);
}

/**
 * Why a plan with nothing to move must not be applied as a bare settings
 * change: its videos could not be planned (no name, no date, an unsafe
 * destination), so applying would leave them all in the old layout. Files
 * that are gone are no reason to refuse.
 * @returns {{reason: string, message: string}|null}
 */
function applyRefusal(plan) {
  if (plan.items.length > 0) return null;
  const stuck = plan.problems.filter((problem) => problem.problem !== PROBLEM.MISSING).length;
  if (stuck === 0) return null;
  return {
    reason: 'problems',
    message: `None of the downloaded videos can be moved: ${stuck} could not be given a destination. `
      + 'The change is not applied until that is resolved.',
  };
}

function countWhere(list, test) {
  return list.reduce((total, entry) => total + (test(entry) ? 1 : 0), 0);
}

// Videos whose watch state the servers will lose with the move, per server.
// Plex accounts other than the owner come from play history, which a move
// never resets, so only the owner's state is counted for Plex.
async function watchStateAtRisk(items) {
  const videoIds = items.map((item) => item.videoId);
  if (videoIds.length === 0) return [];
  const rows = await VideoWatchStatus.findAll({
    where: {
      video_id: videoIds,
      [Op.or]: [{ played: true }, { position_ms: { [Op.gt]: 0 } }],
    },
    attributes: ['video_id', 'server_type', 'server_user_id', 'played', 'position_ms'],
    raw: true,
  });
  const byServer = new Map();
  for (const row of rows) {
    if (!isHoldable(row)) continue;
    if (!byServer.has(row.server_type)) byServer.set(row.server_type, { videos: new Set(), users: new Set() });
    byServer.get(row.server_type).videos.add(row.video_id);
    byServer.get(row.server_type).users.add(row.server_user_id);
  }
  return [...byServer.entries()].map(([serverType, { videos, users }]) => ({
    serverType, videos: videos.size, users: users.size,
  }));
}

function describeItem(item) {
  const from = item.oldVideoPath || item.oldAudioPath;
  const to = item.newVideoPath || item.newAudioPath;
  return {
    youtubeId: item.youtubeId,
    title: item.title,
    from: relative(from),
    to: relative(to),
    episode: item.classification
      ? episodeCode({
        season: item.classification.season,
        episode: item.classification.episode,
        dateNumbered: !item.classification.source || DATE_SOURCES.has(item.classification.source),
      })
      : null,
    flags: item.flags,
  };
}

/**
 * The preview's JSON for a plan.
 *
 * @param {Object} plan - buildPlan's result
 * @param {Object} [options]
 * @param {{reason: string, message: string}|null} [options.blocked] - Why apply would be refused right now
 * @returns {Promise<Object>}
 */
async function summarizePlan(plan, { blocked = null } = {}) {
  const { context, items, problems } = plan;
  const flagged = (flag) => countWhere(items, (item) => item.flags.includes(flag));
  const problemCount = (kind) => countWhere(problems, (problem) => problem.problem === kind);
  return {
    revision: plan.revision,
    needed: items.length > 0,
    change: { ...context.stored, label: context.label },
    totals: {
      videos: items.length,
      toTv: countWhere(items, (item) => item.layout === LAYOUT_TV && item.fromLayout !== LAYOUT_TV),
      toVideos: countWhere(items, (item) => item.layout !== LAYOUT_TV && item.fromLayout === LAYOUT_TV),
      betweenFolders: countWhere(items, (item) => item.layout === item.fromLayout),
      unchanged: plan.unchanged,
      missing: problemCount(PROBLEM.MISSING),
      collisions: problemCount(PROBLEM.COLLISION),
      noName: problemCount(PROBLEM.NO_NAME),
      noDate: problemCount(PROBLEM.NO_DATE),
      unsafeName: problemCount(PROBLEM.UNSAFE_NAME),
      episodeTaken: problemCount(PROBLEM.EPISODE_TAKEN),
      overridePlaced: flagged(FLAG.OVERRIDE_PLACED),
      adopted: flagged(FLAG.ADOPTED),
      uploadDateOnly: flagged(FLAG.UPLOAD_DATE_ONLY),
      downloadTime: flagged(FLAG.DOWNLOAD_TIME),
      movieTags: flagged(FLAG.MOVIE_TAGS),
      audioToTv: flagged(FLAG.AUDIO_TO_TV),
    },
    shows: plan.shows.map((show) => ({
      name: show.name, libraryFolder: show.libraryFolder, folderName: show.folderName, action: show.action,
      kind: show.kind || 'channel',
    })),
    // The TV folders videos move into: the preview shows their media server libraries.
    tvFolders: [...new Set(items.filter((item) => item.layout === LAYOUT_TV).map((item) => item.libraryFolder || ''))],
    items: items.slice(0, PREVIEW_ITEM_LIMIT).map(describeItem),
    problems: problems.slice(0, PREVIEW_ITEM_LIMIT).map((problem) => ({ ...problem, detail: relative(problem.detail) })),
    watchState: await watchStateAtRisk(items),
    blocked: blocked || applyRefusal(plan),
  };
}

module.exports = {
  buildPlan,
  summarizePlan,
  applyRefusal
};
