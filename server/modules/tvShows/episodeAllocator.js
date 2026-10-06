/**
 * Episode numbers for date-numbered shows (channel shows), assigned when a
 * video is post-processed: season = UTC upload year, episode = MMDDHHMM, the
 * next free number when that minute is taken. The assignment is stored, so a
 * re-download lands on the same number and file name.
 *
 * Post-processors run one at a time, so the only concurrent writer is the API.
 * No upsert: MySQL's ON DUPLICATE KEY UPDATE would also fire on the episode
 * unique key and overwrite the video holding that number.
 */

const { Op } = require('sequelize');
const VideoClassification = require('../../models/videoclassification');
const logger = require('../../logger');
const { releaseTime, dateEpisodeFor, allocateEpisode } = require('./dateNumbering');
const { buildEpisodeStem } = require('./episodeNaming');

const STATUS_ASSIGNED = 'assigned';
const SOURCE_DATE = 'date';

function isUniqueConstraintError(err) {
  return Boolean(err && err.name === 'SequelizeUniqueConstraintError');
}

function toAssignment(row) {
  return {
    season: row.season,
    episode: row.episode,
    dateNumbered: true,
    episodeTitle: row.episode_title,
    fileStem: row.file_stem,
  };
}

async function takenEpisodes(showId, season, youtubeId) {
  const rows = await VideoClassification.findAll({
    where: { show_id: showId, season, youtube_id: { [Op.ne]: youtubeId } },
    attributes: ['episode'],
  });
  return new Set(rows.map((row) => row.episode));
}

/**
 * Assign (or reuse) a date-numbered episode for a video in a show.
 *
 * @param {Object} params
 * @param {{id: number}} params.show - tv_shows row
 * @param {string} params.youtubeId
 * @param {string} params.channelId - Owner channel's YouTube id
 * @param {Object} params.info - yt-dlp info dict (timestamp, upload_date, title)
 * @param {() => number} [params.now] - Clock for videos with no release time
 * @returns {Promise<{season: number, episode: number, dateNumbered: true, episodeTitle: string, fileStem: string}>}
 */
async function assignDateEpisode({ show, youtubeId, channelId, info, now = Date.now }) {
  const stored = await VideoClassification.findByPk(youtubeId);
  if (stored && stored.show_id === show.id && stored.status === STATUS_ASSIGNED
    && stored.season !== null && stored.episode !== null && stored.file_stem) {
    return toAssignment(stored);
  }

  let release = releaseTime(info);
  if (!release) {
    logger.warn({ youtubeId }, 'TV episode has no upload time; numbering it by the download time');
    release = { epochSeconds: Math.floor(now() / 1000), source: null };
  }
  const { season, episode: desired } = dateEpisodeFor(release.epochSeconds);
  const episodeTitle = (info.fulltitle || info.title || '').trim() || null;

  const write = async () => {
    const episode = allocateEpisode(desired, await takenEpisodes(show.id, season, youtubeId));
    const values = {
      channel_id: channelId,
      show_id: show.id,
      status: STATUS_ASSIGNED,
      season,
      episode,
      source: SOURCE_DATE,
      timestamp_source: release.source,
      pattern_id: null,
      episode_title: episodeTitle,
      file_stem: buildEpisodeStem({ season, episode, dateNumbered: true, videoTitle: episodeTitle, youtubeId }),
    };
    if (stored) {
      await stored.update(values);
    } else {
      await VideoClassification.create({ youtube_id: youtubeId, ...values });
    }
    return toAssignment(values);
  };

  try {
    return await write();
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    logger.info({ youtubeId, showId: show.id, season }, 'Episode number taken meanwhile; retrying once');
    return write();
  }
}

module.exports = {
  STATUS_ASSIGNED,
  SOURCE_DATE,
  assignDateEpisode
};
