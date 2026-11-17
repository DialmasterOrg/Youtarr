// Decides which YouTube search results are one episode, going by what the
// user's Sonarr says about it: its title, its runtime, and the titles of the
// series' other episodes. Official uploads are titled "Episode 29: <title>"
// with no season, so the episode-code rules in candidateFilter never see
// them. The release name still comes from the request; this only chooses
// which videos may carry it.
const {
  REJECTION, tokenize, matchTerms, titleTokens, episodeMarkers, hasEpisodeRange, hasExcludedTerm,
  runtimeWindow, durationRejection,
} = require('./candidateFilter');

// "Part 2" is deliberately absent: it belongs to one episode's title.
const BARE_EPISODE_PATTERNS = [
  /\b(?:episode|ep\.?)\s*#?\s*(\d{1,3})\b/gi,
  /\be(\d{1,3})\b/gi,
  /#(\d{1,3})\b/g,
];
// A title of fewer significant words ("Pilot", "The Fight") turns up in
// unrelated titles too often to identify an episode on its own.
const MIN_TITLE_WORDS_WITHOUT_NUMBER = 2;
const YEAR_WORD = /^(?:19|20)\d{2}$/;
const CHANNEL_IS_SERIES_NAME = 2;
const CHANNEL_CONTAINS_SERIES_NAME = 1;
const CHANNEL_UNRELATED = 0;

const phrase = (text) => ` ${tokenize(String(text ?? '').replace(/&/g, ' and ')).join(' ')} `;

/**
 * Episode numbers written without a season ("Episode 29", "Ep.30", "E08", "#7").
 * @param {string} title
 * @returns {number[]} Distinct numbers
 */
function bareEpisodeNumbers(title) {
  const text = String(title ?? '');
  const numbers = new Set();
  for (const pattern of BARE_EPISODE_PATTERNS) {
    for (const match of text.matchAll(pattern)) numbers.add(Number(match[1]));
  }
  return [...numbers];
}

// A second episode number, a range, a marker for another episode, or the
// title of another episode of the series: the video is not (only) this one.
// Answers which of these it is, as a REJECTION code, or null.
function anotherEpisodeRejection(candidate, titlePhrase, episode, otherPhrases) {
  if (hasEpisodeRange(candidate.title)) return REJECTION.SEVERAL_EPISODES;
  const wrongMarker = episodeMarkers(candidate.title)
    .some((marker) => marker.season !== episode.season || marker.episode !== episode.episode);
  if (wrongMarker) return REJECTION.WRONG_EPISODE;
  // One differing number is not held against it: official channels count
  // episodes across seasons ("Episode 56" for S02E05).
  if (bareEpisodeNumbers(candidate.title).length > 1) return REJECTION.SEVERAL_EPISODES;
  return otherPhrases.some((other) => titlePhrase.includes(other)) ? REJECTION.ANOTHER_EPISODE_TITLE : null;
}

function carriesEpisodeNumber(candidate, episode) {
  const marked = episodeMarkers(candidate.title)
    .some((marker) => marker.season === episode.season && marker.episode === episode.episode);
  if (marked) return true;
  const bare = bareEpisodeNumbers(candidate.title);
  return bare.includes(episode.episode)
    || (episode.absoluteNumber !== null && bare.includes(episode.absoluteNumber));
}

const seriesTermsOf = (episode) => episode.seriesTitles
  .map((name) => matchTerms(name, { dropTrailingYear: true }))
  .filter((terms) => terms.length > 0);

// The series' own titles and the episode's: a word they contain never excludes.
const ownTextOf = (episode) => [...episode.seriesTitles, episode.episodeTitle].join(' ');

// "Mission Impossible Reviews" covers the show, it is not the show's channel.
// Channel names carry the excluded words in the plural, which a title's
// exclude terms are not matched in.
function coversSeries(channelName, { excludeTerms, ownText }) {
  return hasExcludedTerm(channelName, [...excludeTerms, ...excludeTerms.map((term) => `${term}s`)], ownText);
}

// How closely the uploading channel's name ties it to the series: it is the
// series name, it contains the name ("BEYBLADE Official", but also the
// re-uploader "MrBeast 103M view 6 hours ago"), or it does not name it.
// A channel about the series (its name has an excluded word) does not.
function channelRank(candidate, seriesTerms, exclusions) {
  const channelName = candidate.channelName ?? '';
  if (coversSeries(channelName, exclusions)) return CHANNEL_UNRELATED;
  const ownTerms = matchTerms(channelName).join(' ');
  if (seriesTerms.some((terms) => terms.join(' ') === ownTerms)) return CHANNEL_IS_SERIES_NAME;
  const channelWords = titleTokens(channelName);
  return seriesTerms.some((terms) => terms.every((term) => channelWords.has(term)))
    ? CHANNEL_CONTAINS_SERIES_NAME
    : CHANNEL_UNRELATED;
}

/**
 * @param {Object} candidate - A YouTube search result
 * @param {Object} episode - arrCatalog.resolveEpisode's result
 * @param {Object} settings - readSettings() result
 * @returns {number} 2 when the channel has the series' name, 1 when its name
 *   contains it, 0 otherwise
 */
function seriesChannelRank(candidate, episode, settings) {
  return channelRank(candidate, seriesTermsOf(episode), {
    excludeTerms: settings.excludeTerms, ownText: ownTextOf(episode),
  });
}

// The series name, under any of its titles, in the video's title or in the
// channel's name: a channel dedicated to a show leaves it out of the titles.
// Never half in each: "Doctor Mike" asking "Who will survive?" is not Doctor Who.
function namesSeries(candidate, seriesTerms, exclusions) {
  const titleWords = titleTokens(candidate.title);
  return seriesTerms.some((terms) => terms.every((term) => titleWords.has(term)))
    || channelRank(candidate, seriesTerms, exclusions) > CHANNEL_UNRELATED;
}

// Signs that the video belongs to another series of a similar name: it names
// one of the library's series whose name contains this one's ("Beyblade
// Burst"), or carries a year from before this series began (the original of
// a remake). A later year is no sign: episodes air for years.
function namesAnotherSeries(candidate, titlePhrase, { siblingPhrases, seriesYear, ownWords }) {
  const channelPhrase = phrase(candidate.channelName);
  if (siblingPhrases.some((sibling) => titlePhrase.includes(sibling) || channelPhrase.includes(sibling))) return true;
  if (seriesYear === null) return false;
  return tokenize(candidate.title)
    .some((word) => YEAR_WORD.test(word) && !ownWords.has(word) && Number(word) < seriesYear);
}

/**
 * Under strict matching the episode's length is part of the evidence, so an
 * episode whose runtime Sonarr does not know cannot be matched by title: an
 * hour of episodes that lists this one's title would pass.
 * @param {Object} episode - arrCatalog.resolveEpisode's result
 * @param {Object} settings - readSettings() result
 * @returns {boolean}
 */
function canMatchByTitle(episode, settings) {
  if (!episode?.episodeTitle) return false;
  return settings.looseMatching || runtimeWindow(episode.runtimeSeconds, 'tv') !== null;
}

/**
 * @param {Array<Object>} candidates - YouTube search results
 * @param {Object} options
 * @param {Object} options.episode - arrCatalog.resolveEpisode's result, with an episodeTitle
 * @param {Object} options.settings - readSettings() result
 * @param {Function} [options.onReject] - (candidate, code) for each candidate
 *   left out, with the REJECTION code of the first check it failed
 * @returns {Array<Object>} The candidates that are this episode, the closest
 *   channel (seriesChannelRank) first and otherwise in source order
 */
function filterByEpisodeTitle(candidates, { episode, settings, onReject }) {
  const loose = settings.looseMatching;
  const rejectAll = () => {
    if (onReject) candidates.forEach((candidate) => onReject(candidate, REJECTION.EPISODE_TITLE_MISSING));
    return [];
  };
  if (!canMatchByTitle(episode, settings)) return rejectAll();
  const wanted = phrase(episode.episodeTitle);
  if (wanted.trim() === '') return rejectAll();
  const otherPhrases = episode.otherEpisodeTitles.map(phrase).filter((other) => other.trim() !== '');
  const seriesTerms = seriesTermsOf(episode);
  const needsNumber = matchTerms(episode.episodeTitle).length < MIN_TITLE_WORDS_WITHOUT_NUMBER;
  // A word of the series name or the episode title never excludes.
  const ownText = ownTextOf(episode);
  const exclusions = { excludeTerms: settings.excludeTerms, ownText };
  const otherSeries = {
    siblingPhrases: (episode.siblingTitles ?? []).map(phrase).filter((sibling) => sibling.trim() !== ''),
    seriesYear: episode.seriesYear ?? null,
    ownWords: new Set(tokenize(ownText)),
  };
  const limits = {
    minSeconds: settings.minTvSeconds,
    window: runtimeWindow(episode.runtimeSeconds, 'tv'),
    loose,
  };

  const rejectionOf = (candidate) => {
    if (hasExcludedTerm(candidate.title, settings.excludeTerms, ownText)) return REJECTION.EXCLUDED_WORD;
    const length = durationRejection(candidate, limits);
    if (length) return length;
    const titlePhrase = phrase(candidate.title);
    if (!titlePhrase.includes(wanted)) return REJECTION.EPISODE_TITLE_MISSING;
    const anotherEpisode = anotherEpisodeRejection(candidate, titlePhrase, episode, otherPhrases);
    if (anotherEpisode) return anotherEpisode;
    if (loose) return null;
    if (!namesSeries(candidate, seriesTerms, exclusions)) return REJECTION.NAME_MISSING;
    if (namesAnotherSeries(candidate, titlePhrase, otherSeries)) return REJECTION.ANOTHER_SERIES;
    return !needsNumber || carriesEpisodeNumber(candidate, episode) ? null : REJECTION.EPISODE_NUMBER_MISSING;
  };
  const kept = candidates.filter((candidate) => {
    const reason = rejectionOf(candidate);
    if (reason && onReject) onReject(candidate, reason);
    return !reason;
  });
  // YouTube ranks a re-upload titled "<episode> #<series>" above the show's
  // own upload; the show's own channel is the better match.
  const ranks = new Map(kept.map((candidate) => [candidate, channelRank(candidate, seriesTerms, exclusions)]));
  return kept.sort((a, b) => ranks.get(b) - ranks.get(a));
}

module.exports = { filterByEpisodeTitle, canMatchByTitle, seriesChannelRank, bareEpisodeNumbers };
