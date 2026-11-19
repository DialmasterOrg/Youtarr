/**
 * Date numbering for TV shows: season = UTC upload year, episode = MMDDHHMM
 * (UTC). This is the numbering the "Plex TV Series" filename preset produces
 * (yt-dlp formats %(timestamp>...)s in UTC), so files it named can be adopted
 * without renumbering. Two files must never share a number within a show, so
 * a taken number is bumped to the next free integer, and numbers are stored
 * once assigned rather than recomputed.
 */

const SOURCE_TIMESTAMP = 'timestamp';
const SOURCE_UPLOAD_DATE = 'upload_date';
const MAX_EPISODE_BUMPS = 10000;

const UPLOAD_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_EPISODE_CODE_PATTERN = /^S(\d{4})E(\d{8})(?!\d)/;

/**
 * The time a video was uploaded, from its yt-dlp info. `timestamp` is exact;
 * info files written before yt-dlp 2024.05.26 lack it for YouTube, so
 * `upload_date` (a UTC day) is the fallback, read as 00:00 UTC.
 *
 * @param {Object} info - yt-dlp info dict
 * @returns {{epochSeconds: number, source: string}|null}
 */
function releaseTime(info) {
  if (!info) {
    return null;
  }
  if (Number.isFinite(info.timestamp)) {
    return { epochSeconds: Math.floor(info.timestamp), source: SOURCE_TIMESTAMP };
  }
  const match = typeof info.upload_date === 'string' ? UPLOAD_DATE_PATTERN.exec(info.upload_date) : null;
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const epochMs = Date.UTC(year, month - 1, day);
  const date = new Date(epochMs);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { epochSeconds: epochMs / 1000, source: SOURCE_UPLOAD_DATE };
}

/**
 * @param {number} epochSeconds
 * @returns {{season: number, episode: number}} - e.g. 2024-03-15 12:00 UTC is
 *   season 2024, episode 3151200 (written E03151200 in filenames)
 */
function dateEpisodeFor(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  return {
    season: date.getUTCFullYear(),
    episode: (date.getUTCMonth() + 1) * 1000000 + date.getUTCDate() * 10000
      + date.getUTCHours() * 100 + date.getUTCMinutes()
  };
}

/**
 * First episode number at or after the desired one that is not taken.
 *
 * @param {number} desiredEpisode
 * @param {{has: (episode: number) => boolean}} takenEpisodes - Numbers already used in the season
 * @returns {number}
 */
function allocateEpisode(desiredEpisode, takenEpisodes) {
  for (let episode = desiredEpisode; episode <= desiredEpisode + MAX_EPISODE_BUMPS; episode++) {
    if (!takenEpisodes.has(episode)) {
      return episode;
    }
  }
  throw new Error(`No free episode number within ${MAX_EPISODE_BUMPS} of ${desiredEpisode}`);
}

/**
 * Read the date episode code at the start of a filename named by the
 * "Plex TV Series" preset ("S2019E04050000 Title [id].mp4") or by Youtarr's
 * own date-numbered TV naming. The 8 digits are read as a plain integer, not
 * as a time, because a bumped number need not be one: two uploads at 12:59
 * are numbered 01151259 and 01151260.
 *
 * @param {string} fileName
 * @returns {{season: number, episode: number}|null}
 */
function parseDateEpisodeCode(fileName) {
  const match = typeof fileName === 'string' ? DATE_EPISODE_CODE_PATTERN.exec(fileName) : null;
  if (!match) {
    return null;
  }
  return { season: Number(match[1]), episode: Number(match[2]) };
}

function compareIds(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function takenSetFor(takenBySeason, season) {
  if (!takenBySeason.has(season)) {
    takenBySeason.set(season, new Set());
  }
  return takenBySeason.get(season);
}

/**
 * Number a batch of videos for one date-numbered show, e.g. when converting
 * existing downloads. Adopted codes are kept when free; when two files share
 * a code, the earlier upload keeps it and the other is bumped from that code.
 * Every other video is numbered from its release time, in time then video id
 * order, so same-day videos that only have an upload date get consecutive
 * numbers in a stable order. A taken number is bumped.
 *
 * @param {Array<{youtubeId: string, info: Object, adoptedCode?: {season: number, episode: number}}>} videos
 * @param {Map<number, Iterable<number>>} [takenBySeason] - Numbers the show already uses; not modified
 * @returns {{assigned: Array<{youtubeId: string, season: number, episode: number, source: string, timestampSource: string|null}>, unnumbered: string[]}}
 *   source is 'adopted' (kept its code) or 'date'; unnumbered lists videos
 *   with neither an adopted code nor a release time
 */
function assignDateEpisodes(videos, takenBySeason = new Map()) {
  const taken = new Map([...takenBySeason].map(([season, episodes]) => [season, new Set(episodes)]));
  const assigned = [];
  const unnumbered = [];
  const toNumber = [];

  const secondsOf = (item) => (item.time ? item.time.epochSeconds : 0);
  const byNumbersThenTime = (a, b) => a.numbers.season - b.numbers.season
    || a.numbers.episode - b.numbers.episode
    || secondsOf(a) - secondsOf(b)
    || compareIds(a.video.youtubeId, b.video.youtubeId);
  const record = (item, episode, source) => {
    takenSetFor(taken, item.numbers.season).add(episode);
    assigned.push({
      youtubeId: item.video.youtubeId,
      season: item.numbers.season,
      episode,
      source,
      timestampSource: item.time ? item.time.source : null
    });
  };

  const items = videos.map((video) => ({ video, time: releaseTime(video.info) }));
  const adopted = items
    .filter((item) => item.video.adoptedCode)
    .map((item) => ({ ...item, numbers: item.video.adoptedCode }))
    .sort(byNumbersThenTime);
  for (const item of adopted) {
    if (takenSetFor(taken, item.numbers.season).has(item.numbers.episode)) {
      toNumber.push(item);
    } else {
      record(item, item.numbers.episode, 'adopted');
    }
  }

  for (const item of items.filter((candidate) => !candidate.video.adoptedCode)) {
    if (item.time) {
      toNumber.push({ ...item, numbers: dateEpisodeFor(item.time.epochSeconds) });
    } else {
      unnumbered.push(item.video.youtubeId);
    }
  }

  for (const item of toNumber.sort(byNumbersThenTime)) {
    record(item, allocateEpisode(item.numbers.episode, takenSetFor(taken, item.numbers.season)), 'date');
  }

  return { assigned, unnumbered };
}

module.exports = {
  SOURCE_TIMESTAMP,
  SOURCE_UPLOAD_DATE,
  releaseTime,
  dateEpisodeFor,
  allocateEpisode,
  parseDateEpisodeCode,
  assignDateEpisodes
};
