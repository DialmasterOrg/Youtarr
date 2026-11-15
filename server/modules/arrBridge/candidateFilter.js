// Decides which YouTube search results may be offered for a request. The
// release name is built from the request, so whatever passes here parses in
// Sonarr or Radarr as exactly the wanted item: nothing is guessed. Strict
// rules are the default; the loose ones are an opt-in setting.
const { foldLatinAccents } = require('./releaseNaming');

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'to', 'for', 'with', 'at', 'by']);
const TOKEN_SEPARATORS = /[^\p{L}\p{N}\p{M}]+/u;
const APOSTROPHES = /['’‘ʼ`]/g;
const TRAILING_PARENTHESES = /\s*\([^()]*\)\s*$/;
const YEAR_TOKEN = /^(?:19|20)\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// Daily shows are often uploaded the day after they air.
const DAILY_TOLERANCE_DAYS = 1;

const MARKER_PATTERNS = [
  /\bs(\d{1,4})\s*[.\-_ ]?\s*e(\d{1,3})\b/gi,
  // Two-digit episode, as release-style titles write it: "4x4" is a truck.
  /\b(\d{1,2})x(\d{2,3})\b/gi,
  /\b(?:season|series)\s*(\d{1,4})\s*[,\-–:|.]?\s*(?:episode|ep\.?|e)\s*(\d{1,3})\b/gi,
];
// A marker that continues into a second episode: "S01E01-E10", "S01E01-03",
// "S1E1 & 2", "S01E01, E02", "Episodes 1-10", "1x01-1x03". Such a video
// holds several episodes and must never be offered as one of them.
const RANGE_PATTERNS = [
  /\bs\d{1,4}\s*[.\-_ ]?\s*e\d{1,3}\s*(?:[-–&+,]|to|through|thru)\s*(?:s\d{1,4}\s*)?e(?:p\.?)?\s*\d/i,
  /\bs\d{1,4}\s*[.\-_ ]?\s*e\d{1,3}(?:[-–]|\s*&\s*)\d{1,3}\b/i,
  /\bepisodes?\s*\d{1,3}\s*(?:[-–&+,]|to|through|thru|and)\s*\d/i,
  /\b\d{1,2}x\d{2,3}\s*[-–&+,]\s*\d/i,
];
// Words that may sit between a series name and its episode marker without
// meaning another series.
const FILLER_WORDS = ['full', 'episode', 'episodes', 'hd', 'official', 'tv', 'show', 'series', 'complete'];
const LOOSE_EPISODE_PATTERNS = [
  /\b(?:episode|ep\.?|e|part|pt\.?)\s*#?\s*(\d{1,3})\b/gi,
  /#(\d{1,3})\b/g,
];

function tokenize(text) {
  return foldLatinAccents(text)
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .split(TOKEN_SEPARATORS)
    .filter(Boolean);
}

const isSingleLetter = (token) => token.length === 1 && !/\d/.test(token);

/**
 * The words a candidate's title must contain for the request text.
 * @param {string} text - Series or movie text from the request
 * @param {{dropTrailingYear?: boolean}} options - TV titles such as "Shogun 2024"
 *   carry a year that YouTube titles rarely repeat
 * @returns {string[]}
 */
function matchTerms(text, { dropTrailingYear = false } = {}) {
  const raw = String(text ?? '');
  const withoutTag = raw.replace(TRAILING_PARENTHESES, '');
  const tokens = tokenize(withoutTag.trim() ? withoutTag : raw);
  if (dropTrailingYear && tokens.length > 1 && YEAR_TOKEN.test(tokens[tokens.length - 1])) tokens.pop();
  const significant = tokens.filter((token) => !STOPWORDS.has(token) && !isSingleLetter(token));
  return significant.length > 0 ? significant : tokens;
}

function titleTokens(title) {
  return new Set(tokenize(title));
}

/**
 * Season and episode pairs written out in a video title.
 * @param {string} title
 * @returns {Array<{season: number, episode: number}>} Distinct pairs
 */
function episodeMarkers(title) {
  const text = String(title ?? '');
  const seen = new Set();
  const markers = [];
  for (const pattern of MARKER_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const season = Number(match[1]);
      const episode = Number(match[2]);
      const key = `${season}:${episode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      markers.push({ season, episode });
    }
  }
  return markers;
}

/**
 * @param {string} title
 * @returns {boolean} The title names a range or list of episodes
 */
function hasEpisodeRange(title) {
  const text = String(title ?? '');
  return RANGE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Episode numbers written without a season ("Episode 5", "E05", "#5").
 * @param {string} title
 * @returns {number[]} Distinct numbers
 */
function looseEpisodeNumbers(title) {
  const text = String(title ?? '');
  const numbers = new Set();
  for (const pattern of LOOSE_EPISODE_PATTERNS) {
    for (const match of text.matchAll(pattern)) numbers.add(Number(match[1]));
  }
  return [...numbers];
}

const spaced = (tokens) => ` ${tokens.join(' ')} `;

/**
 * @param {string} title - The candidate's title
 * @param {string[]} excludeTerms - Words or phrases, already lowercased
 * @param {string} requestText - A term the request itself contains never excludes
 * @returns {boolean}
 */
function hasExcludedTerm(title, excludeTerms, requestText) {
  const titleText = spaced(tokenize(title));
  const requestTokens = spaced(tokenize(requestText));
  return excludeTerms.some((term) => {
    const termText = spaced(tokenize(term));
    if (termText.trim() === '') return false;
    return titleText.includes(termText) && !requestTokens.includes(termText);
  });
}

function passesDuration(candidate, minSeconds, loose) {
  if (typeof candidate.duration !== 'number') return loose;
  return candidate.duration >= minSeconds;
}

// The checks every request shares: exclude terms, length, and every
// significant word of the request text.
function passesCommon(candidate, { terms, requestText, minSeconds, settings }) {
  if (hasExcludedTerm(candidate.title, settings.excludeTerms, requestText)) return false;
  if (!passesDuration(candidate, minSeconds, settings.looseMatching)) return false;
  const tokens = titleTokens(candidate.title);
  return terms.every((term) => tokens.has(term));
}

function tvContext(text, settings) {
  return {
    terms: matchTerms(text, { dropTrailingYear: true }),
    requestText: text,
    minSeconds: settings.minTvSeconds,
    settings,
    allowedBeforeMarker: new Set([...tokenize(text), ...STOPWORDS, ...FILLER_WORDS]),
  };
}

function firstMarkerIndex(text) {
  let first = -1;
  for (const pattern of MARKER_PATTERNS) {
    const match = text.matchAll(pattern).next().value;
    if (match && (first < 0 || match.index < first)) first = match.index;
  }
  return first;
}

// "Beyblade Metal Fusion S01E29" contains every word of "Beyblade" and the
// wanted marker, but it is another series. Words between the series name and
// the marker that the request does not contain, and that are not filler or a
// year, mean the title names something else. A title whose marker comes
// before the name cannot be judged this way and passes.
function namesAnotherSeries(title, context) {
  const text = String(title ?? '');
  const markerIndex = firstMarkerIndex(text);
  if (markerIndex <= 0) return false;
  const before = tokenize(text.slice(0, markerIndex));
  const lastTerm = Math.max(...context.terms.map((term) => before.lastIndexOf(term)));
  if (lastTerm < 0) return false;
  return before
    .slice(lastTerm + 1)
    .some((token) => !context.allowedBeforeMarker.has(token) && !YEAR_TOKEN.test(token));
}

/**
 * @returns {Array<Object>} Candidates for one episode, in source order
 */
function filterTvEpisode(candidates, { text, season, episode, settings }) {
  const context = tvContext(text, settings);
  if (context.terms.length === 0) return [];
  return candidates.filter((candidate) => {
    if (!passesCommon(candidate, context) || hasEpisodeRange(candidate.title)) return false;
    const markers = episodeMarkers(candidate.title);
    // Exactly one marker: a title naming several episodes is a compilation.
    if (markers.length === 1) {
      if (markers[0].season !== season || markers[0].episode !== episode) return false;
      return settings.looseMatching || !namesAnotherSeries(candidate.title, context);
    }
    // A marker for another episode is never overruled by a bare number.
    if (!settings.looseMatching || markers.length > 0) return false;
    return looseEpisodeNumbers(candidate.title).includes(episode);
  });
}

/**
 * Candidates for a whole season, each with the episode its own title names.
 * Always strict: a season answer may be grabbed by a bulk search.
 * @returns {Array<{candidate: Object, episode: number}>}
 */
function filterTvSeason(candidates, { text, season, settings }) {
  const context = tvContext(text, { ...settings, looseMatching: false });
  if (context.terms.length === 0) return [];
  const matches = [];
  for (const candidate of candidates) {
    if (!passesCommon(candidate, context) || hasEpisodeRange(candidate.title)) continue;
    const markers = episodeMarkers(candidate.title);
    if (markers.length !== 1 || markers[0].season !== season) continue;
    if (namesAnotherSeries(candidate.title, context)) continue;
    matches.push({ candidate, episode: markers[0].episode });
  }
  return matches;
}

const utcDay = (date) => Math.floor(new Date(date).getTime() / DAY_MS);

/**
 * @param {Object} options
 * @param {Date} options.date - The air date, at UTC midnight
 * @returns {Array<Object>} Candidates published on or next to the air date
 */
function filterTvDaily(candidates, { text, date, settings }) {
  const context = tvContext(text, settings);
  if (context.terms.length === 0) return [];
  const airDay = utcDay(date);
  return candidates.filter((candidate) => {
    if (!candidate.publishedAt || !passesCommon(candidate, context)) return false;
    const publishedDay = utcDay(candidate.publishedAt);
    return Number.isFinite(publishedDay) && Math.abs(publishedDay - airDay) <= DAILY_TOLERANCE_DAYS;
  });
}

/**
 * @returns {Array<Object>} Candidates for a movie, in source order
 */
function filterMovie(candidates, { title, year, settings }) {
  const context = {
    terms: matchTerms(title),
    requestText: title,
    minSeconds: settings.minMovieSeconds,
    settings,
  };
  if (context.terms.length === 0) return [];
  return candidates.filter((candidate) => {
    if (!passesCommon(candidate, context)) return false;
    return settings.looseMatching || titleTokens(candidate.title).has(String(year));
  });
}

module.exports = {
  matchTerms,
  titleTokens,
  episodeMarkers,
  looseEpisodeNumbers,
  hasEpisodeRange,
  hasExcludedTerm,
  filterTvEpisode,
  filterTvSeason,
  filterTvDaily,
  filterMovie,
};
