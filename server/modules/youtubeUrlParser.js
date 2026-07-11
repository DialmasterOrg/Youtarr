/**
 * Pure YouTube URL parsing helpers. No side effects and no heavy
 * dependencies, so it is safe to require from any module or test.
 */

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

  const idPattern = /^[a-zA-Z0-9_-]{11}$/;

  if (hostname === 'youtu.be') {
    const candidate = pathSegments[0];
    if (candidate && idPattern.test(candidate)) {
      videoId = candidate;
    }
  } else if (isYoutubeDomain) {
    if (pathSegments[0] === 'watch') {
      const candidate = parsedUrl.searchParams.get('v');
      if (candidate && idPattern.test(candidate)) {
        videoId = candidate;
      }
    } else if (pathSegments[0] === 'shorts' || pathSegments[0] === 'embed' || pathSegments[0] === 'live') {
      const candidate = pathSegments[1];
      if (candidate && idPattern.test(candidate)) {
        videoId = candidate;
      }
    }
  }

  if (!videoId) {
    throw new Error('Invalid YouTube URL format');
  }

  return {
    id: videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`
  };
}

module.exports = { normalizeUrlToVideoId };
