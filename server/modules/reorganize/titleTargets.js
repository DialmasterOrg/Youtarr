/**
 * Which moving videos belong to a title show, and the title shows a change
 * plans. Routing rule step 2: an episode of an active title show of a
 * subscribed channel goes to that show, whatever folder the channel uses.
 *
 * - A title show change (CHANGE_TITLE_SHOWS) follows its title plan: a video
 *   the plan puts in a show (numbered or waiting for an upload-time number)
 *   goes there; one it takes out of every show follows the channel layout.
 * - Any other change keeps the episodes of active title shows where they are.
 */

const { VideoClassification, TvShow } = require('../../models');
const { KIND_TITLE_SHOW } = require('../tvShows/constants');
const { folderNameKey } = require('../tvShows/showFolderNames');
const { ROW_STATUS } = require('../tvShows/titleNumbering');
const { CHANGE_TITLE_SHOWS, SHOW_ACTION } = require('./constants');

const SHOW_STATUSES = [ROW_STATUS.ASSIGNED, ROW_STATUS.PENDING];

function plannedShow({ key, ownerChannelId, showId, action, name, libraryFolder, folderName, previousLocation = null }) {
  const show = { key, kind: KIND_TITLE_SHOW, ownerChannelId, showId, action, name, libraryFolder, folderName };
  if (previousLocation) show.previousLocation = previousLocation;
  return show;
}

function fromTitlePlan(subjects, context) {
  const { titlePlan, drafts } = context;
  const channelId = context.channel.channel_id;
  const draftsByKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const entries = new Map(titlePlan.entries.map((entry) => [entry.youtubeId, entry]));
  const targets = new Map();
  const shows = new Map();

  for (const subject of subjects) {
    const entry = entries.get(subject.video.youtubeId);
    const after = entry ? entry.after : null;
    const draft = after ? draftsByKey.get(after.showKey) : null;
    if (!draft || !SHOW_STATUSES.includes(after.status)) continue;
    targets.set(subject.video.id, {
      showKey: draft.key,
      after,
      pattern: draft.patterns.find((pattern) => pattern.key === after.patternKey) || null,
      stored: titlePlan.stored.get(subject.video.youtubeId) || null,
    });
    if (shows.has(draft.key)) continue;
    const before = titlePlan.storedShows.get(draft.key);
    const moved = before && folderNameKey(before.libraryFolder, before.folderName) !== folderNameKey(draft.libraryFolder, draft.folderName);
    shows.set(draft.key, plannedShow({
      key: draft.key,
      ownerChannelId: channelId,
      showId: draft.id || null,
      action: !draft.id ? SHOW_ACTION.CREATE : moved ? SHOW_ACTION.MOVE : SHOW_ACTION.KEEP,
      name: draft.name,
      libraryFolder: draft.libraryFolder,
      folderName: draft.folderName,
      previousLocation: moved ? { libraryFolder: before.libraryFolder, folderName: before.folderName } : null,
    }));
  }
  return { targets, shows };
}

async function fromStoredRows(subjects, channels) {
  const targets = new Map();
  const shows = new Map();
  if (subjects.length === 0) return { targets, shows };
  const rows = await VideoClassification.findAll({
    where: { youtube_id: subjects.map((subject) => subject.video.youtubeId), status: ROW_STATUS.ASSIGNED },
  });
  if (rows.length === 0) return { targets, shows };
  const titleShows = await TvShow.findAll({
    where: { id: [...new Set(rows.map((row) => row.show_id))], kind: KIND_TITLE_SHOW, retired_at: null },
  });
  const showsById = new Map(titleShows.map((show) => [show.id, show]));
  const rowsById = new Map(rows.map((row) => [row.youtube_id, row]));

  for (const subject of subjects) {
    const row = rowsById.get(subject.video.youtubeId);
    const show = row ? showsById.get(row.show_id) : null;
    const owner = show ? channels.get(show.channel_id) : null;
    if (!show || !owner || !owner.enabled || row.season === null || row.episode === null || !row.file_stem) continue;
    const key = `title:${show.id}`;
    targets.set(subject.video.id, {
      showKey: key,
      after: {
        showKey: key, status: ROW_STATUS.ASSIGNED, season: row.season, episode: row.episode, source: row.source,
        episodeTitle: row.episode_title,
      },
      pattern: null,
      stored: { showKey: key, season: row.season, episode: row.episode, fileStem: row.file_stem },
    });
    if (!shows.has(key)) {
      shows.set(key, plannedShow({
        key, ownerChannelId: show.channel_id, showId: show.id, action: SHOW_ACTION.KEEP,
        name: show.name, libraryFolder: show.library_folder || '', folderName: show.folder_name,
      }));
    }
  }
  return { targets, shows };
}

/**
 * @param {Array<Object>} subjects - changeScope subjects
 * @param {Object} context - Resolved change
 * @param {Map<string, Object>} [channels] - channels rows by id (other changes)
 * @returns {Promise<{targets: Map<number, Object>, shows: Map<string, Object>}>}
 *   targets by Videos.id: { showKey, after, pattern, stored }; planned title shows by key
 */
async function resolveTitleTargets(subjects, context, channels = new Map()) {
  if (context.type === CHANGE_TITLE_SHOWS) return fromTitlePlan(subjects, context);
  return fromStoredRows(subjects, channels);
}

module.exports = {
  resolveTitleTargets
};
