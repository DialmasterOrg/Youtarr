// Turns a classified Newznab request into feed items: the placeholder for the
// no-query feed, nothing for requests a YouTube-wide search cannot answer
// honestly, and otherwise one YouTube search, filtered and named.
const { readSettings } = require('./arrBridgeConfig');
const candidateFilter = require('./candidateFilter');
const { PLACEHOLDER_ID, buildNzbLink } = require('./nzbFile');
const {
  DEFAULT_GROUP, groupToken, resolutionLabel, buildTvTitle, buildDailyTitle, buildMovieTitle,
} = require('./releaseNaming');

const EPISODE_SEARCH_COUNT = 25;
const SEASON_SEARCH_COUNT = 50;
// The apps' indexer Test fails on an empty no-query feed. These titles parse
// but match nothing in a real library, and their link answers 404.
const PLACEHOLDER_TITLES = {
  tv: `Youtarr.Bridge.Placeholder.S01E01.480p.WEB-DL-${DEFAULT_GROUP}`,
  movie: `Youtarr.Bridge.Placeholder.1900.480p.WEB-DL-${DEFAULT_GROUP}`,
};
const PLACEHOLDER_DATE = new Date('2020-01-01T00:00:00.000Z');
const PLACEHOLDER_INFO_URL = 'https://dialmasterorg.github.io/Youtarr/';
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Rough megabits per second by labeled resolution. Only used for the SABnzbd
// queue's size columns; the feed itself always reports 0.
const ESTIMATED_MBPS = { 480: 1, 720: 2.5, 1080: 4.5, 2160: 14 };
const QUERY_NOISE = /[^\p{L}\p{N}\p{M}\s&'-]+/gu;

const pad2 = (value) => String(value).padStart(2, '0');
const cleanQueryText = (text) => String(text).replace(QUERY_NOISE, ' ').replace(/\s+/g, ' ').trim();

function estimateBytes(durationSeconds, resolution) {
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) return 0;
  return Math.round((durationSeconds * (ESTIMATED_MBPS[resolution] || ESTIMATED_MBPS[1080]) * 1_000_000) / 8);
}

function placeholderItem(kind, origin) {
  const title = PLACEHOLDER_TITLES[kind];
  return {
    title,
    guid: `youtarr-${PLACEHOLDER_ID}-${kind}`,
    link: `${origin}/arr/newznab/nzb/${title}.nzb?id=${PLACEHOLDER_ID}&kind=${kind}`,
    comments: PLACEHOLDER_INFO_URL,
    pubDate: PLACEHOLDER_DATE,
    kind,
    youtubeId: null,
  };
}

// What to ask YouTube for, how to filter the answer, and how to name each
// surviving candidate. Null when the request cannot be searched.
function planSearch(request, { settings, isYoutubeApiAvailable }) {
  const text = cleanQueryText(request.text);
  if (!text) return null;
  const { season, episode, year, month, day, textSource } = request;

  if (request.shape === 'episode') {
    return {
      query: `${text} S${pad2(season)}E${pad2(episode)}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvEpisode(results, { text: request.text, season, episode, settings })
        .map((candidate) => ({ candidate, name: { season, episode } })),
      title: (name, naming) => buildTvTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'season') {
    return {
      query: `${text} season ${season}`,
      count: SEASON_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvSeason(results, { text: request.text, season, settings })
        .map((match) => ({ candidate: match.candidate, name: { season, episode: match.episode } })),
      title: (name, naming) => buildTvTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'daily') {
    // The yt-dlp search only knows approximate upload dates ("3 years ago").
    if (!isYoutubeApiAvailable()) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      query: `${text} ${MONTH_NAMES[month - 1]} ${day} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvDaily(results, { text: request.text, date, settings })
        .map((candidate) => ({ candidate, name: { year, month, day } })),
      title: (name, naming) => buildDailyTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'movie') {
    return {
      query: `${text} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterMovie(results, { title: request.text, year, settings })
        .map((candidate) => ({ candidate, name: { year } })),
      title: (name, naming) => buildMovieTitle({ title: request.text, ...name, ...naming }),
    };
  }
  return null;
}

/**
 * @param {Object} deps
 * @param {Function} deps.searchVideos - (query, count) => Promise<Array> in videoSearchModule's result shape
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean; exact upload dates need the API
 * @param {Function} deps.getConfig - () => the full config
 * @param {Function} deps.knownUploadDates - (ids) => Promise<Map<id, Date>> from Youtarr's own rows
 * @param {Function} deps.recentlyFailedIds - (ids) => Promise<Set<id>> of videos whose grab failed lately
 * @param {Object} deps.queue - searchQueue
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 */
function createSearchService({
  searchVideos, isYoutubeApiAvailable, getConfig, knownUploadDates, recentlyFailedIds, queue,
  now = () => new Date(), logger,
}) {
  /**
   * @param {Object} request - From parseNewznabRequest (never the caps shape)
   * @param {string} origin - Scheme and host the client used, for the links
   * @returns {Promise<Array<Object>>} Feed items, best match first. Rejects
   *   with SearchUnavailableError when YouTube could not be searched.
   */
  async function search(request, origin) {
    if (request.shape === 'rss') return [placeholderItem(request.kind === 'movie' ? 'movie' : 'tv', origin)];

    const config = getConfig();
    const settings = readSettings(config);
    const plan = planSearch(request, { settings, isYoutubeApiAvailable });
    if (!plan) return [];

    const results = await queue.run(
      `${plan.count}:${plan.query.toLowerCase()}`,
      () => searchVideos(plan.query, plan.count)
    );
    const selected = plan.select(results);
    if (selected.length === 0) {
      logger.info({ query: plan.query, results: results.length }, 'Sonarr/Radarr search found no match');
      return [];
    }

    const ids = selected.map(({ candidate }) => candidate.youtubeId);
    const [failedIds, knownDates] = await Promise.all([recentlyFailedIds(ids), knownUploadDates(ids)]);
    const resolution = resolutionLabel(config.preferredResolution);
    const usedTitles = new Set();
    const items = [];
    for (const { candidate, name } of selected) {
      if (failedIds.has(candidate.youtubeId)) continue;
      const group = groupToken(candidate.channelName, request.kind);
      const title = plan.title(name, { resolution, group });
      // Two videos with one release title would share a staging folder.
      if (!title || usedTitles.has(title)) continue;
      usedTitles.add(title);
      const pubDate = knownDates.get(candidate.youtubeId)
        || (candidate.publishedAt ? new Date(candidate.publishedAt) : now());
      items.push({
        title,
        guid: `youtarr-${candidate.youtubeId}-${request.kind}`,
        link: buildNzbLink(origin, {
          youtubeId: candidate.youtubeId,
          kind: request.kind,
          releaseTitle: title,
          uploadDate: pubDate,
          estimatedBytes: estimateBytes(candidate.duration, resolution),
        }, settings.apiKey),
        comments: `https://www.youtube.com/watch?v=${candidate.youtubeId}`,
        pubDate,
        kind: request.kind,
        youtubeId: candidate.youtubeId,
      });
      if (items.length === request.limit) break;
    }
    logger.info(
      { query: plan.query, results: results.length, offered: items.length },
      'Sonarr/Radarr search answered'
    );
    return items;
  }

  return { search };
}

module.exports = { createSearchService, estimateBytes };
