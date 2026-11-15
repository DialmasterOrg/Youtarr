// Turns a classified Newznab request into feed items: the placeholder for the
// no-query feed, nothing for requests a YouTube-wide search cannot answer
// honestly, and otherwise a YouTube search, filtered and named. When the
// user's Sonarr knows the episode, a search by episode title runs first and
// the search by episode code only when that offers nothing.
const { readSettings } = require('./arrBridgeConfig');
const candidateFilter = require('./candidateFilter');
const { filterByEpisodeTitle, canMatchByTitle } = require('./episodeMatcher');
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
// "Bluey (2018)": the year tells Sonarr's series apart, not YouTube's videos.
const TRAILING_YEAR_TAG = /\s*\((?:19|20)\d{2}\)\s*$/;
const HTML_ENTITY = /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' };
const MAX_CODE_POINT = 0x10ffff;
// Without a Sonarr or Radarr connection nothing is known about a request.
const NO_CATALOG = {
  resolveEpisode: async () => null,
  resolveSeries: async () => null,
  resolveMovie: async () => null,
};

const pad2 = (value) => String(value).padStart(2, '0');
const cleanQueryText = (text) => String(text).replace(QUERY_NOISE, ' ').replace(/\s+/g, ' ').trim();

/**
 * The YouTube Data API returns titles and channel names HTML-encoded
 * ("It&#39;s"); yt-dlp returns them plain, which this leaves alone.
 * @param {string} text
 * @returns {string} Decoded once
 */
function decodeHtmlEntities(text) {
  return String(text ?? '').replace(HTML_ENTITY, (entity, body) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    const hex = body[1] === 'x' || body[1] === 'X';
    const codePoint = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    return codePoint > 0 && codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : entity;
  });
}

const decodeResult = (result) => ({
  ...result,
  title: decodeHtmlEntities(result.title),
  channelName: decodeHtmlEntities(result.channelName),
});

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
// runtimeSeconds is what Sonarr or Radarr reports, or null.
function planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds = null }) {
  const text = cleanQueryText(request.text);
  if (!text) return null;
  const { season, episode, year, month, day, textSource } = request;

  if (request.shape === 'episode') {
    return {
      matcher: 'episode-code',
      query: `${text} S${pad2(season)}E${pad2(episode)}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvEpisode(results, { text: request.text, season, episode, runtimeSeconds, settings })
        .map((candidate) => ({ candidate, name: { season, episode } })),
      title: (name, naming) => buildTvTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'season') {
    return {
      matcher: 'season',
      query: `${text} season ${season}`,
      count: SEASON_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvSeason(results, { text: request.text, season, runtimeSeconds, settings })
        .map((match) => ({ candidate: match.candidate, name: { season, episode: match.episode } })),
      title: (name, naming) => buildTvTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'daily') {
    // The yt-dlp search only knows approximate upload dates ("3 years ago").
    if (!isYoutubeApiAvailable()) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      matcher: 'daily',
      query: `${text} ${MONTH_NAMES[month - 1]} ${day} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterTvDaily(results, { text: request.text, date, runtimeSeconds, settings })
        .map((candidate) => ({ candidate, name: { year, month, day } })),
      title: (name, naming) => buildDailyTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'movie') {
    return {
      matcher: 'movie',
      query: `${text} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results) => candidateFilter
        .filterMovie(results, { title: request.text, year, runtimeSeconds, settings })
        .map((candidate) => ({ candidate, name: { year } })),
      title: (name, naming) => buildMovieTitle({ title: request.text, ...name, ...naming }),
    };
  }
  return null;
}

// The search by what Sonarr calls the episode. The query always uses the
// series' main title, so the alias requests of one search in Sonarr share a
// single YouTube search; each is still named from the alias it asked for.
function planEpisodeTitleSearch(request, episode, settings) {
  const query = cleanQueryText(`${episode.seriesTitle.replace(TRAILING_YEAR_TAG, '')} ${episode.episodeTitle}`);
  if (!query) return null;
  const name = { season: request.season, episode: request.episode };
  return {
    matcher: 'episode-title',
    query,
    count: EPISODE_SEARCH_COUNT,
    select: (results) => filterByEpisodeTitle(results, { episode, settings })
      .map((candidate) => ({ candidate, name })),
    title: (titleName, naming) => buildTvTitle({
      text: request.text, textSource: request.textSource, ...titleName, ...naming,
    }),
  };
}

/**
 * @param {Object} deps
 * @param {Function} deps.searchVideos - (query, count) => Promise<Array> in videoSearchModule's result shape
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean; exact upload dates need the API
 * @param {Function} deps.getConfig - () => the full config
 * @param {Function} deps.knownUploadDates - (ids) => Promise<Map<id, Date>> from Youtarr's own rows
 * @param {Function} deps.recentlyFailedIds - (ids) => Promise<Set<id>> of videos whose grab failed lately
 * @param {Object} deps.queue - searchQueue
 * @param {Object} [deps.catalog] - arrCatalog; without it nothing is known about a request
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 */
function createSearchService({
  searchVideos, isYoutubeApiAvailable, getConfig, knownUploadDates, recentlyFailedIds, queue,
  catalog = NO_CATALOG, now = () => new Date(), logger,
}) {
  // One YouTube search, filtered and turned into feed items.
  async function runPlan(plan, { request, origin, config, settings }) {
    const found = await queue.run(
      `${plan.count}:${plan.query.toLowerCase()}`,
      () => searchVideos(plan.query, plan.count)
    );
    const results = found.map(decodeResult);
    const selected = plan.select(results);
    if (selected.length === 0) {
      logger.info(
        { matcher: plan.matcher, query: plan.query, results: results.length },
        'Sonarr/Radarr search found no match'
      );
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
      { matcher: plan.matcher, query: plan.query, results: results.length, offered: items.length },
      'Sonarr/Radarr search answered'
    );
    return items;
  }

  // The runtime Sonarr or Radarr reports for what a season, daily or movie
  // request is about, or null.
  async function knownRuntime(request) {
    if (request.shape === 'movie') {
      return (await catalog.resolveMovie({ text: request.text, year: request.year }))?.runtimeSeconds ?? null;
    }
    return (await catalog.resolveSeries({ text: request.text }))?.runtimeSeconds ?? null;
  }

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
    const context = { request, origin, config, settings };
    // Requests that cannot be searched at all never ask Sonarr or Radarr.
    if (!planSearch(request, { settings, isYoutubeApiAvailable })) return [];

    if (request.shape !== 'episode') {
      const runtimeSeconds = await knownRuntime(request);
      return runPlan(planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds }), context);
    }

    const episode = await catalog.resolveEpisode({
      text: request.text, season: request.season, episode: request.episode,
    });
    const titlePlan = canMatchByTitle(episode, settings) ? planEpisodeTitleSearch(request, episode, settings) : null;
    if (titlePlan) {
      const items = await runPlan(titlePlan, context);
      if (items.length > 0) return items;
    }
    // Nothing by title (or its only match failed a grab lately): the search
    // by episode code still finds re-uploads named like releases.
    const runtimeSeconds = episode?.runtimeSeconds ?? null;
    return runPlan(planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds }), context);
  }

  return { search };
}

module.exports = { createSearchService, estimateBytes, decodeHtmlEntities };
