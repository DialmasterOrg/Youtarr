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
  PLAYLIST_ITEMS_PAGE_SIZE,
} = require('./constants');

// Reference video for key validation: the first YouTube video, permanently public.
const TEST_VIDEO_ID = 'dQw4w9WgXcQ';

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

async function apiGet(apiKey, endpoint, extraParams) {
  if (quotaTracker.isInCooldown()) {
    throw new YoutubeApiError(YoutubeApiErrorCode.QUOTA_EXCEEDED);
  }

  try {
    const response = await axios.get(buildUrl(endpoint), {
      params: { key: apiKey, ...extraParams },
      timeout: YOUTUBE_API_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    const code = classifyYoutubeApiError(err);
    if (code === YoutubeApiErrorCode.QUOTA_EXCEEDED) {
      quotaTracker.markExhausted();
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

async function getVideoMetadata(apiKey, videoIds) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) return [];

  const parts = 'snippet,contentDetails,statistics,status';
  const batches = chunk(videoIds, VIDEOS_LIST_BATCH_SIZE);
  const items = [];

  for (const batch of batches) {
    const data = await apiGet(apiKey, ENDPOINTS.videos, {
      id: batch.join(','),
      part: parts,
    });
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

async function getChannelInfo(apiKey, channelUrl) {
  const selector = parseChannelUrl(channelUrl);
  const data = await apiGet(apiKey, ENDPOINTS.channels, {
    ...selector,
    part: 'snippet,contentDetails',
  });

  if (!Array.isArray(data.items) || data.items.length === 0) return null;
  const item = data.items[0];
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};

  return {
    channelId: item.id,
    title: snippet.title || null,
    description: snippet.description || null,
    customUrl: snippet.customUrl || null,
    uploadsPlaylistId: contentDetails.relatedPlaylists?.uploads || null,
    thumbnailUrl: snippet.thumbnails?.high?.url
      || snippet.thumbnails?.default?.url
      || null,
  };
}

async function searchVideos(apiKey, query, maxResults) {
  const data = await apiGet(apiKey, ENDPOINTS.search, {
    q: query,
    type: 'video',
    part: 'snippet',
    maxResults,
  });

  if (!Array.isArray(data.items)) return [];

  return data.items
    .filter((item) => item?.id?.kind === 'youtube#video' && item?.id?.videoId)
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
}

async function listPlaylistItems(apiKey, playlistId, maxVideos) {
  const videoIds = [];
  const playlistItemsLight = [];
  let pageToken = null;

  while (videoIds.length < maxVideos) {
    const remaining = maxVideos - videoIds.length;
    const pageSize = Math.min(PLAYLIST_ITEMS_PAGE_SIZE, remaining);

    const params = {
      playlistId,
      part: 'snippet',
      maxResults: pageSize,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await apiGet(apiKey, ENDPOINTS.playlistItems, params);

    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      const vid = item?.snippet?.resourceId?.videoId;
      if (!vid) continue;
      videoIds.push(vid);
      playlistItemsLight.push({
        id: vid,
        title: item.snippet.title || null,
        publishedAt: item.snippet.publishedAt || null,
      });
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  return { videoIds, playlistItemsLight };
}

async function listChannelVideos(apiKey, channelUrl, { maxVideos = 200, includeMetadata = true } = {}) {
  const channelInfo = await getChannelInfo(apiKey, channelUrl);
  if (!channelInfo || !channelInfo.uploadsPlaylistId) {
    return { videos: [], currentChannelUrl: channelUrl };
  }

  const { videoIds, playlistItemsLight } = await listPlaylistItems(
    apiKey,
    channelInfo.uploadsPlaylistId,
    maxVideos
  );

  let videos;
  if (includeMetadata && videoIds.length > 0) {
    const metadataBatches = await getVideoMetadata(apiKey, videoIds);
    const byId = new Map(metadataBatches.map((m) => [m.id, m]));
    videos = playlistItemsLight.map((light) => byId.get(light.id) || light);
  } else {
    videos = playlistItemsLight;
  }

  return { videos, currentChannelUrl: channelUrl, channelInfo };
}

module.exports = {
  testKey,
  getVideoMetadata,
  getChannelInfo,
  searchVideos,
  listChannelVideos,
  YoutubeApiError,
};
