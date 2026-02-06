const ytDlpRunner = require('./ytDlpRunner');
const archiveModule = require('./archiveModule');
const logger = require('../logger');

class VideoValidationModule {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
  }

  /**
   * Normalize a YouTube URL to extract video ID and canonical URL
   * @param {string} url - YouTube URL in various formats
   * @returns {Object} - { id: string, canonicalUrl: string }
   * @throws {Error} - If URL is not a valid YouTube video URL
   */
  normalizeUrlToVideoId(url) {
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

  /**
   * Fetch video metadata using yt-dlp
   * @param {string} url - YouTube URL
   * @param {Object} options - Options including timeoutMs
   * @returns {Promise<Object>} - Video metadata
   */
  async fetchVideoMetadata(url, options = {}) {
    const { timeoutMs = 60000 } = options;

    try {
      const metadata = await ytDlpRunner.fetchMetadata(url, timeoutMs);
      return metadata;
    } catch (error) {
      logger.error({ err: error, url }, 'Error fetching video metadata');
      throw error;
    }
  }

  /**
   * Check if a video has already been downloaded
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<boolean>} - True if already downloaded
   */
  async isDuplicate(videoId) {
    try {
      const isInArchive = await archiveModule.isVideoInArchive(videoId);
      return isInArchive;
    } catch (error) {
      logger.warn({ err: error, videoId }, 'Error checking archive, assuming video is not duplicate');
      return false;
    }
  }

  /**
   * Convert metadata to validation response format
   * @param {string} videoId - YouTube video ID
   * @param {Object} metadata - yt-dlp metadata
   * @param {boolean} isDuplicate - Whether video is already downloaded
   * @returns {Object} - Formatted response
   */
  toValidationResponse(videoId, metadata, isDuplicate) {
    const isMembersOnly = metadata.availability === 'subscriber_only';

    const contentRating = metadata.contentRating || metadata.content_rating || null;
    const ageLimit = metadata.age_limit || null;

    return {
      isValidUrl: true,
      isAlreadyDownloaded: isDuplicate,
      isMembersOnly: isMembersOnly,
      metadata: {
        youtubeId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        channelName: metadata.channel || metadata.uploader || 'Unknown',
        videoTitle: metadata.title || 'Unknown',
        duration: metadata.duration || 0,
        publishedAt: metadata.upload_date ?
          Math.floor(new Date(
            metadata.upload_date.substring(0, 4) + '-' +
            metadata.upload_date.substring(4, 6) + '-' +
            metadata.upload_date.substring(6, 8)
          ).getTime() / 1000) :
          null,
        availability: metadata.availability || 'public',
        media_type: metadata.media_type || 'video',
        content_rating: contentRating,
        age_limit: ageLimit,
      }
    };
  }

  /**
   * Get cached response if available and not expired
   * @param {string} videoId - YouTube video ID
   * @returns {Object|null} - Cached response or null
   */
  getCachedResponse(videoId) {
    const cached = this.cache.get(videoId);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.cacheTTL) {
        return cached.data;
      } else {
        this.cache.delete(videoId);
      }
    }
    return null;
  }

  /**
   * Cache a response
   * @param {string} videoId - YouTube video ID
   * @param {Object} response - Response to cache
   */
  setCachedResponse(videoId, response) {
    this.cache.set(videoId, {
      data: response,
      timestamp: Date.now()
    });

    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * Remove expired entries from cache
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if a YouTube video exists using the oEmbed API
   * @param {string} youtubeId - YouTube video ID (11 characters)
   * @returns {Promise<boolean>} - True if video exists, false otherwise
   */
  async checkVideoExistsOnYoutube(youtubeId) {
    logger.debug({ youtubeId }, 'Checking if video exists on YouTube');
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;

      const response = await fetch(oEmbedUrl, {
        method: 'HEAD',
        redirect: 'follow'
      });

      // If status is not 404, video exists
      // 403 means private and inaccessible
      return response.status !== 404 && response.status !== 403;
    } catch (error) {
      logger.warn({ err: error, youtubeId }, 'Error checking if video exists on YouTube, assuming video exists');
      // If there's a network error or other issue, assume video exists
      return true;
    }
  }

  /**
   * Main validation function
   * @param {string} url - YouTube URL to validate
   * @returns {Promise<Object>} - Validation response
   */
  async validateVideo(url) {
    let videoId = null;
    let canonicalUrl = null;

    try {
      const normalized = this.normalizeUrlToVideoId(url);
      videoId = normalized.id;
      canonicalUrl = normalized.canonicalUrl;

      const cachedResponse = this.getCachedResponse(videoId);
      if (cachedResponse) {
        logger.debug({ videoId }, 'Using cached response for video, checking current archive status');
        // Always check the current archive status, even for cached responses
        const currentDuplicateStatus = await this.isDuplicate(videoId);
        cachedResponse.isAlreadyDownloaded = currentDuplicateStatus;
        if (cachedResponse.metadata && !cachedResponse.metadata.media_type) {
          cachedResponse.metadata.media_type = 'video';
        }
        // Update the cache with the current status
        this.setCachedResponse(videoId, cachedResponse);
        return cachedResponse;
      }

      logger.debug({ videoId }, 'Fetching metadata for video');
      const metadata = await this.fetchVideoMetadata(canonicalUrl, { timeoutMs: 60000 });

      const isDuplicateVideo = await this.isDuplicate(videoId);

      const response = this.toValidationResponse(videoId, metadata, isDuplicateVideo);

      if (response.metadata && !response.metadata.media_type) {
        response.metadata.media_type = 'video';
      }

      this.setCachedResponse(videoId, response);

      return response;
    } catch (error) {
      // Check for bot detection error
      if (error.code === 'COOKIES_REQUIRED' ||
          error.message.includes('Bot detection encountered')) {
        return {
          isValidUrl: false,
          error: 'Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.',
          errorCode: 'COOKIES_REQUIRED'
        };
      }
      // Check for members-only video error
      else if (error.message.includes('members-only') ||
          error.message.includes('Join this channel to get access')) {
        // Extract video ID from error message if possible, or use the one we parsed from URL
        const videoIdMatch = error.message.match(/\[youtube\]\s+([a-zA-Z0-9_-]{11}):/);
        const extractedVideoId = videoIdMatch ? videoIdMatch[1] : videoId;

        // Return a valid response indicating it's members-only
        return {
          isValidUrl: true,
          isAlreadyDownloaded: false,
          isMembersOnly: true,
          metadata: {
            youtubeId: extractedVideoId,
            url: `https://www.youtube.com/watch?v=${extractedVideoId}`,
            channelName: 'Unknown',
            videoTitle: 'Members-only video',
            duration: 0,
            publishedAt: null,
            availability: 'subscriber_only',
            media_type: 'video'
          }
        };
      } else if (error.message.includes('Invalid YouTube URL')) {
        return {
          isValidUrl: false,
          error: 'Invalid YouTube URL format'
        };
      } else if (error.message.includes('timed out')) {
        return {
          isValidUrl: false,
          error: 'Request timed out. Please try again.'
        };
      } else if (error.message.includes('Video unavailable')) {
        return {
          isValidUrl: false,
          error: 'Video is unavailable or has been removed'
        };
      } else {
        return {
          isValidUrl: false,
          error: error.message || 'Failed to validate video'
        };
      }
    }
  }
}

module.exports = new VideoValidationModule();
