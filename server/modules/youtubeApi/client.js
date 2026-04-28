const axios = require('axios');
const logger = require('../../logger');
const quotaTracker = require('./quotaTracker');
const { classifyYoutubeApiError, YoutubeApiErrorCode } = require('./errorClassifier');
const { parseIso8601Duration } = require('./durationParser');
const {
  YOUTUBE_API_BASE_URL,
  YOUTUBE_API_TIMEOUT_MS,
  ENDPOINTS,
  VIDEOS_LIST_BATCH_SIZE,
} = require('./constants');

// Reference video for key validation: a permanently public, well-known video.
const TEST_VIDEO_ID = 'dQw4w9WgXcQ';

// searchVideos filters client-side to approximate yt-dlp's ytsearch behavior,
// which uses YouTube's "Videos" result filter and excludes Shorts/live streams.
// The Data API has no equivalent query-side filter, so:
//   - We always request the API's max page size (cost is flat at 100 units
//     regardless of maxResults), giving headroom to drop Shorts/live and still
//     satisfy the caller's requested count.
//   - Live/upcoming broadcasts are identified by snippet.liveBroadcastContent
//     on the raw search response, so this filter applies even if enrichment fails.
//   - Shorts are identified by duration strictly under 60s. Past-livestreams
//     return 'none' in liveBroadcastContent and will pass through.
const SEARCH_LIST_MAX_RESULTS = 50;
const SEARCH_MIN_DURATION_SECONDS = 60;

// Per-tab auto-generated playlist prefixes. UU is all uploads combined;
// UULF/UUSH/UULV are the same content partitioned by media type and correspond
// exactly to the Videos/Shorts/Live tabs on the channel page. Undocumented by
// Google but stable for years and used by the codebase's RSS feed path as well
// (see server/modules/channelModule.js buildRssFeedUrl).
const TAB_PLAYLIST_PREFIX = {
  videos: 'UULF',
  shorts: 'UUSH',
  streams: 'UULV',
};

// YouTube channel IDs are always exactly 24 chars: "UC" + 22 base64url-ish chars.
// Validating the full shape up-front catches typos/corrupt data before we construct
// a bogus playlist ID and hit the API for nothing.
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

function derivePlaylistIdForTab(channelId, tabType) {
  const prefix = TAB_PLAYLIST_PREFIX[tabType];
  if (!prefix) {
    // Programmer error, not a YouTube API issue. Surface as a real error.
    throw new Error(`Unsupported tabType for API playlist derivation: ${tabType}`);
  }
  if (typeof channelId !== 'string' || !CHANNEL_ID_PATTERN.test(channelId)) {
    // Legacy/topic channels can have non-UC IDs; the API path can't handle
    // them. Log at debug so callers can fall back to yt-dlp without flooding
    // the warn channel on every refresh.
    logger.debug(
      { channelId, tabType },
      'Channel ID does not match expected UC[22] shape, API path will be skipped'
    );
    throw new YoutubeApiError(
      YoutubeApiErrorCode.INVALID_CHANNEL_ID,
      new Error(`Unexpected channel ID shape: ${channelId}`)
    );
  }
  return `${prefix}${channelId.slice(2)}`;
}

class YoutubeApiError extends Error {
  constructor(code, cause) {
    super(`YouTube API error: ${code}`);
    this.name = 'YoutubeApiError';
    this.code = code;
    this.cause = cause;
  }
}

function buildUrl(endpoint) {
  return `${YOUTUBE_API_BASE_URL}${endpoint}`;
}

async function apiGet(apiKey, endpoint, extraParams, { signal } = {}) {
  if (quotaTracker.isInCooldown(apiKey)) {
    throw new YoutubeApiError(YoutubeApiErrorCode.QUOTA_EXCEEDED);
  }

  try {
    const response = await axios.get(buildUrl(endpoint), {
      params: { key: apiKey, ...extraParams },
      timeout: YOUTUBE_API_TIMEOUT_MS,
      signal,
    });
    return response.data;
  } catch (err) {
    const code = classifyYoutubeApiError(err);
    if (code === YoutubeApiErrorCode.QUOTA_EXCEEDED) {
      quotaTracker.markExhausted(apiKey);
    }
    throw new YoutubeApiError(code, err);
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizeUploadDate(publishedAt) {
  // publishedAt is RFC3339 (ISO 8601). yt-dlp-style is YYYYMMDD.
  if (!publishedAt || typeof publishedAt !== 'string') return null;
  const match = publishedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function normalizeVideoItem(item) {
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const statistics = item.statistics || {};
  const status = item.status || {};

  const parseIntOrNull = (v) => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: item.id,
    title: snippet.title || null,
    description: snippet.description || null,
    duration: parseIso8601Duration(contentDetails.duration),
    viewCount: parseIntOrNull(statistics.viewCount),
    likeCount: parseIntOrNull(statistics.likeCount),
    commentCount: parseIntOrNull(statistics.commentCount),
    uploadDate: normalizeUploadDate(snippet.publishedAt),
    channelId: snippet.channelId || null,
    channelTitle: snippet.channelTitle || null,
    tags: Array.isArray(snippet.tags) ? snippet.tags : null,
    categories: snippet.categoryId ? [snippet.categoryId] : null,
    contentRating: contentDetails.contentRating || null,
    availability: status.privacyStatus || 'public',
    liveBroadcastContent: snippet.liveBroadcastContent || null,
    thumbnailUrl: snippet.thumbnails?.maxres?.url
      || snippet.thumbnails?.high?.url
      || snippet.thumbnails?.default?.url
      || null,
  };
}

async function testKey(apiKey) {
  try {
    await apiGet(apiKey, ENDPOINTS.videos, { id: TEST_VIDEO_ID, part: 'id' });
    return { ok: true };
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return { ok: false, code: err.code };
    }
    logger.error({ err }, 'Unexpected error in YouTube API testKey');
    return { ok: false, code: YoutubeApiErrorCode.UNKNOWN };
  }
}

async function getVideoMetadata(apiKey, videoIds, { signal } = {}) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) return [];

  const parts = 'snippet,contentDetails,statistics,status';
  const batches = chunk(videoIds, VIDEOS_LIST_BATCH_SIZE);
  const items = [];

  for (const batch of batches) {
    const data = await apiGet(
      apiKey,
      ENDPOINTS.videos,
      {
        id: batch.join(','),
        part: parts,
      },
      { signal }
    );
    if (Array.isArray(data.items)) items.push(...data.items);
  }

  return items.map(normalizeVideoItem);
}

/**
 * Parse a YouTube channel URL into API-friendly selector params.
 * Returns { forHandle } | { id } | { forUsername } or throws if unrecognized.
 */
function parseChannelUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Unrecognized YouTube channel URL: ${url}`);
  }

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const first = pathSegments[0];

  if (first && first.startsWith('@')) {
    return { forHandle: first };
  }
  if (first === 'channel' && pathSegments[1]) {
    return { id: pathSegments[1] };
  }
  if ((first === 'user' || first === 'c') && pathSegments[1]) {
    return { forUsername: pathSegments[1] };
  }
  throw new Error(`Unrecognized YouTube channel URL: ${url}`);
}

async function getChannelInfo(apiKey, channelUrl, { signal } = {}) {
  const selector = parseChannelUrl(channelUrl);
  const data = await apiGet(
    apiKey,
    ENDPOINTS.channels,
    {
      ...selector,
      part: 'snippet,contentDetails,statistics',
    },
    { signal }
  );

  if (!Array.isArray(data.items) || data.items.length === 0) return null;
  const item = data.items[0];
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const statistics = item.statistics || {};

  // videoCount is a stringified integer; can be null when the channel owner
  // has hidden their public video count display.
  let videoCount = null;
  if (statistics.videoCount !== undefined && statistics.videoCount !== null) {
    const n = Number(statistics.videoCount);
    if (Number.isFinite(n)) videoCount = n;
  }

  return {
    channelId: item.id,
    title: snippet.title || null,
    description: snippet.description || null,
    customUrl: snippet.customUrl || null,
    uploadsPlaylistId: contentDetails.relatedPlaylists?.uploads || null,
    videoCount,
    thumbnailUrl: snippet.thumbnails?.high?.url
      || snippet.thumbnails?.default?.url
      || null,
  };
}

async function searchVideos(apiKey, query, maxResults, { signal } = {}) {
  const data = await apiGet(
    apiKey,
    ENDPOINTS.search,
    {
      q: query,
      type: 'video',
      part: 'snippet',
      maxResults: SEARCH_LIST_MAX_RESULTS,
    },
    { signal }
  );

  if (!Array.isArray(data.items)) return [];

  const baseResults = data.items
    .filter((item) => item?.id?.kind === 'youtube#video' && item?.id?.videoId)
    .filter((item) => {
      const live = item?.snippet?.liveBroadcastContent;
      return live !== 'live' && live !== 'upcoming';
    })
    .map((item) => {
      const snippet = item.snippet || {};
      return {
        youtubeId: item.id.videoId,
        title: snippet.title || '',
        channelId: snippet.channelId || null,
        channelName: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt).toISOString() : null,
        thumbnailUrl: snippet.thumbnails?.high?.url
          || snippet.thumbnails?.medium?.url
          || snippet.thumbnails?.default?.url
          || null,
        duration: null,
        viewCount: null,
        status: 'never_downloaded',
      };
    });

  if (baseResults.length === 0) return baseResults;

  // search.list returns snippet only - duration and view count are not in it.
  // A follow-up videos.list batch (1 unit per 50 IDs, vs the 100-unit search
  // call above) fills them in so result cards and the VideoModal can render
  // duration, and lets us drop Shorts by duration. If enrichment fails, fall
  // back to the pre-enrichment results (which have already had live/upcoming
  // filtered out) rather than failing the whole search.
  try {
    const videoIds = baseResults.map((r) => r.youtubeId);
    const metadata = await getVideoMetadata(apiKey, videoIds, { signal });
    const byId = new Map(metadata.map((m) => [m.id, m]));
    const enriched = baseResults.map((r) => {
      const m = byId.get(r.youtubeId);
      if (!m) return r;
      return { ...r, duration: m.duration ?? null, viewCount: m.viewCount ?? null };
    });
    // Keep videos with unknown duration (enrichment gap) so a missing item
    // never silently disappears; drop only videos we know are Shorts.
    const filtered = enriched.filter(
      (r) => r.duration === null || r.duration >= SEARCH_MIN_DURATION_SECONDS
    );
    return filtered.slice(0, maxResults);
  } catch (err) {
    if (err && err.code === YoutubeApiErrorCode.CANCELED) {
      throw err;
    }
    logger.warn({ err, code: err?.code }, 'YouTube API searchVideos metadata enrichment failed');
    return baseResults.slice(0, maxResults);
  }
}

/**
 * Probe all three channel-tab playlists in parallel. A non-empty response
 * means the tab effectively has content. An empty items array OR a 404
 * NOT_FOUND error means the channel does not surface that tab.
 *
 * Uses playlistItems.list with part=id and maxResults=1 - 1 unit per probe,
 * 3 units total. Returns partial results on a per-probe NOT_FOUND, but any
 * other failure (quota, invalid key, network) propagates so the caller can
 * fall back to yt-dlp - one failed probe means the whole detection is
 * untrustworthy, since we would be reporting false negatives for the other
 * tabs too.
 *
 * Throws only if getChannelInfo fails (channel URL not resolvable).
 *
 * @param {string} apiKey
 * @param {string} channelUrl
 * @returns {Promise<{ availableTabs: string[], channelInfo: object|null }>}
 */
async function detectAvailableTabs(apiKey, channelUrl) {
  const channelInfo = await getChannelInfo(apiKey, channelUrl);
  if (!channelInfo || !channelInfo.channelId) {
    return { availableTabs: [], channelInfo: null };
  }

  const tabTypes = ['videos', 'shorts', 'streams'];
  const probes = await Promise.all(tabTypes.map(async (tabType) => {
    try {
      const playlistId = derivePlaylistIdForTab(channelInfo.channelId, tabType);
      const data = await apiGet(apiKey, ENDPOINTS.playlistItems, {
        playlistId,
        part: 'id',
        maxResults: 1,
      });
      const hasContent = Array.isArray(data.items) && data.items.length > 0;
      return hasContent ? tabType : null;
    } catch (err) {
      if (err && err.code === YoutubeApiErrorCode.NOT_FOUND) {
        return null;
      }
      throw err;
    }
  }));

  const availableTabs = probes.filter(Boolean);
  return { availableTabs, channelInfo };
}

module.exports = {
  testKey,
  getVideoMetadata,
  getChannelInfo,
  searchVideos,
  detectAvailableTabs,
  YoutubeApiError,
};
