/**
 * Which title show each video of a channel belongs to: every pattern of the
 * channel's title shows is tried in order (shows by position, then their
 * patterns) in one Python batch, and the first that matches, without one of
 * its show's exclude terms matching too, wins. The captures are then read as
 * season and episode numbers.
 */

const titleFilterRegex = require('../titleFilterRegex');
const { excludeTermRegex, SEASON_SOURCE, EPISODE_SOURCE, MAX_SEASON } = require('./patternCompiler');

const MAX_EPISODE = 2147483647;

const MATCH_KIND = Object.freeze({
  // Season and episode known from the title (or a fixed season).
  NUMBERED: 'numbered',
  // Season known; the episode is the season's next order number.
  ORDER: 'order',
  // Season or episode depends on the upload time, known once downloaded.
  PENDING: 'pending',
  // A compilation, a part, or a number out of range or missing: not placed in v1.
  UNSUPPORTED: 'unsupported',
});

const UNSUPPORTED_REASON = Object.freeze({
  COMPILATION: 'compilation',
  PART: 'part',
  OUT_OF_RANGE: 'number-out-of-range',
  // An optional group (regex mode) the title skipped.
  MISSING_NUMBER: 'missing-number',
});

// Captures are ASCII digits ([0-9]+ in simple patterns); a regex-mode group
// may still capture something else.
function toNumber(capture) {
  if (capture === null || capture === undefined) return null;
  const text = String(capture).trim();
  return /^[0-9]+$/.test(text) ? Number(text) : NaN;
}

function inRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Read a match's captures as numbers.
 * @param {{seasonSource: string, seasonFixed?: number|null, episodeSource: string}} pattern
 * @param {Object<string, string|null>} groups - The match's named groups
 * @param {{uploadYear?: number|null}} [video] - The video's upload year when it is known exactly
 *   (a downloaded video's info.json); a year season with a title episode is numbered with it
 * @returns {{kind: string, season: number|null, episode: number|null, episodeTitle: string|null, reason: string|null}}
 *   plus episodeEnd and part for unsupported matches
 */
function interpretMatch(pattern, groups, { uploadYear = null } = {}) {
  const titleText = typeof groups.title === 'string' ? groups.title.trim() : '';
  const episodeTitle = titleText || null;
  const season = pattern.seasonSource === SEASON_SOURCE.FIXED
    ? pattern.seasonFixed
    : pattern.seasonSource === SEASON_SOURCE.TITLE ? toNumber(groups.season) : null;
  const episode = pattern.episodeSource === EPISODE_SOURCE.TITLE ? toNumber(groups.episode) : null;
  const base = { season, episode, episodeTitle, reason: null };

  const episodeEnd = toNumber(groups.episode_end);
  if (episodeEnd !== null) {
    return { ...base, kind: MATCH_KIND.UNSUPPORTED, reason: UNSUPPORTED_REASON.COMPILATION, episodeEnd };
  }
  const part = toNumber(groups.part);
  if (part !== null) {
    return { ...base, kind: MATCH_KIND.UNSUPPORTED, reason: UNSUPPORTED_REASON.PART, part };
  }
  const seasonFromTitle = pattern.seasonSource === SEASON_SOURCE.TITLE;
  const episodeFromTitle = pattern.episodeSource === EPISODE_SOURCE.TITLE;
  if ((seasonFromTitle && season === null) || (episodeFromTitle && episode === null)) {
    return { ...base, kind: MATCH_KIND.UNSUPPORTED, reason: UNSUPPORTED_REASON.MISSING_NUMBER };
  }
  const seasonOk = season === null || inRange(season, 0, MAX_SEASON);
  const episodeOk = !episodeFromTitle || inRange(episode, 1, MAX_EPISODE);
  if (!seasonOk || !episodeOk) {
    return { ...base, kind: MATCH_KIND.UNSUPPORTED, reason: UNSUPPORTED_REASON.OUT_OF_RANGE };
  }
  if (pattern.seasonSource === SEASON_SOURCE.YEAR && episodeFromTitle && Number.isInteger(uploadYear)) {
    // The upload year is known (the video is downloaded): the number is
    // decided now, as the post-processor would decide it.
    return { ...base, season: uploadYear, kind: MATCH_KIND.NUMBERED };
  }
  if (pattern.seasonSource === SEASON_SOURCE.YEAR || pattern.episodeSource === EPISODE_SOURCE.DATE) {
    // The season (and a date episode) come from the upload time at download;
    // a title episode is kept for then.
    return { ...base, season: null, kind: MATCH_KIND.PENDING };
  }
  if (pattern.episodeSource === EPISODE_SOURCE.ORDER) {
    return { ...base, kind: MATCH_KIND.ORDER };
  }
  return { ...base, kind: MATCH_KIND.NUMBERED };
}

/**
 * Match videos against a channel's title shows.
 *
 * @param {Array<{key: string, excludeTerms: string[], patterns: Array<Object>}>} shows - In position order;
 *   each pattern { key, compiledRegex, seasonSource, seasonFixed, episodeSource }
 * @param {Array<{youtubeId: string, title: string, uploadYear?: number|null}>} videos - uploadYear only when
 *   known exactly (a downloaded video); listing dates can be approximate
 * @returns {Promise<Map<string, Object>>} By youtube id, only matched videos:
 *   { showKey, patternKey, ...interpretMatch }
 */
async function matchVideos(shows, videos) {
  const entries = [];
  for (const show of shows) {
    const excludes = (show.excludeTerms || []).map(excludeTermRegex);
    for (const pattern of show.patterns) entries.push({ show, pattern, excludes });
  }
  const result = new Map();
  if (entries.length === 0 || videos.length === 0) return result;

  const matches = await titleFilterRegex.classifyTitles(
    entries.map(({ pattern, excludes }) => ({ regex: pattern.compiledRegex, excludes })),
    videos.map((video) => video.title || '')
  );
  videos.forEach((video, index) => {
    const match = matches[index];
    if (!match) return;
    const { show, pattern } = entries[match.index];
    result.set(video.youtubeId, {
      showKey: show.key,
      patternKey: pattern.key,
      ...interpretMatch(pattern, match.groups || {}, { uploadYear: video.uploadYear }),
    });
  });
  return result;
}

module.exports = {
  MATCH_KIND,
  UNSUPPORTED_REASON,
  interpretMatch,
  matchVideos
};
