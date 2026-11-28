/**
 * Pure YouTube URL parsing helpers. No side effects and no heavy
 * dependencies, so it is safe to require from any module or test.
 */
const { VIDEO_ID_PATTERN, buildWatchUrl } = require('./constants/youtube');

/**
 * Normalize a YouTube URL to extract video ID and canonical URL
 * @param {string} url - YouTube URL in various formats
 * @returns {Object} - { id: string, canonicalUrl: string }
 * @throws {Error} - If URL is not a valid YouTube video URL
 */
function normalizeUrlToVideoId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided');
  }

  let trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    trimmedUrl = `https://${trimmedUrl}`;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch (error) {
    throw new Error('Invalid YouTube URL format');
  }

  const hostname = parsedUrl.hostname.replace(/^www\./i, '');
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  let videoId = null;

  const isYoutubeDomain = (
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com'
  );

  if (hostname === 'youtu.be') {
    const candidate = pathSegments[0];
    if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
      videoId = candidate;
    }
  } else if (isYoutubeDomain) {
    if (pathSegments[0] === 'watch') {
      const candidate = parsedUrl.searchParams.get('v');
      if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
        videoId = candidate;
      }
    } else if (pathSegments[0] === 'shorts' || pathSegments[0] === 'embed' || pathSegments[0] === 'live') {
      const candidate = pathSegments[1];
      if (candidate && VIDEO_ID_PATTERN.test(candidate)) {
        videoId = candidate;
      }
    }
  }

  if (!videoId) {
    throw new Error('Invalid YouTube URL format');
  }

  return {
    id: videoId,
    canonicalUrl: buildWatchUrl(videoId)
  };
}

// Named one by one: yt-dlp follows the `continue` parameter of a
// consent.youtube.com URL to any address, so "any subdomain" is not safe.
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * Parse user input as a YouTube URL (a host in YOUTUBE_HOSTS). Input without
 * a scheme gets https://, as yt-dlp would assume.
 * @param {unknown} input
 * @returns {string|null} - The normalized URL, or null when it is not YouTube
 */
function toYoutubeUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const trimmed = input.trim();
  let parsed;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch (error) {
    return null;
  }
  // A trailing dot is the same host; yt-dlp only knows the name without it.
  if (parsed.hostname.endsWith('.')) parsed.hostname = parsed.hostname.slice(0, -1);
  const isYoutubeHost = YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  if (!['http:', 'https:'].includes(parsed.protocol) || !isYoutubeHost) return null;
  return parsed.href;
}

module.exports = { normalizeUrlToVideoId, toYoutubeUrl };
