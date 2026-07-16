const logger = require('../../logger');
const ratingMapper = require('../ratingMapper');

class VideoEntryParser {
  /**
   * Extract published date from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @returns {string} - ISO date string
   */
  extractPublishedDate(entry) {
    if (entry.timestamp) {
      return new Date(entry.timestamp * 1000).toISOString();
    }
    if (entry.upload_date) {
      const year = entry.upload_date.substring(0, 4);
      const month = entry.upload_date.substring(4, 6);
      const day = entry.upload_date.substring(6, 8);
      return new Date(`${year}-${month}-${day}`).toISOString();
    }
    if (entry.release_timestamp) {
      return new Date(entry.release_timestamp * 1000).toISOString();
    }
    return null;
  }

  /**
   * Extract thumbnail URL from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @returns {string} - Thumbnail URL
   */
  extractThumbnailUrl(entry) {
    if (entry.thumbnail) {
      return entry.thumbnail;
    }
    if (entry.thumbnails && Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
      const mediumThumb = entry.thumbnails.find(t => t.id === 'medium' || t.id === '3');
      return mediumThumb ? mediumThumb.url : entry.thumbnails[entry.thumbnails.length - 1].url;
    }
    if (entry.id) {
      return `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`;
    }
    return '';
  }

  /**
   * Parse video metadata from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @param {string|null} defaultRating - Default rating from channel settings
   * @returns {Object} - Parsed video object
   */
  parseVideoMetadata(entry, defaultRating = null) {
    const contentRating = entry.contentRating || entry.content_rating || null;
    const ageLimit = entry.age_limit ?? null;

    // Utilize centralized rating mapper to determine effective rating (Manual Override not applicable here)
    // Ensure content_rating and age_limit keys are present in normalized form so ratingMapper can read them
    const normalizedEntry = Object.assign({}, entry, {
      content_rating: contentRating,
      age_limit: ageLimit
    });
    const effectiveRating = ratingMapper.determineEffectiveRating(normalizedEntry, defaultRating);

    const out = {
      title: entry.title || 'Untitled',
      youtube_id: entry.id,
      publishedAt: this.extractPublishedDate(entry),
      thumbnail: this.extractThumbnailUrl(entry),
      duration: entry.duration || 0,
      availability: entry.availability || null,
      media_type: entry.media_type || 'video',
      live_status: entry.live_status || null,
    };

    if (contentRating != null) out.content_rating = contentRating;
    if (ageLimit != null) out.age_limit = ageLimit;

    if (effectiveRating.normalized_rating != null) {
      out.normalized_rating = effectiveRating.normalized_rating;
    }

    if (effectiveRating.rating_source != null) {
      out.rating_source = effectiveRating.rating_source;
    }

    return out;
  }

  /**
   * Extract video entries from yt-dlp JSON response.
   * @param {Object} jsonOutput - Parsed JSON from yt-dlp
   * @param {string|null} defaultRating - Default rating from channel
   * @returns {Array} - Array of parsed video metadata objects
   */
  extractVideosFromYtDlpResponse(jsonOutput, defaultRating = null) {
    const videos = [];

    if (!jsonOutput.entries || !Array.isArray(jsonOutput.entries)) {
      logger.warn('No entries found in yt-dlp JSON response');
      return videos;
    }

    const entries = jsonOutput.entries;

    // Since we're fetching directly from a specific tab, we should get video entries directly
    for (const entry of entries) {
      if (!entry) continue;

      // Skip playlist entries (shouldn't happen when fetching specific tabs)
      if (entry._type === 'playlist') {
        logger.warn('Unexpected playlist entry found when fetching specific tab');
        continue;
      }

      // Parse and add the video metadata
      videos.push(this.parseVideoMetadata(entry, defaultRating));
    }

    return videos;
  }
}

module.exports = new VideoEntryParser();
