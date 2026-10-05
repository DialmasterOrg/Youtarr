/**
 * A channel's title shows after a change, worked out for every video of the
 * channel (its listing plus its downloads): which show, season and episode
 * each video gets, duplicates and unsupported matches, and which downloaded
 * videos have to move (so the change goes through the reorganize).
 *
 * Nothing is written here. The preview, direct saves and the reorganize all
 * plan through planChannel, so they agree.
 */

const path = require('path');
const { Op } = require('sequelize');
const { Video, VideoClassification, TvShow } = require('../../models');
const ChannelVideo = require('../../models/channelvideo');
const titleShowStore = require('./titleShowStore');
const { matchVideos } = require('./titleMatcher');
const { planNumbers, ROW_STATUS } = require('./titleNumbering');
const { KIND_TITLE_SHOW } = require('./constants');

const MEMBERS_ONLY = 'subscriber_only';
const PLACEMENT_LAYOUT = 'layout';

function showKeyOfRow(show) {
  return show.kind === KIND_TITLE_SHOW ? `title:${show.id}` : `channel:${show.channel_id}`;
}

function dateMs(value) {
  if (!value) return null;
  if (/^\d{8}$/.test(String(value))) {
    const text = String(value);
    return Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)));
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// The UTC year of a download's upload date (yt-dlp's upload_date, YYYYMMDD):
// exact, unlike a listing date, so a year season can be decided from it.
function uploadYearOf(originalDate) {
  return /^\d{8}$/.test(String(originalDate || '')) ? Number(String(originalDate).slice(0, 4)) : null;
}

// A show's folder as spelled: the database tells folder names apart ignoring
// case and accents (folderNameKey), but most filesystems don't, so a rename
// that changes only those still moves the files.
function locationKey(show) {
  return `${show.libraryFolder || ''}/${show.folderName}`;
}

// The reorganize moves only files under the downloads folder.
function isOutside(filePath, downloadsDir) {
  if (!filePath || !downloadsDir) return false;
  const relative = path.relative(path.resolve(downloadsDir), path.resolve(filePath));
  return !relative || relative.startsWith('..') || path.isAbsolute(relative);
}

/**
 * Load a channel's videos and their stored classifications.
 * @param {Object} channel - channels row
 * @param {Object} [options]
 * @param {string|null} [options.downloadsDir] - Marks downloads whose file is outside it (`outsideDownloads`)
 * @returns {Promise<{videos: Array<Object>, stored: Map<string, Object>, storedShows: Map<string, Object>}>}
 */
async function loadChannelState(channel, { downloadsDir = null } = {}) {
  const channelId = channel.channel_id;
  const listing = await ChannelVideo.findAll({
    where: { channel_id: channelId },
    attributes: ['youtube_id', 'title', 'publishedAt', 'youtube_removed', 'availability'],
    raw: true,
  });
  const listedIds = listing.map((row) => row.youtube_id);
  const downloads = await Video.findAll({
    where: { [Op.or]: [{ channel_id: channelId }, ...(listedIds.length ? [{ youtubeId: listedIds }] : [])] },
    attributes: ['id', 'youtubeId', 'youTubeVideoName', 'originalDate', 'channel_id', 'filePath', 'audioFilePath', 'removed'],
    raw: true,
  });
  const downloadById = new Map(downloads.map((row) => [row.youtubeId, row]));

  const videos = [];
  const seen = new Set();
  const addVideo = (youtubeId, { title, publishedAtMs, available }) => {
    if (seen.has(youtubeId)) return;
    seen.add(youtubeId);
    const download = downloadById.get(youtubeId);
    const filePath = download && !download.removed ? download.filePath || download.audioFilePath || null : null;
    videos.push({
      youtubeId,
      title: title || (download && download.youTubeVideoName) || '',
      publishedAtMs: publishedAtMs !== null ? publishedAtMs : (download && dateMs(download.originalDate)) || 0,
      available,
      downloaded: Boolean(filePath),
      filePath,
      outsideDownloads: isOutside(filePath, downloadsDir),
      // Known exactly only for a download (its info.json); a listing date can be approximate.
      uploadYear: filePath ? uploadYearOf(download.originalDate) : null,
      videoId: download ? download.id : null,
    });
  };
  for (const row of listing) {
    addVideo(row.youtube_id, {
      title: row.title,
      publishedAtMs: dateMs(row.publishedAt),
      available: !row.youtube_removed && row.availability !== MEMBERS_ONLY,
    });
  }
  for (const row of downloads) {
    if (row.channel_id === channelId) addVideo(row.youtubeId, { title: row.youTubeVideoName, publishedAtMs: null, available: true });
  }
  // Episodes classified for this channel that it neither lists nor downloaded
  // under its id (a VEVO or Topic upload) still hold their numbers.
  // A row with no video record at all is held as stored (`orphan`).
  const unlisted = (await VideoClassification.findAll({
    where: { channel_id: channelId }, attributes: ['youtube_id', 'episode_title'], raw: true,
  })).filter((row) => !seen.has(row.youtube_id));
  if (unlisted.length) {
    const elsewhere = await Video.findAll({
      where: { youtubeId: unlisted.map((row) => row.youtube_id) },
      attributes: ['id', 'youtubeId', 'youTubeVideoName', 'originalDate', 'channel_id', 'filePath', 'audioFilePath', 'removed'],
      raw: true,
    });
    for (const row of elsewhere) downloadById.set(row.youtubeId, row);
    for (const row of unlisted) {
      const download = downloadById.get(row.youtube_id);
      addVideo(row.youtube_id, { title: download ? download.youTubeVideoName : row.episode_title, publishedAtMs: null, available: true });
      if (!download) videos[videos.length - 1].orphan = true;
    }
  }

  const rows = videos.length
    ? await VideoClassification.findAll({ where: { youtube_id: videos.map((entry) => entry.youtubeId) } })
    : [];
  const foreign = new Set(rows.filter((row) => row.channel_id !== channelId).map((row) => row.youtube_id));
  const ownRows = rows.filter((row) => row.channel_id === channelId);

  const titleShows = await titleShowStore.listTitleShows(channelId, { includeRetired: true });
  const patternKeyById = new Map();
  for (const show of titleShows) for (const pattern of show.patterns) patternKeyById.set(pattern.id, pattern.key);
  const showRows = ownRows.length
    ? await TvShow.findAll({ where: { id: [...new Set(ownRows.map((row) => row.show_id))] } })
    : [];
  const storedShows = new Map();
  for (const show of showRows) {
    storedShows.set(showKeyOfRow(show), {
      key: showKeyOfRow(show), id: show.id, kind: show.kind, active: !show.retired_at,
      name: show.name, folderName: show.folder_name, libraryFolder: show.library_folder || '',
    });
  }
  for (const show of titleShows) {
    storedShows.set(show.key, {
      key: show.key, id: show.id, kind: KIND_TITLE_SHOW, active: !show.retired,
      name: show.name, folderName: show.folderName, libraryFolder: show.libraryFolder,
    });
  }
  const showKeyById = new Map([...storedShows.values()].map((show) => [show.id, show.key]));

  const stored = new Map();
  for (const row of ownRows) {
    const showKey = showKeyById.get(row.show_id);
    const show = storedShows.get(showKey);
    if (!show) continue;
    stored.set(row.youtube_id, {
      showKey,
      showId: row.show_id,
      showKind: show.kind,
      showActive: show.active,
      status: row.status,
      season: row.season,
      episode: row.episode,
      source: row.source,
      titleOptOut: Boolean(row.title_opt_out),
      patternKey: patternKeyById.get(row.pattern_id) || null,
      patternId: row.pattern_id,
      episodeTitle: row.episode_title,
      fileStem: row.file_stem,
      timestampSource: row.timestamp_source,
    });
  }
  return { videos: videos.filter((entry) => !foreign.has(entry.youtubeId)), stored, storedShows };
}

function beforePlacement(entry, stored, storedShows) {
  const row = stored.get(entry.youtubeId);
  if (!entry.downloaded || !row || row.showKind !== KIND_TITLE_SHOW || row.status !== ROW_STATUS.ASSIGNED || !row.fileStem) {
    return PLACEMENT_LAYOUT;
  }
  const show = storedShows.get(row.showKey);
  if (!show || !path.basename(entry.filePath).startsWith(row.fileStem)) return PLACEMENT_LAYOUT;
  return `title|${row.showKey}|${row.season}|${row.episode}|${locationKey(show)}`;
}

function afterPlacement(row, draftsByKey) {
  if (!row || !draftsByKey.has(row.showKey)) return PLACEMENT_LAYOUT;
  if (row.status === ROW_STATUS.PENDING) return `pending|${row.showKey}`;
  if (row.status !== ROW_STATUS.ASSIGNED) return PLACEMENT_LAYOUT;
  return `title|${row.showKey}|${row.season}|${row.episode}|${locationKey(draftsByKey.get(row.showKey))}`;
}

/**
 * Plan a channel's title shows (pure).
 *
 * @param {Object} params
 * @param {Array<Object>} params.drafts - Normalized title shows after the change
 * @param {Map<string, Object>} params.storedShows - Stored shows by key (all of the channel's title shows)
 * @param {Array<Object>} params.videos - loadChannelState videos
 * @param {Map<string, Object>} params.stored - Stored rows by youtube id
 * @param {Map<string, Object>} params.matches - titleMatcher results against the drafts
 * @param {Map<string, number>} params.highWater
 * @param {Map<string, Object>} [params.overrides]
 * @param {Set<string>|null} [params.onlyIds] - Classify only these videos; every other one stays as stored
 * @returns {Object} { entries, duplicates, unsupported, highWater, retired, relocated, requiresReorganize, knownVideos }
 *   Each entry { youtubeId, title, downloaded, available, filePath, videoId, before, after, moves, staysOutside, classified };
 *   only videos with a match or a stored row
 */
function buildChannelPlan({ drafts, storedShows, videos, stored, matches, highWater, overrides = new Map(), onlyIds = null }) {
  const draftsByKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const planningRows = new Map();
  for (const [youtubeId, row] of stored) {
    const active = row.showKind !== KIND_TITLE_SHOW || draftsByKey.has(row.showKey);
    planningRows.set(youtubeId, { ...row, showActive: active });
  }
  const frozen = new Set(videos.filter((video) => video.orphan || (onlyIds && !onlyIds.has(video.youtubeId))).map((video) => video.youtubeId));
  const numbers = planNumbers({ videos, matches, stored: planningRows, highWater, overrides, frozen });

  const entries = [];
  for (const video of videos) {
    const before = stored.get(video.youtubeId) || null;
    if (!before && !numbers.rows.has(video.youtubeId)) continue;
    const after = numbers.rows.has(video.youtubeId) ? numbers.rows.get(video.youtubeId) : before;
    const placementChanges = video.downloaded
      && beforePlacement(video, stored, storedShows) !== afterPlacement(after, draftsByKey);
    // A file outside the downloads folder stays where it is: its row follows
    // the change, and no review is needed for it.
    const staysOutside = placementChanges && Boolean(video.outsideDownloads);
    const moves = placementChanges && !staysOutside;
    entries.push({ ...video, before, after, moves, staysOutside, classified: !frozen.has(video.youtubeId) });
  }

  const retired = [...storedShows.values()]
    .filter((show) => show.kind === KIND_TITLE_SHOW && show.active && !draftsByKey.has(show.key))
    .map((show) => show.key);
  const relocated = drafts
    .filter((draft) => storedShows.has(draft.key) && locationKey(storedShows.get(draft.key)) !== locationKey(draft))
    .map((draft) => draft.key);

  return {
    entries,
    duplicates: numbers.duplicates,
    unsupported: numbers.unsupported,
    highWater: numbers.highWater,
    retired,
    relocated,
    requiresReorganize: entries.some((entry) => entry.moves),
    knownVideos: videos.length,
  };
}

/**
 * Plan a channel's title shows after a change.
 *
 * @param {Object} params
 * @param {Object} params.channel - channels row
 * @param {Array<Object>} params.drafts - Normalized title shows after the change
 * @param {Map<string, Object>} [params.overrides] - Manual assignments and opt-outs by youtube id
 * @param {Set<string>|null} [params.onlyIds] - Classify only these videos (new listing rows)
 * @param {string|null} [params.downloadsDir] - The downloads folder (files outside it never move)
 * @returns {Promise<Object>} buildChannelPlan's result plus { drafts, storedShows, stored, videos }
 */
async function planChannel({ channel, drafts, overrides = new Map(), onlyIds = null, downloadsDir = null }) {
  const state = await loadChannelState(channel, { downloadsDir });
  const toMatch = state.videos.filter((video) => !video.orphan && (!onlyIds || onlyIds.has(video.youtubeId)));
  const matches = await matchVideos(drafts, toMatch);
  const existingIds = [...state.storedShows.values()].filter((show) => show.kind === KIND_TITLE_SHOW).map((show) => show.id);
  const highWater = await titleShowStore.highWaterMarks(existingIds);
  const plan = buildChannelPlan({ drafts, ...state, matches, highWater, overrides, onlyIds });
  return { ...plan, drafts, storedShows: state.storedShows, stored: state.stored, videos: state.videos };
}

module.exports = {
  loadChannelState,
  buildChannelPlan,
  planChannel
};
