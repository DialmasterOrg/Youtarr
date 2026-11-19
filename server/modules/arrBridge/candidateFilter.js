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
// A video's length against the runtime Sonarr or Radarr reports. An hour
// slot holds about 42 minutes of episode; two episodes in one upload run to
// 1.5 times the runtime or more.
const TV_RUNTIME_MIN_RATIO = 0.6;
const TV_RUNTIME_MAX_RATIO = 1.35;
// Short shows would otherwise get a window of a minute or two.
const TV_RUNTIME_SLACK_SECONDS = 180;
const MOVIE_RUNTIME_MIN_RATIO = 0.85;
const MOVIE_RUNTIME_MAX_RATIO = 1.15;
const LONG_RUNTIME_SECONDS = 30 * 60;
const SHORT_RUNTIME_SECONDS = 10 * 60;
const LONG_RUNTIME_SAMPLE_SECONDS = 10 * 60;
const MID_RUNTIME_SAMPLE_SECONDS = 5 * 60;
const SHORT_RUNTIME_SAMPLE_SECONDS = 90;

const MARKER_PATTERNS = [
  /\bs(\d{1,4})\s*[.\-_ ]?\s*e(\d{1,3})\b/gi,
  // Two-digit episode, as release-style titles write it: "4x4" is a truck.
  /\b(\d{1,2})x(\d{2,3})\b/gi,
  /\b(?:season|series)\s*(\d{1,4})\s*[,\-–:|.]?\s*(?:episode|ep\.?|e)\s*(\d{1,3})\b/gi,
];
// A marker that continues into a second episode: "S01E01-E10", "S01E01-03",
// "S1E1 & 2", "S01E01, E02", "Episodes 1-10", "1x01-1x03". Such a video
// holds several episodes and must never be offered as one of them.
// The second number must stand alone: "Episode 5 - 1080p" and "1x05 - 4K"
// name a resolution. A dash with a space before it is the usual separator
// before an episode's own title ("Episode 5 - 24 Hours to Hell"), so a bare
// number after one is a second episode only when the title ends there, or
// goes on with a bracket or a filler word ("Episode 1 - 3 (Full Episodes)").
const SPACED_RANGE_END = String.raw`\s*(?:$|[()[\]|]|(?:full|complete|hd|episodes)\b)`;
const RANGE_PATTERNS = [
  /\bs\d{1,4}\s*[.\-_ ]?\s*e\d{1,3}\s*(?:[-–&+,]|to|through|thru)\s*(?:s\d{1,4}\s*)?e(?:p\.?)?\s*\d/i,
  /\bs\d{1,4}\s*[.\-_ ]?\s*e\d{1,3}(?:[-–]|\s*&\s*)\d{1,3}\b/i,
  /\bepisodes\s*\d{1,3}\s*(?:[-–&+,]|to|through|thru|and)\s*\d{1,3}\b/i,
  /\bepisode\s*\d{1,3}(?:[-–]|\s*(?:[&+,]|to|through|thru|and)\s*)\d{1,3}\b/i,
  new RegExp(String.raw`\bepisode\s*\d{1,3}\s+[-–]\s*\d{1,3}${SPACED_RANGE_END}`, 'i'),
  /\b\d{1,2}x\d{2,3}\s*(?:[-–&+,]|to|through|thru)\s*\d{1,2}x\d{2,3}\b/i,
  /\b\d{1,2}x\d{2,3}(?:[-–]|\s*[&+,]\s*)\d{1,3}\b/i,
  new RegExp(String.raw`\b\d{1,2}x\d{2,3}\s+[-–]\s*\d{1,3}${SPACED_RANGE_END}`, 'i'),
];
// Words that may sit between a series name and its episode marker without
// meaning another series.
const FILLER_WORDS = ['full', 'episode', 'episodes', 'hd', 'official', 'tv', 'show', 'series', 'complete'];
const LOOSE_EPISODE_PATTERNS = [
  /\b(?:episode|ep\.?|e|part|pt\.?)\s*#?\s*(\d{1,3})\b/gi,
  /#(\d{1,3})\b/g,
];
// Why a search result was not offered, as the Recent searches list shows it.
// A filter reports the first check that fails, in the order it runs them.
const REJECTION = Object.freeze({
  EXCLUDED_WORD: 'excluded-word',
  UNKNOWN_LENGTH: 'unknown-length',
  TOO_SHORT: 'too-short',
  OUTSIDE_RUNTIME: 'outside-runtime',
  NAME_MISSING: 'name-missing',
  NO_EPISODE_MARKER: 'no-episode-marker',
  WRONG_EPISODE: 'wrong-episode',
  SEVERAL_EPISODES: 'several-episodes',
  ANOTHER_SERIES: 'another-series',
  EPISODE_TITLE_MISSING: 'episode-title-missing',
  ANOTHER_EPISODE_TITLE: 'another-episode-title',
  EPISODE_NUMBER_MISSING: 'episode-number-missing',
  WRONG_DATE: 'wrong-date',
  YEAR_MISSING: 'year-missing',
  FAILED_RECENTLY: 'failed-recently',
  NOT_CLOSEST_CHANNEL: 'not-closest-channel',
  NO_RELEASE_NAME: 'no-release-name',
  DUPLICATE_NAME: 'duplicate-name',
  OVER_LIMIT: 'over-limit',
});

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

// Below these lengths Sonarr holds an import back as a sample.
function sampleThresholdSeconds(runtimeSeconds) {
  if (runtimeSeconds > LONG_RUNTIME_SECONDS) return LONG_RUNTIME_SAMPLE_SECONDS;
  if (runtimeSeconds > SHORT_RUNTIME_SECONDS) return MID_RUNTIME_SAMPLE_SECONDS;
  return SHORT_RUNTIME_SAMPLE_SECONDS;
}

/**
 * The lengths a video may have to be the episode or movie whose runtime
 * Sonarr or Radarr reports. Listed runtimes are often the broadcast slot, so
 * an upload runs shorter; a double episode or a clip falls outside.
 * @param {number|null} runtimeSeconds
 * @param {'tv'|'movie'} kind
 * @returns {{minSeconds: number, maxSeconds: number}|null} Null without a runtime
 */
function runtimeWindow(runtimeSeconds, kind) {
  if (typeof runtimeSeconds !== 'number' || !(runtimeSeconds > 0)) return null;
  if (kind === 'movie') {
    return {
      minSeconds: Math.round(runtimeSeconds * MOVIE_RUNTIME_MIN_RATIO),
      maxSeconds: Math.round(runtimeSeconds * MOVIE_RUNTIME_MAX_RATIO),
    };
  }
  const lowest = Math.min(runtimeSeconds * TV_RUNTIME_MIN_RATIO, runtimeSeconds - TV_RUNTIME_SLACK_SECONDS);
  const highest = Math.max(runtimeSeconds * TV_RUNTIME_MAX_RATIO, runtimeSeconds + TV_RUNTIME_SLACK_SECONDS);
  return {
    minSeconds: Math.round(Math.max(sampleThresholdSeconds(runtimeSeconds), lowest)),
    maxSeconds: Math.round(highest),
  };
}

/**
 * @param {Object} candidate
 * @param {Object} limits
 * @param {number} limits.minSeconds - The fixed minimum, used without a window
 * @param {{minSeconds: number, maxSeconds: number}|null} [limits.window] - From runtimeWindow
 * @param {boolean} limits.loose - Whether an unknown length passes
 * @returns {string|null} A REJECTION code, or null when the length passes
 */
function durationRejection(candidate, { minSeconds, window = null, loose }) {
  if (typeof candidate.duration !== 'number') return loose ? null : REJECTION.UNKNOWN_LENGTH;
  if (window) {
    const inside = candidate.duration >= window.minSeconds && candidate.duration <= window.maxSeconds;
    return inside ? null : REJECTION.OUTSIDE_RUNTIME;
  }
  return candidate.duration >= minSeconds ? null : REJECTION.TOO_SHORT;
}

/**
 * @param {Object} candidate
 * @param {Object} limits - As for durationRejection
 * @returns {boolean}
 */
function passesDuration(candidate, limits) {
  return durationRejection(candidate, limits) === null;
}

// The checks every request shares: exclude terms, length, and every
// significant word of the request text.
function commonRejection(candidate, { terms, requestText, minSeconds, window, settings }) {
  if (hasExcludedTerm(candidate.title, settings.excludeTerms, requestText)) return REJECTION.EXCLUDED_WORD;
  const length = durationRejection(candidate, { minSeconds, window, loose: settings.looseMatching });
  if (length) return length;
  const tokens = titleTokens(candidate.title);
  return terms.every((term) => tokens.has(term)) ? null : REJECTION.NAME_MISSING;
}

// Keeps the candidates rejectionOf has nothing against, and tells onReject
// about the others.
function keepUnrejected(candidates, rejectionOf, onReject) {
  return candidates.filter((candidate) => {
    const reason = rejectionOf(candidate);
    if (reason && onReject) onReject(candidate, reason);
    return !reason;
  });
}

function rejectAll(candidates, reason, onReject) {
  if (onReject) candidates.forEach((candidate) => onReject(candidate, reason));
  return [];
}

function tvContext(text, settings, runtimeSeconds) {
  return {
    terms: matchTerms(text, { dropTrailingYear: true }),
    requestText: text,
    minSeconds: settings.minTvSeconds,
    window: runtimeWindow(runtimeSeconds, 'tv'),
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
 * Every filter takes an optional runtimeSeconds (from Sonarr or Radarr):
 * with it, a video must be inside runtimeWindow instead of over the fixed
 * minimum. Every filter also takes an optional onReject(candidate, code),
 * called with a REJECTION code for each candidate it leaves out.
 * @returns {Array<Object>} Candidates for one episode, in source order
 */
function filterTvEpisode(candidates, { text, season, episode, runtimeSeconds, settings, onReject }) {
  const context = tvContext(text, settings, runtimeSeconds);
  if (context.terms.length === 0) return rejectAll(candidates, REJECTION.NAME_MISSING, onReject);
  return keepUnrejected(candidates, (candidate) => {
    const common = commonRejection(candidate, context);
    if (common) return common;
    if (hasEpisodeRange(candidate.title)) return REJECTION.SEVERAL_EPISODES;
    const markers = episodeMarkers(candidate.title);
    // Exactly one marker: a title naming several episodes is a compilation.
    if (markers.length === 1) {
      if (markers[0].season !== season || markers[0].episode !== episode) return REJECTION.WRONG_EPISODE;
      const another = !settings.looseMatching && namesAnotherSeries(candidate.title, context);
      return another ? REJECTION.ANOTHER_SERIES : null;
    }
    if (markers.length > 1) return REJECTION.SEVERAL_EPISODES;
    if (!settings.looseMatching) return REJECTION.NO_EPISODE_MARKER;
    const numbers = looseEpisodeNumbers(candidate.title);
    if (numbers.includes(episode)) return null;
    return numbers.length > 0 ? REJECTION.WRONG_EPISODE : REJECTION.NO_EPISODE_MARKER;
  }, onReject);
}

/**
 * Candidates for a whole season, each with the episode its own title names.
 * Always strict: a season answer may be grabbed by a bulk search.
 * @returns {Array<{candidate: Object, episode: number}>}
 */
function filterTvSeason(candidates, { text, season, runtimeSeconds, settings, onReject }) {
  const context = tvContext(text, { ...settings, looseMatching: false }, runtimeSeconds);
  if (context.terms.length === 0) return rejectAll(candidates, REJECTION.NAME_MISSING, onReject);
  return keepUnrejected(candidates, (candidate) => {
    const common = commonRejection(candidate, context);
    if (common) return common;
    if (hasEpisodeRange(candidate.title)) return REJECTION.SEVERAL_EPISODES;
    const markers = episodeMarkers(candidate.title);
    if (markers.length === 0) return REJECTION.NO_EPISODE_MARKER;
    if (markers.length > 1) return REJECTION.SEVERAL_EPISODES;
    if (markers[0].season !== season) return REJECTION.WRONG_EPISODE;
    return namesAnotherSeries(candidate.title, context) ? REJECTION.ANOTHER_SERIES : null;
  }, onReject).map((candidate) => ({ candidate, episode: episodeMarkers(candidate.title)[0].episode }));
}

const utcDay = (date) => Math.floor(new Date(date).getTime() / DAY_MS);

/**
 * @param {Object} options
 * @param {Date} options.date - The air date, at UTC midnight
 * @returns {Array<Object>} Candidates published on or next to the air date
 */
function filterTvDaily(candidates, { text, date, runtimeSeconds, settings, onReject }) {
  const context = tvContext(text, settings, runtimeSeconds);
  if (context.terms.length === 0) return rejectAll(candidates, REJECTION.NAME_MISSING, onReject);
  const airDay = utcDay(date);
  return keepUnrejected(candidates, (candidate) => {
    if (!candidate.publishedAt) return REJECTION.WRONG_DATE;
    const common = commonRejection(candidate, context);
    if (common) return common;
    const publishedDay = utcDay(candidate.publishedAt);
    const onAirDate = Number.isFinite(publishedDay) && Math.abs(publishedDay - airDay) <= DAILY_TOLERANCE_DAYS;
    return onAirDate ? null : REJECTION.WRONG_DATE;
  }, onReject);
}

/**
 * @returns {Array<Object>} Candidates for a movie, in source order
 */
function filterMovie(candidates, { title, year, runtimeSeconds, settings, onReject }) {
  const context = {
    terms: matchTerms(title),
    requestText: title,
    minSeconds: settings.minMovieSeconds,
    window: runtimeWindow(runtimeSeconds, 'movie'),
    settings,
  };
  if (context.terms.length === 0) return rejectAll(candidates, REJECTION.NAME_MISSING, onReject);
  return keepUnrejected(candidates, (candidate) => {
    const common = commonRejection(candidate, context);
    if (common) return common;
    const hasYear = settings.looseMatching || titleTokens(candidate.title).has(String(year));
    return hasYear ? null : REJECTION.YEAR_MISSING;
  }, onReject);
}

module.exports = {
  REJECTION,
  tokenize,
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
  runtimeWindow,
  durationRejection,
  passesDuration,
};
