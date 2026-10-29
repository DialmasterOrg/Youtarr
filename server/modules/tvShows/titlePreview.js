/**
 * The title show preview (pure): a titlePlanner plan shaped for the editor's
 * tabs - each show's episodes with their download state, duplicates with the
 * upload that keeps the number, gaps per season, compilations and parts not
 * placed yet, the videos no show takes, and stored episodes that would change.
 */

const { episodeCode } = require('./episodeNaming');
const { computeGaps, ROW_STATUS, SOURCE } = require('./titleNumbering');

const DEFAULT_LIST_LIMIT = 500;
const DOWNLOAD_STATE = Object.freeze({ DOWNLOADED: 'downloaded', QUEUED: 'queued', NOT_DOWNLOADED: 'not_downloaded' });

function codeOf(row) {
  if (!row || row.season === null || row.season === undefined || row.episode === null || row.episode === undefined) return null;
  return episodeCode({ season: row.season, episode: row.episode, dateNumbered: row.source === SOURCE.DATE });
}

function sameOutcome(a, b) {
  if (!a || !b) return a === b;
  return a.showKey === b.showKey && a.status === b.status && a.season === b.season && a.episode === b.episode;
}

/**
 * @param {Object} plan - titlePlanner.planChannel's result
 * @param {Object} options
 * @param {Array<Object>} options.videos - Every known video of the channel (loadChannelState)
 * @param {(youtubeId: string) => boolean} [options.isQueued]
 * @param {number} [options.listLimit] - Longest list per tab; counts stay complete
 */
function summarizePlan(plan, { videos, isQueued = () => false, listLimit = DEFAULT_LIST_LIMIT }) {
  const titles = new Map(videos.map((video) => [video.youtubeId, video.title]));
  const downloaded = new Set(videos.filter((video) => video.downloaded).map((video) => video.youtubeId));
  const draftsByKey = new Map(plan.drafts.map((draft) => [draft.key, draft]));
  const showName = (key) => (draftsByKey.get(key) || plan.storedShows.get(key) || {}).name || null;
  const describe = (row, names) => (row ? { showKey: row.showKey, showName: names(row.showKey), code: codeOf(row), status: row.status } : null);

  const shows = plan.drafts.map((draft) => ({
    key: draft.key, id: draft.id, name: draft.name, folderName: draft.folderName, libraryFolder: draft.libraryFolder,
    counts: { episodes: 0, downloaded: 0, pending: 0, duplicates: 0, unsupported: 0 },
    episodes: [],
  }));
  const showsByKey = new Map(shows.map((show) => [show.key, show]));
  // Videos a show matched (episodes, duplicates, compilations and parts), so not unmatched.
  const matched = new Set();
  const countedDuplicates = new Set();
  const afterRows = [];

  for (const entry of plan.entries) {
    const { after } = entry;
    const show = after ? showsByKey.get(after.showKey) : null;
    if (!show) continue;
    if (after.status === ROW_STATUS.DUPLICATE || after.status === ROW_STATUS.UNSUPPORTED) matched.add(entry.youtubeId);
    if (after.status === ROW_STATUS.DUPLICATE) {
      show.counts.duplicates += 1;
      countedDuplicates.add(entry.youtubeId);
    }
    if (after.status === ROW_STATUS.UNSUPPORTED) show.counts.unsupported += 1;
    if (after.status !== ROW_STATUS.ASSIGNED && after.status !== ROW_STATUS.PENDING) continue;
    matched.add(entry.youtubeId);
    afterRows.push(after);
    show.counts.episodes += 1;
    if (after.status === ROW_STATUS.PENDING) show.counts.pending += 1;
    if (entry.downloaded) show.counts.downloaded += 1;
    const draft = draftsByKey.get(after.showKey);
    show.episodes.push({
      youtubeId: entry.youtubeId,
      title: entry.title,
      season: after.season,
      episode: after.episode,
      code: codeOf(after),
      status: after.status,
      episodeTitle: after.episodeTitle,
      patternIndex: draft.patterns.findIndex((pattern) => pattern.key === after.patternKey),
      downloadState: entry.downloaded
        ? DOWNLOAD_STATE.DOWNLOADED
        : isQueued(entry.youtubeId) ? DOWNLOAD_STATE.QUEUED : DOWNLOAD_STATE.NOT_DOWNLOADED,
    });
  }
  for (const show of shows) {
    show.episodes.sort((a, b) => ((a.season ?? Infinity) - (b.season ?? Infinity)) || ((a.episode ?? Infinity) - (b.episode ?? Infinity))
      || (a.youtubeId < b.youtubeId ? -1 : 1));
    show.truncated = show.episodes.length > listLimit;
    show.episodes = show.episodes.slice(0, listLimit);
  }

  // A channel-show episode that loses a title claim keeps its channel-show
  // row, so only the plan's duplicates list names it.
  for (const duplicate of plan.duplicates) {
    const show = showsByKey.get(duplicate.showKey);
    if (!show || countedDuplicates.has(duplicate.youtubeId)) continue;
    matched.add(duplicate.youtubeId);
    show.counts.duplicates += 1;
  }

  const unmatched = videos.filter((video) => !matched.has(video.youtubeId));
  const changes = plan.entries
    .filter((entry) => entry.moves || (entry.before && !sameOutcome(entry.before, entry.after)))
    .map((entry) => ({
      youtubeId: entry.youtubeId,
      title: entry.title,
      downloaded: entry.downloaded,
      from: describe(entry.before, (key) => (plan.storedShows.get(key) || {}).name || null),
      to: describe(entry.after && draftsByKey.has(entry.after.showKey) ? entry.after : null, showName),
    }));

  return {
    knownVideos: plan.knownVideos,
    shows,
    duplicates: plan.duplicates.slice(0, listLimit).map((duplicate) => ({
      ...duplicate,
      title: titles.get(duplicate.youtubeId) || null,
      showName: showName(duplicate.showKey),
      code: codeOf({ ...duplicate, source: SOURCE.TITLE }),
      duplicateOfTitle: titles.get(duplicate.duplicateOf) || null,
      downloaded: downloaded.has(duplicate.youtubeId),
    })),
    gaps: computeGaps(afterRows),
    unsupported: plan.unsupported.slice(0, listLimit).map((entry) => ({
      ...entry, title: titles.get(entry.youtubeId) || null, showName: showName(entry.showKey),
    })),
    unmatched: {
      count: unmatched.length,
      videos: unmatched.slice(0, listLimit).map((video) => ({ youtubeId: video.youtubeId, title: video.title, downloaded: video.downloaded })),
    },
    changes: changes.slice(0, listLimit),
    changeCount: changes.length,
    // Downloads outside the downloads folder whose files stay where they are.
    staysOutside: plan.entries.filter((entry) => entry.staysOutside).length,
    filesToMove: plan.entries.filter((entry) => entry.moves).length,
    retired: plan.retired.map((key) => ({ key, name: showName(key) })),
    relocated: plan.relocated.map((key) => ({ key, name: showName(key) })),
  };
}

module.exports = {
  DOWNLOAD_STATE,
  summarizePlan
};
