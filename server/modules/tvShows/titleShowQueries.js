/**
 * Read-only queries about title shows for the UI: per-show counts, how many
 * shows each channel has, a show's missing episodes, the videos of a show
 * (the channel page's show filter), and the planned episode of videos not
 * downloaded yet (their episode chip).
 */

const { TvShow, VideoClassification, Video, TvShowSeason } = require('../../models');
const ChannelVideo = require('../../models/channelvideo');
const { KIND_TITLE_SHOW } = require('./constants');
const { episodeCode } = require('./episodeNaming');
const { computeGaps, ROW_STATUS, SOURCE } = require('./titleNumbering');

const EPISODE_STATUSES = [ROW_STATUS.ASSIGNED, ROW_STATUS.PENDING];

async function presentDownloads(youtubeIds) {
  if (youtubeIds.length === 0) return new Set();
  const rows = await Video.findAll({ where: { youtubeId: youtubeIds, removed: false }, attributes: ['youtubeId'], raw: true });
  return new Set(rows.map((row) => row.youtubeId));
}

function codeOf(row) {
  return episodeCode({ season: row.season, episode: row.episode, dateNumbered: row.source === SOURCE.DATE });
}

/**
 * @param {number[]} showIds
 * @returns {Promise<Map<number, {episodes: number, downloaded: number, duplicates: number, unsupported: number}>>}
 */
async function countsByShow(showIds) {
  const counts = new Map(showIds.map((id) => [id, { episodes: 0, downloaded: 0, duplicates: 0, unsupported: 0 }]));
  if (showIds.length === 0) return counts;
  const rows = await VideoClassification.findAll({ where: { show_id: showIds }, attributes: ['youtube_id', 'show_id', 'status'], raw: true });
  const episodes = rows.filter((row) => EPISODE_STATUSES.includes(row.status));
  const downloaded = await presentDownloads(episodes.map((row) => row.youtube_id));
  for (const row of rows) {
    const count = counts.get(row.show_id);
    if (!count) continue;
    if (EPISODE_STATUSES.includes(row.status)) {
      count.episodes += 1;
      if (downloaded.has(row.youtube_id)) count.downloaded += 1;
    } else if (row.status === ROW_STATUS.DUPLICATE) {
      count.duplicates += 1;
    } else if (row.status === ROW_STATUS.UNSUPPORTED) {
      count.unsupported += 1;
    }
  }
  return counts;
}

/**
 * @param {string[]} channelIds
 * @returns {Promise<Map<string, number>>} Active title shows per channel (channels without any are absent)
 */
async function countActiveByChannel(channelIds) {
  const counts = new Map();
  if (channelIds.length === 0) return counts;
  const rows = await TvShow.findAll({
    where: { channel_id: channelIds, kind: KIND_TITLE_SHOW, retired_at: null }, attributes: ['channel_id'], raw: true,
  });
  for (const row of rows) counts.set(row.channel_id, (counts.get(row.channel_id) || 0) + 1);
  return counts;
}

/**
 * A title show's episodes that aren't downloaded, and the numbers missing
 * from its title- and order-numbered seasons.
 * @returns {Promise<Object|null>} null when the channel has no such show
 */
async function missingEpisodes(channelId, showId) {
  const show = await TvShow.findOne({ where: { id: showId, channel_id: channelId, kind: KIND_TITLE_SHOW } });
  if (!show) return null;
  const rows = await VideoClassification.findAll({
    where: { show_id: showId, status: ROW_STATUS.ASSIGNED },
    attributes: ['youtube_id', 'season', 'episode', 'source'],
    raw: true,
  });
  const ids = rows.map((row) => row.youtube_id);
  const downloaded = await presentDownloads(ids);
  const titleRows = ids.length
    ? await ChannelVideo.findAll({ where: { channel_id: channelId, youtube_id: ids }, attributes: ['youtube_id', 'title'], raw: true })
    : [];
  const titles = new Map(titleRows.map((row) => [row.youtube_id, row.title]));
  const seasonRows = await TvShowSeason.findAll({ where: { show_id: showId }, attributes: ['season', 'name'], raw: true });
  const seasonNames = new Map(seasonRows.map((row) => [row.season, row.name]));
  const gaps = new Map(computeGaps(rows.map((row) => ({ ...row, showKey: 'show', status: ROW_STATUS.ASSIGNED })))
    .map((gap) => [gap.season, gap]));

  const seasons = new Map();
  for (const row of [...rows].sort((a, b) => a.season - b.season || a.episode - b.episode)) {
    if (!seasons.has(row.season)) {
      const gap = gaps.get(row.season);
      seasons.set(row.season, {
        season: row.season,
        name: seasonNames.get(row.season) || null,
        episodes: 0,
        downloaded: 0,
        notDownloaded: [],
        gaps: gap ? gap.missing : [],
        gapsTruncated: gap ? gap.truncated : false,
      });
    }
    const season = seasons.get(row.season);
    season.episodes += 1;
    if (downloaded.has(row.youtube_id)) {
      season.downloaded += 1;
    } else {
      season.notDownloaded.push({ youtubeId: row.youtube_id, title: titles.get(row.youtube_id) || null, episode: row.episode, code: codeOf(row) });
    }
  }
  return { showId: show.id, name: show.name, seasons: [...seasons.values()] };
}

/**
 * Title, presence of the downloaded file and videos row id of each video
 * (listing title first, else the downloaded title).
 * @returns {Promise<Map<string, {title: string|null, downloaded: boolean, videoId: number|null}>>}
 */
async function describeVideos(channelId, youtubeIds) {
  const result = new Map();
  if (youtubeIds.length === 0) return result;
  const listed = await ChannelVideo.findAll({ where: { channel_id: channelId, youtube_id: youtubeIds }, attributes: ['youtube_id', 'title'], raw: true });
  const titles = new Map(listed.map((row) => [row.youtube_id, row.title]));
  const downloads = await Video.findAll({ where: { youtubeId: youtubeIds }, attributes: ['id', 'youtubeId', 'youTubeVideoName', 'removed'], raw: true });
  const byId = new Map(downloads.map((row) => [row.youtubeId, row]));
  for (const youtubeId of youtubeIds) {
    const download = byId.get(youtubeId);
    result.set(youtubeId, {
      title: titles.get(youtubeId) || (download && download.youTubeVideoName) || null,
      downloaded: Boolean(download && !download.removed),
      videoId: download ? download.id : null,
    });
  }
  return result;
}

/**
 * Which of a channel's videos are episodes of one of its active title shows
 * (numbered or waiting for a number): what "only download videos that
 * belong to a show" downloads.
 * @returns {Promise<Set<string>|null>} null when the channel has no active title show
 */
async function showEpisodeIds(channelId, youtubeIds) {
  const shows = await TvShow.findAll({
    where: { channel_id: channelId, kind: KIND_TITLE_SHOW, retired_at: null }, attributes: ['id'], raw: true,
  });
  if (shows.length === 0) return null;
  if (youtubeIds.length === 0) return new Set();
  const rows = await VideoClassification.findAll({
    where: { youtube_id: youtubeIds, show_id: shows.map((show) => show.id), status: EPISODE_STATUSES },
    attributes: ['youtube_id'],
    raw: true,
  });
  return new Set(rows.map((row) => row.youtube_id));
}

/**
 * Videos classified into a show as episodes (numbered or waiting for one).
 * @returns {Promise<Set<string>>}
 */
async function youtubeIdsForShow(showId) {
  const rows = await VideoClassification.findAll({ where: { show_id: showId, status: EPISODE_STATUSES }, attributes: ['youtube_id'], raw: true });
  return new Set(rows.map((row) => row.youtube_id));
}

/**
 * The numbered episode each video has in an active title show, whether or
 * not it is downloaded yet.
 * @param {string[]} youtubeIds
 * @returns {Promise<Map<string, {showName: string, season: number, episode: number, code: string}>>}
 */
async function plannedEpisodes(youtubeIds) {
  const result = new Map();
  if (youtubeIds.length === 0) return result;
  const rows = (await VideoClassification.findAll({
    where: { youtube_id: youtubeIds, status: ROW_STATUS.ASSIGNED },
    attributes: ['youtube_id', 'show_id', 'season', 'episode', 'source'],
    raw: true,
  })).filter((row) => row.season !== null && row.episode !== null);
  if (rows.length === 0) return result;
  const shows = await TvShow.findAll({
    where: { id: [...new Set(rows.map((row) => row.show_id))], kind: KIND_TITLE_SHOW, retired_at: null },
    attributes: ['id', 'name'],
    raw: true,
  });
  const names = new Map(shows.map((show) => [show.id, show.name]));
  for (const row of rows) {
    if (!names.has(row.show_id)) continue;
    result.set(row.youtube_id, { showName: names.get(row.show_id), season: row.season, episode: row.episode, code: codeOf(row) });
  }
  return result;
}

module.exports = {
  countsByShow,
  countActiveByChannel,
  missingEpisodes,
  describeVideos,
  showEpisodeIds,
  youtubeIdsForShow,
  plannedEpisodes
};
