// Turns a classified Newznab request into feed items: the placeholder for the
// no-query feed, nothing for requests a YouTube-wide search cannot answer
// honestly, and otherwise a YouTube search, filtered and named. When the
// user's Sonarr knows the episode, a search by episode title runs first and
// the search by episode code only when that offers nothing.
const { readSettings } = require('./arrBridgeConfig');
const candidateFilter = require('./candidateFilter');
const { filterByEpisodeTitle, canMatchByTitle, seriesChannelRank } = require('./episodeMatcher');
const { PLACEHOLDER_ID, buildNzbLink } = require('./nzbFile');
const { createRecentSearches, NOTE, TITLE_STAGE_SKIPPED } = require('./recentSearches');
const {
  DEFAULT_GROUP, groupToken, labelFor, buildTvTitle, buildDailyTitle, buildMovieTitle,
} = require('./releaseNaming');
const { LOOKUP_BUDGET_MS } = require('./videoResolution');

const { REJECTION } = candidateFilter;

const EPISODE_SEARCH_COUNT = 25;
// Sonarr and Radarr wait 100 s for an answer. The resolution lookup only
// gets what is left of this, so a slow search never pushes past it.
const REQUEST_BUDGET_MS = 80 * 1000;
const SEASON_SEARCH_COUNT = 50;
// The apps' indexer Test fails on an empty no-query feed. These titles parse
// but match nothing in a real library, and their link answers 404.
const PLACEHOLDER_TITLES = {
  tv: `Youtarr.Bridge.Placeholder.S01E01.480p.YT.WEB-DL-${DEFAULT_GROUP}`,
  movie: `Youtarr.Bridge.Placeholder.1900.480p.YT.WEB-DL-${DEFAULT_GROUP}`,
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
// Without it every label is the download resolution.
const NO_VIDEO_RESOLUTION = { lookup: async () => new Map() };

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
// runtimeSeconds is what Sonarr or Radarr reports, or null. A plan's select
// takes the results and an onReject(candidate, code) for those it leaves out.
function planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds = null }) {
  const text = cleanQueryText(request.text);
  if (!text) return null;
  const { season, episode, year, month, day, textSource } = request;

  if (request.shape === 'episode') {
    return {
      matcher: 'episode-code',
      query: `${text} S${pad2(season)}E${pad2(episode)}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results, onReject) => candidateFilter
        .filterTvEpisode(results, { text: request.text, season, episode, runtimeSeconds, settings, onReject })
        .map((candidate) => ({ candidate, name: { season, episode } })),
      title: (name, naming) => buildTvTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'season') {
    return {
      matcher: 'season',
      query: `${text} season ${season}`,
      count: SEASON_SEARCH_COUNT,
      select: (results, onReject) => candidateFilter
        .filterTvSeason(results, { text: request.text, season, runtimeSeconds, settings, onReject })
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
      // Only the API gives the exact upload dates a daily episode is matched by.
      needsApi: true,
      query: `${text} ${MONTH_NAMES[month - 1]} ${day} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results, onReject) => candidateFilter
        .filterTvDaily(results, { text: request.text, date, runtimeSeconds, settings, onReject })
        .map((candidate) => ({ candidate, name: { year, month, day } })),
      title: (name, naming) => buildDailyTitle({ text: request.text, textSource, ...name, ...naming }),
    };
  }
  if (request.shape === 'movie') {
    return {
      matcher: 'movie',
      query: `${text} ${year}`,
      count: EPISODE_SEARCH_COUNT,
      select: (results, onReject) => candidateFilter
        .filterMovie(results, { title: request.text, year, runtimeSeconds, settings, onReject })
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
    select: (results, onReject) => filterByEpisodeTitle(results, { episode, settings, onReject })
      .map((candidate) => ({ candidate, name, channelRank: seriesChannelRank(candidate, episode, settings) })),
    // Sonarr grabs the newer of two equal releases, whatever the feed's
    // order, and a re-upload is always newer than the show's own upload.
    closestChannelOnly: !settings.looseMatching,
    title: (titleName, naming) => buildTvTitle({
      text: request.text, textSource: request.textSource, ...titleName, ...naming,
    }),
  };
}

// Why an episode request is not searched by the episode's title: episode is
// what the catalog resolved, or null.
function titleStageSkipReason(episode, settings) {
  if (!episode) return settings.sonarr ? TITLE_STAGE_SKIPPED.UNKNOWN_SERIES : TITLE_STAGE_SKIPPED.NO_CONNECTION;
  // A title that could be matched, but leaves nothing to search for, is no title either.
  if (!episode.episodeTitle || canMatchByTitle(episode, settings)) return TITLE_STAGE_SKIPPED.NO_USABLE_TITLE;
  return TITLE_STAGE_SKIPPED.NO_RUNTIME;
}

// Why a request that planSearch has no plan for is not searched.
function notSearchedReason(request, isYoutubeApiAvailable) {
  if (request.shape === 'empty') return request.emptyReason ?? NOTE.NOT_SEARCHABLE;
  if (request.shape === 'daily' && cleanQueryText(request.text) && !isYoutubeApiAvailable()) {
    return NOTE.DAILY_NEEDS_API;
  }
  return NOTE.NO_SEARCH_TEXT;
}

/**
 * @param {Object} deps
 * @param {Function} deps.searchVideos - (query, count, { needsApi }) => Promise<Array> in videoSearchModule's result shape
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean; exact upload dates need the API
 * @param {Function} deps.getConfig - () => the full config
 * @param {Function} deps.knownUploadDates - (ids) => Promise<Map<id, Date>> from Youtarr's own rows
 * @param {Function} deps.recentlyFailedIds - (ids) => Promise<Set<id>> of videos whose grab failed lately
 * @param {Object} deps.queue - searchQueue
 * @param {Object} [deps.catalog] - arrCatalog; without it nothing is known about a request
 * @param {Object} [deps.videoResolution] - videoResolution; without it nothing is known about a video's resolution
 * @param {Object} [deps.recentSearches] - recentSearches; every request is recorded in it
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 */
function createSearchService({
  searchVideos, isYoutubeApiAvailable, getConfig, knownUploadDates, recentlyFailedIds, queue,
  catalog = NO_CATALOG, videoResolution = NO_VIDEO_RESOLUTION, recentSearches = createRecentSearches(),
  now = () => new Date(), logger,
}) {
  // The real resolution of each candidate that is known. Never rejects: a
  // failed lookup, or none for lack of time, leaves every label at the ceiling.
  async function realResolutions(candidates, ceiling, startedAt) {
    const budgetMs = Math.min(LOOKUP_BUDGET_MS, REQUEST_BUDGET_MS - (now().getTime() - startedAt.getTime()));
    if (budgetMs <= 0) return new Map();
    try {
      return await videoResolution.lookup(candidates, { ceiling, budgetMs });
    } catch (err) {
      logger.warn({ err }, 'Sonarr/Radarr resolution lookup failed; labeling with the download resolution or label limit');
      return new Map();
    }
  }

  // One YouTube search, filtered and turned into feed items. The record
  // learns what became of every result.
  async function runPlan(plan, { request, origin, config, settings, startedAt, record }) {
    const found = await queue.run(
      `${plan.count}:${plan.query.toLowerCase()}`,
      () => searchVideos(plan.query, plan.count, { needsApi: plan.needsApi === true })
    );
    const results = found.map(decodeResult);
    const stage = record.stage(plan, results);
    const selected = plan.select(results, stage.reject);
    if (selected.length === 0) {
      logger.info(
        {
          matcher: plan.matcher,
          query: plan.query,
          results: results.length,
          withoutDuration: results.filter(({ duration }) => !(typeof duration === 'number' && duration > 0)).length,
        },
        'Sonarr/Radarr search found no match'
      );
      return [];
    }

    const ids = selected.map(({ candidate }) => candidate.youtubeId);
    const [failedIds, knownDates] = await Promise.all([recentlyFailedIds(ids), knownUploadDates(ids)]);
    const downloadResolution = settings.resolution ?? config.preferredResolution;
    const ceiling = labelFor({ realTier: null, downloadResolution, labelLimit: settings.labelLimit });
    const usedTitles = new Set();
    const items = [];
    // Keeps the selected candidates that pass, and records why the others do not.
    const keepOr = (reason, passes) => (entry) => {
      const kept = passes(entry);
      if (!kept) stage.reject(entry.candidate, reason);
      return kept;
    };
    let offerable = selected.filter(
      keepOr(REJECTION.FAILED_RECENTLY, ({ candidate }) => !failedIds.has(candidate.youtubeId))
    );
    // Re-uploads stay available for when the show's own upload fails a grab.
    const closest = plan.closestChannelOnly ? Math.max(0, ...offerable.map(({ channelRank }) => channelRank)) : 0;
    if (closest > 0) {
      offerable = offerable.filter(
        keepOr(REJECTION.NOT_CLOSEST_CHANNEL, ({ channelRank }) => channelRank === closest)
      );
    }
    const realTiers = await realResolutions(
      offerable.slice(0, request.limit).map(({ candidate }) => candidate),
      ceiling,
      startedAt
    );
    for (const { candidate, name } of offerable) {
      if (items.length === request.limit) {
        stage.reject(candidate, REJECTION.OVER_LIMIT);
        continue;
      }
      const resolution = labelFor({
        realTier: realTiers.get(candidate.youtubeId) ?? null, downloadResolution, labelLimit: settings.labelLimit,
      });
      const group = groupToken(candidate.channelName, request.kind);
      const title = plan.title(name, { resolution, group });
      // Two videos with one release title would share a staging folder.
      if (!title || usedTitles.has(title)) {
        stage.reject(candidate, title ? REJECTION.DUPLICATE_NAME : REJECTION.NO_RELEASE_NAME);
        continue;
      }
      usedTitles.add(title);
      stage.offer(candidate, title);
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
    const series = await catalog.resolveSeries({ text: request.text, textSource: request.textSource });
    return series?.runtimeSeconds ?? null;
  }

  async function answer(request, origin, record, startedAt) {
    if (request.shape === 'rss') {
      record.notSearched(NOTE.NO_QUERY);
      return [placeholderItem(request.kind === 'movie' ? 'movie' : 'tv', origin)];
    }

    const config = getConfig();
    const settings = readSettings(config);
    const context = { request, origin, config, settings, startedAt, record };
    // Requests that cannot be searched at all never ask Sonarr or Radarr.
    if (!planSearch(request, { settings, isYoutubeApiAvailable })) {
      if (request.shape === 'daily' && !isYoutubeApiAvailable()) {
        logger.info({ shape: 'daily' }, 'Sonarr/Radarr daily search skipped: the YouTube API is not available');
      }
      record.notSearched(notSearchedReason(request, isYoutubeApiAvailable));
      return [];
    }

    if (request.shape !== 'episode') {
      const runtimeSeconds = await knownRuntime(request);
      return runPlan(planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds }), context);
    }

    const episode = await catalog.resolveEpisode({
      text: request.text, textSource: request.textSource, season: request.season, episode: request.episode,
    });
    const titlePlan = canMatchByTitle(episode, settings) ? planEpisodeTitleSearch(request, episode, settings) : null;
    if (titlePlan) {
      const items = await runPlan(titlePlan, context);
      if (items.length > 0) return items;
    } else {
      record.skipTitleStage(titleStageSkipReason(episode, settings));
    }
    // Nothing by title (or its only match failed a grab lately): the search
    // by episode code still finds re-uploads named like releases.
    const runtimeSeconds = episode?.runtimeSeconds ?? null;
    return runPlan(planSearch(request, { settings, isYoutubeApiAvailable, runtimeSeconds }), context);
  }

  /**
   * @param {Object} request - From parseNewznabRequest (never the caps shape)
   * @param {string} origin - Scheme and host the client used, for the links
   * @returns {Promise<Array<Object>>} Feed items, best match first. Rejects
   *   with SearchUnavailableError when YouTube could not be searched.
   */
  async function search(request, origin) {
    const startedAt = now();
    const record = recentSearches.start(request, startedAt);
    try {
      const items = await answer(request, origin, record, startedAt);
      // The placeholder is no offer.
      record.answered(request.shape === 'rss' ? 0 : items.length);
      return items;
    } catch (error) {
      record.failed(error?.reason === 'hold-timeout' ? NOTE.SEARCH_HELD_TOO_LONG : NOTE.SEARCH_FAILED);
      throw error;
    }
  }

  return { search };
}

module.exports = {
  createSearchService, estimateBytes, decodeHtmlEntities, PLACEHOLDER_TITLES,
};
