/**
 * The post-processor's title-show decision for a downloaded video of a
 * tracked, enabled channel (routing rule step 2: a title show wins over the
 * resolved folder, dialog override included).
 *
 * A video with a stored episode reuses it (no Python call), so re-downloads
 * keep their number and file name. A video without one (an upload newer than
 * the listing, a manual download) or still waiting for an upload-time number
 * is classified now by its full title; classification decides, even when a
 * flat listing showed another title. Duplicates, compilations and parts,
 * "Not an episode" and classification errors are left to the channel layout,
 * and recorded.
 */

const { Op } = require('sequelize');
const { VideoClassification, TvShow } = require('../../models');
const logger = require('../../logger');
const titleShowStore = require('./titleShowStore');
const episodeConflicts = require('./episodeConflicts');
const { matchVideos, MATCH_KIND } = require('./titleMatcher');
const { ROW_STATUS, SOURCE } = require('./titleNumbering');
const { SEASON_SOURCE, EPISODE_SOURCE } = require('./patternCompiler');
const { releaseTime, dateEpisodeFor, allocateEpisode } = require('./dateNumbering');
const { buildEpisodeStem } = require('./episodeNaming');
const { KIND_TITLE_SHOW } = require('./constants');

function isUniqueConstraintError(err) {
  return Boolean(err && err.name === 'SequelizeUniqueConstraintError');
}

function holdsNumber(row) {
  return row.season !== null && row.season !== undefined && row.episode !== null && row.episode !== undefined;
}

function toAssignment(row) {
  return {
    season: row.season,
    episode: row.episode,
    dateNumbered: row.source === SOURCE.DATE,
    episodeTitle: row.episode_title,
    fileStem: row.file_stem,
  };
}

function videoTitleOf(info) {
  return String(info.fulltitle || info.title || '').trim();
}

async function numbersInSeason(showId, season, youtubeId) {
  return VideoClassification.findAll({
    where: { show_id: showId, season, youtube_id: { [Op.ne]: youtubeId } },
    attributes: ['youtube_id', 'season', 'episode'],
  });
}

async function writeRow(stored, youtubeId, values) {
  if (stored) {
    await stored.update(values);
    return values;
  }
  return VideoClassification.create({ youtube_id: youtubeId, ...values });
}

/**
 * The season and episode a match gets now that the upload time is known.
 * @returns {Promise<{season: number, episode: number|null, source: string, timestampSource: string|null, holder: string|null}>}
 *   episode null with holder set: another video holds the title number
 */
async function numberMatch({ match, pattern, show, youtubeId, info, now }) {
  let season = match.season;
  let release = null;
  if (pattern.seasonSource === SEASON_SOURCE.YEAR || pattern.episodeSource === EPISODE_SOURCE.DATE) {
    release = releaseTime(info);
    if (!release) {
      logger.warn({ youtubeId }, 'Title show episode has no upload time; numbering it by the download time');
      release = { epochSeconds: Math.floor(now() / 1000), source: null };
    }
  }
  const dated = release ? dateEpisodeFor(release.epochSeconds) : null;
  if (pattern.seasonSource === SEASON_SOURCE.YEAR) season = dated.season;

  const others = await numbersInSeason(show.id, season, youtubeId);
  const taken = new Set(others.map((row) => row.episode));
  if (pattern.episodeSource === EPISODE_SOURCE.TITLE) {
    const holder = others.find((row) => row.episode === match.episode);
    return { season, episode: holder ? null : match.episode, source: SOURCE.TITLE, timestampSource: null, holder: holder ? holder.youtube_id : null };
  }
  if (pattern.episodeSource === EPISODE_SOURCE.DATE) {
    return { season, episode: allocateEpisode(dated.episode, taken), source: SOURCE.DATE, timestampSource: release.source, holder: null };
  }
  const marks = await titleShowStore.highWaterMarks([show.id]);
  let episode = (marks.get(`title:${show.id}|${season}`) || 0) + 1;
  while (taken.has(episode)) episode += 1;
  return { season, episode, source: SOURCE.ORDER, timestampSource: null, holder: null };
}

async function placeMatch({ match, shows, stored, youtubeId, channelId, info, now }) {
  const titleShow = shows.find((show) => show.key === match.showKey);
  const pattern = titleShow.patterns.find((entry) => entry.key === match.patternKey);
  const show = await TvShow.findByPk(titleShow.id);
  const base = { channel_id: channelId, show_id: show.id, pattern_id: pattern.id, timestamp_source: null, title_opt_out: false };
  const videoTitle = videoTitleOf(info);

  if (match.kind === MATCH_KIND.UNSUPPORTED) {
    await writeRow(stored, youtubeId, {
      ...base, status: ROW_STATUS.UNSUPPORTED, season: null, episode: null, source: null,
      episode_title: match.episodeTitle || videoTitle || null, file_stem: null,
    });
    logger.info({ youtubeId, reason: match.reason }, 'Title show match is not supported yet; saving the video by the channel layout');
    return null;
  }

  const numbers = await numberMatch({ match, pattern, show, youtubeId, info, now });
  if (numbers.holder) {
    await writeRow(stored, youtubeId, {
      ...base, status: ROW_STATUS.DUPLICATE, season: null, episode: null, source: SOURCE.TITLE,
      episode_title: match.episodeTitle || videoTitle || null, file_stem: null,
    });
    await episodeConflicts.recordDuplicate({
      youtubeId, channelId, showId: show.id, season: numbers.season, episode: match.episode, duplicateOf: numbers.holder, downloaded: true,
    });
    logger.info({ youtubeId, duplicateOf: numbers.holder }, 'Another upload holds this episode; saving the duplicate by the channel layout');
    return null;
  }

  const dateNumbered = numbers.source === SOURCE.DATE;
  const row = {
    ...base,
    status: ROW_STATUS.ASSIGNED,
    season: numbers.season,
    episode: numbers.episode,
    source: numbers.source,
    timestamp_source: numbers.timestampSource,
    episode_title: match.episodeTitle || videoTitle || null,
    file_stem: buildEpisodeStem({
      season: numbers.season, episode: numbers.episode, dateNumbered, episodeTitle: match.episodeTitle, videoTitle, youtubeId,
    }),
  };
  await writeRow(stored, youtubeId, row);
  if (numbers.source === SOURCE.ORDER) await titleShowStore.raiseHighWater(show.id, numbers.season, numbers.episode);
  return { show, assignment: toAssignment(row) };
}

/**
 * @param {Object} params
 * @param {string} params.youtubeId
 * @param {Object} params.info - yt-dlp info dict
 * @param {string|null} params.ownerChannelId - YouTube id of the channel that owns the video
 * @param {boolean} params.channelEnabled - The owner channel is tracked and enabled
 * @param {() => number} [params.now] - Clock for videos with no upload time
 * @returns {Promise<null|{show: Object, assignment: Object}>} null: not a title-show episode
 *   (the channel layout decides); show is the tv_shows row
 */
async function resolveTitlePlacement({ youtubeId, info, ownerChannelId, channelEnabled, now = Date.now }) {
  if (!ownerChannelId || !channelEnabled) return null;
  const channelId = ownerChannelId;
  const shows = await titleShowStore.listTitleShows(channelId);
  if (shows.length === 0) return null;

  let stored = await VideoClassification.findByPk(youtubeId);
  if (stored && stored.channel_id !== channelId) return null;
  if (stored && stored.title_opt_out) return null;
  const storedShow = stored ? shows.find((show) => show.id === stored.show_id) : null;
  if (storedShow) {
    if (stored.status === ROW_STATUS.ASSIGNED && holdsNumber(stored) && stored.file_stem) {
      return { show: await TvShow.findByPk(storedShow.id), assignment: toAssignment(stored) };
    }
    if (stored.status === ROW_STATUS.DUPLICATE || stored.status === ROW_STATUS.UNSUPPORTED) return null;
  } else if (stored) {
    const show = await TvShow.findByPk(stored.show_id);
    if (!show || show.kind !== KIND_TITLE_SHOW) return null;
  }

  for (let attempt = 0; ; attempt += 1) {
    let matches;
    try {
      matches = await matchVideos(shows, [{ youtubeId, title: videoTitleOf(info) }]);
    } catch (err) {
      logger.error({ err, youtubeId, channelId }, 'Could not check the title against the channel\'s title shows; saving the video by the channel layout');
      await episodeConflicts.recordError({ youtubeId, channelId, message: err.message });
      return null;
    }
    const match = matches.get(youtubeId);
    if (!match) {
      if (stored && stored.status === ROW_STATUS.PENDING) await stored.destroy();
      return null;
    }
    try {
      return await placeMatch({ match, shows, stored, youtubeId, channelId, info, now });
    } catch (err) {
      if (attempt > 0 || !isUniqueConstraintError(err)) throw err;
      logger.info({ youtubeId }, 'Episode number taken meanwhile; numbering again once');
      stored = await VideoClassification.findByPk(youtubeId);
    }
  }
}

module.exports = {
  resolveTitlePlacement
};
