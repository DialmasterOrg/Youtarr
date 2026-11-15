// Decides which YouTube search results are one episode, going by what the
// user's Sonarr says about it: its title, its runtime, and the titles of the
// series' other episodes. Official uploads are titled "Episode 29: <title>"
// with no season, so the episode-code rules in candidateFilter never see
// them. The release name still comes from the request; this only chooses
// which videos may carry it.
const {
  tokenize, matchTerms, titleTokens, episodeMarkers, hasEpisodeRange, hasExcludedTerm,
  runtimeWindow, passesDuration,
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
function namesAnotherEpisode(candidate, titlePhrase, episode, otherPhrases) {
  if (hasEpisodeRange(candidate.title)) return true;
  const wrongMarker = episodeMarkers(candidate.title)
    .some((marker) => marker.season !== episode.season || marker.episode !== episode.episode);
  if (wrongMarker) return true;
  // One differing number is not held against it: official channels count
  // episodes across seasons ("Episode 56" for S02E05).
  if (bareEpisodeNumbers(candidate.title).length > 1) return true;
  return otherPhrases.some((other) => titlePhrase.includes(other));
}

function carriesEpisodeNumber(candidate, episode) {
  const marked = episodeMarkers(candidate.title)
    .some((marker) => marker.season === episode.season && marker.episode === episode.episode);
  if (marked) return true;
  const bare = bareEpisodeNumbers(candidate.title);
  return bare.includes(episode.episode)
    || (episode.absoluteNumber !== null && bare.includes(episode.absoluteNumber));
}

// The series name, under any of its titles, in the video's title or in the
// channel's name: a channel dedicated to a show leaves it out of the titles.
// Never half in each: "Doctor Mike" asking "Who will survive?" is not Doctor Who.
function namesSeries(candidate, seriesTerms) {
  const titleWords = titleTokens(candidate.title);
  const channelWords = titleTokens(candidate.channelName ?? '');
  return seriesTerms.some((terms) => (
    terms.every((term) => titleWords.has(term)) || terms.every((term) => channelWords.has(term))
  ));
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
 * @returns {Array<Object>} The candidates that are this episode, in source order
 */
function filterByEpisodeTitle(candidates, { episode, settings }) {
  const loose = settings.looseMatching;
  if (!canMatchByTitle(episode, settings)) return [];
  const wanted = phrase(episode.episodeTitle);
  if (wanted.trim() === '') return [];
  const otherPhrases = episode.otherEpisodeTitles.map(phrase).filter((other) => other.trim() !== '');
  const seriesTerms = episode.seriesTitles
    .map((name) => matchTerms(name, { dropTrailingYear: true }))
    .filter((terms) => terms.length > 0);
  const needsNumber = matchTerms(episode.episodeTitle).length < MIN_TITLE_WORDS_WITHOUT_NUMBER;
  // A word of the series name or the episode title never excludes.
  const ownText = [...episode.seriesTitles, episode.episodeTitle].join(' ');
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

  return candidates.filter((candidate) => {
    if (hasExcludedTerm(candidate.title, settings.excludeTerms, ownText)) return false;
    if (!passesDuration(candidate, limits)) return false;
    const titlePhrase = phrase(candidate.title);
    if (!titlePhrase.includes(wanted)) return false;
    if (namesAnotherEpisode(candidate, titlePhrase, episode, otherPhrases)) return false;
    if (loose) return true;
    if (!namesSeries(candidate, seriesTerms)) return false;
    if (namesAnotherSeries(candidate, titlePhrase, otherSeries)) return false;
    return !needsNumber || carriesEpisodeNumber(candidate, episode);
  });
}

module.exports = { filterByEpisodeTitle, canMatchByTitle, bareEpisodeNumbers };
