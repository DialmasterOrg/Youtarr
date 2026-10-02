/**
 * Names for TV-layout files and folders:
 *   <show>/Season 2024/S2024E03151200 - <title> [<id>].mp4   (date-numbered)
 *   <show>/Season 01/S01E20 - <title> [<id>].mp4             (title or order numbers)
 *   <show>/Season 00/S00E03 - <title> [<id>].mp4             (season 0, never "Specials")
 * SxxEyy comes first so media servers parse it before anything in the title,
 * and [id] stays last so every id-based file matcher keeps working.
 */

const { sanitizeFilenameLikeYtDlp } = require('../filesystem/sanitizer');
const { YOUTUBE_ID_PATTERN } = require('../filesystem/constants');

const EPISODE_TITLE_MAX_BYTES = 64;
const MIN_NUMBER_DIGITS = 2;
const DATE_EPISODE_DIGITS = 8;

function assertNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

function pad(value, digits) {
  return String(value).padStart(digits, '0');
}

/**
 * @param {number} season - Season number (0 for specials, a year for date seasons)
 * @returns {string} - "Season 00", "Season 01", "Season 2024"
 */
function seasonFolderName(season) {
  assertNonNegativeInteger(season, 'season');
  return `Season ${pad(season, MIN_NUMBER_DIGITS)}`;
}

/**
 * @param {Object} numbers
 * @param {number} numbers.season
 * @param {number} numbers.episode
 * @param {boolean} [numbers.dateNumbered=false] - Episode is MMDDHHMM, zero-padded to 8 digits
 * @returns {string} - "S2024E01151200", "S01E20", "S01E100"
 */
function episodeCode({ season, episode, dateNumbered = false }) {
  assertNonNegativeInteger(season, 'season');
  assertNonNegativeInteger(episode, 'episode');
  const episodeDigits = dateNumbered ? DATE_EPISODE_DIGITS : MIN_NUMBER_DIGITS;
  return `S${pad(season, MIN_NUMBER_DIGITS)}E${pad(episode, episodeDigits)}`;
}

/**
 * Build an episode's file stem (the name without extension; sidecars append
 * their own suffix to it). The episode title is used when it has text, else
 * the video's YouTube title; it is sanitized like a yt-dlp title field and cut
 * to 64 bytes.
 *
 * @param {Object} episode
 * @param {number} episode.season
 * @param {number} episode.episode
 * @param {boolean} [episode.dateNumbered=false]
 * @param {string} [episode.episodeTitle] - Title captured from a title pattern
 * @param {string} [episode.videoTitle] - The video's YouTube title
 * @param {string} episode.youtubeId
 * @returns {string} - e.g. "S01E20 - It's All Relative [y7xVT7DTt2k]"
 */
function buildEpisodeStem({ season, episode, dateNumbered = false, episodeTitle, videoTitle, youtubeId }) {
  if (typeof youtubeId !== 'string' || !YOUTUBE_ID_PATTERN.test(youtubeId)) {
    throw new TypeError(`youtubeId is not a video ID: ${youtubeId}`);
  }
  const code = episodeCode({ season, episode, dateNumbered });
  const rawTitle = (episodeTitle || '').trim() || (videoTitle || '').trim();
  const title = sanitizeFilenameLikeYtDlp(rawTitle, { maxBytes: EPISODE_TITLE_MAX_BYTES });
  return title ? `${code} - ${title} [${youtubeId}]` : `${code} [${youtubeId}]`;
}

module.exports = {
  EPISODE_TITLE_MAX_BYTES,
  seasonFolderName,
  episodeCode,
  buildEpisodeStem
};
