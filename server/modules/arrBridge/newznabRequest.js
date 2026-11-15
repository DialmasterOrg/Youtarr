// Validates a Newznab query and says what kind of request it is. Pure: the
// route hands in req.query, which Express may fill with arrays or objects.
const { kindForCategories } = require('./arrBridgeConfig');

const FUNCTIONS = ['caps', 'search', 'tvsearch', 'movie'];
const MAX_TEXT_LENGTH = 200;
const MAX_CATEGORY_COUNT = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
// A season this high is a year. Daily series and year-numbered series look
// the same on the wire, and YouTube titles carry no S2024E05 markers.
const YEAR_SEASON_THRESHOLD = 1000;

const ERROR_MISSING_PARAMETER = 200;
const ERROR_INCORRECT_PARAMETER = 201;
const ERROR_NO_SUCH_FUNCTION = 202;

const CATEGORY_PATTERN = /^\d{1,6}$/;
const SEASON_PATTERN = /^\d{1,4}$/;
const EPISODE_PATTERN = /^\d{1,3}$/;
const DAILY_EPISODE_PATTERN = /^(\d{1,2})\/(\d{1,2})$/;
const COUNT_PATTERN = /^\d{1,7}$/;
const MOVIE_QUERY_PATTERN = /^(.*\S)\s+((?:19|20)\d{2})$/;

class InvalidParameter extends Error {}

const incorrect = (name) => new InvalidParameter(`Incorrect parameter (${name})`);

function readString(query, name) {
  const value = query[name];
  if (value === undefined) return null;
  if (typeof value !== 'string') throw incorrect(name);
  return value;
}

function readText(query, name) {
  const value = readString(query, name);
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) throw incorrect(name);
  return trimmed || null;
}

function readPattern(query, name, pattern) {
  const value = readString(query, name);
  if (value === null || value === '') return null;
  if (!pattern.test(value)) throw incorrect(name);
  return value;
}

function readCategories(query) {
  const value = readString(query, 'cat');
  if (!value) return [];
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > MAX_CATEGORY_COUNT || !parts.every((part) => CATEGORY_PATTERN.test(part))) {
    throw incorrect('cat');
  }
  return parts.map(Number);
}

function readEpisode(query) {
  const value = readString(query, 'ep');
  if (value === null || value === '') return null;
  if (!EPISODE_PATTERN.test(value) && !DAILY_EPISODE_PATTERN.test(value)) throw incorrect('ep');
  return value;
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Which answer the request gets. "empty" is every request the YouTube-wide
// search cannot answer honestly; it never reaches a search.
function classify({ kind, t, text, season, episode, offset, hasQuery }) {
  if (offset > 0) return { shape: 'empty' };
  if (!hasQuery) return { shape: 'rss' };
  if (!text) return { shape: 'empty' };

  if (kind === 'movie') {
    const match = MOVIE_QUERY_PATTERN.exec(text);
    return match ? { shape: 'movie', text: match[1], year: Number(match[2]) } : { shape: 'empty' };
  }
  if (kind !== 'tv' || t !== 'tvsearch' || season === null) return { shape: 'empty' };

  const seasonNumber = Number(season);
  if (episode === null) {
    return seasonNumber < YEAR_SEASON_THRESHOLD ? { shape: 'season', season: seasonNumber } : { shape: 'empty' };
  }
  const daily = DAILY_EPISODE_PATTERN.exec(episode);
  if (!daily) return { shape: 'episode', season: seasonNumber, episode: Number(episode) };
  const month = Number(daily[1]);
  const day = Number(daily[2]);
  return isRealDate(seasonNumber, month, day)
    ? { shape: 'daily', year: seasonNumber, month, day }
    : { shape: 'empty' };
}

/**
 * @param {Object} query - req.query
 * @returns {{ok: true, request: Object}|{ok: false, code: number, description: string}}
 *   request: { t, kind, shape, text, textSource, season, episode, year, month, day, limit, offset },
 *   shape one of caps | rss | episode | season | daily | movie | empty
 */
function parseNewznabRequest(query) {
  if (!query || typeof query !== 'object') {
    return { ok: false, code: ERROR_MISSING_PARAMETER, description: 'Missing parameter (t)' };
  }
  try {
    const t = readString(query, 't');
    if (!t) return { ok: false, code: ERROR_MISSING_PARAMETER, description: 'Missing parameter (t)' };
    if (!FUNCTIONS.includes(t)) return { ok: false, code: ERROR_NO_SUCH_FUNCTION, description: 'No such function' };

    const base = {
      t, kind: null, shape: 'caps', text: null, textSource: null,
      season: null, episode: null, year: null, month: null, day: null,
      limit: DEFAULT_LIMIT, offset: 0,
    };
    if (t === 'caps') return { ok: true, request: base };

    const q = readText(query, 'q');
    const title = readText(query, 'title');
    const season = readPattern(query, 'season', SEASON_PATTERN);
    const episode = readEpisode(query);
    const limit = readPattern(query, 'limit', COUNT_PATTERN);
    const offset = readPattern(query, 'offset', COUNT_PATTERN);
    const text = title || q;

    const request = {
      ...base,
      kind: kindForCategories(readCategories(query), t),
      text,
      textSource: title ? 'title' : q ? 'q' : null,
      limit: limit === null ? DEFAULT_LIMIT : Math.min(Math.max(Number(limit), 1), MAX_LIMIT),
      offset: offset === null ? 0 : Number(offset),
    };
    const hasQuery = Boolean(q || title || season !== null || episode !== null);
    return {
      ok: true,
      request: {
        ...request,
        ...classify({ kind: request.kind, t, text, season, episode, offset: request.offset, hasQuery }),
      },
    };
  } catch (error) {
    if (error instanceof InvalidParameter) {
      return { ok: false, code: ERROR_INCORRECT_PARAMETER, description: error.message };
    }
    throw error;
  }
}

module.exports = { parseNewznabRequest, FUNCTIONS, MAX_LIMIT, DEFAULT_LIMIT };
