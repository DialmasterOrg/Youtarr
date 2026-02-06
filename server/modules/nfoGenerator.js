const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * Generates an NFO file for a video
 * This is compatible with Jellyfin/Kodi/Emby
 */
class NfoGenerator {
  /**
   * Escapes special XML characters in text content
   * @param {string} text - Text to escape
   * @returns {string} XML-safe text
   */
  escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Converts YYYYMMDD date string to YYYY-MM-DD format
   * @param {string|number} dateStr - Date in YYYYMMDD format
   * @returns {string|null} Date in YYYY-MM-DD format or null if invalid
   */
  formatDate(dateStr) {
    if (!dateStr) return null;

    const str = String(dateStr);
    if (str.length !== 8) return null;

    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);

    // Validate the date
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isNaN(date.getTime())) return null;

    return `${year}-${month}-${day}`;
  }

  /**
   * Converts duration in seconds to minutes (rounded up)
   * @param {number} seconds - Duration in seconds
   * @returns {number} Duration in minutes
   */
  calculateRuntime(seconds) {
    if (!seconds || seconds <= 0) return 0;
    return Math.ceil(seconds / 60);
  }

  /**
   * Builds YouTube plugin URL for Kodi
   * @param {string} videoId - YouTube video ID
   * @returns {string} Plugin URL
   */
  buildYouTubeTrailerUrl(videoId) {
    if (!videoId) return '';
    return `plugin://plugin.video.youtube/?action=play_video&amp;videoid=${videoId}`;
  }

  /**
   * Generates and writes an NFO file for a video
   * @param {string} videoPath - Path to the video file
   * @param {object} jsonData - Parsed .info.json data
   * @returns {boolean} True if successful, false otherwise
   */
  writeVideoNfoFile(videoPath, jsonData) {
    logger.info({ videoPath }, 'Writing NFO file for video');
    try {
      // Generate NFO path (same as video but with .nfo extension)
      const parsedPath = path.parse(videoPath);
      const nfoPath = path.format({
        dir: parsedPath.dir,
        name: parsedPath.name,
        ext: '.nfo'
      });

      // Extract and prepare data
      const title = this.escapeXml(jsonData.fulltitle || jsonData.title || 'Unknown Title');
      const plot = this.escapeXml(jsonData.description || '');
      const youtubeId = jsonData.id || '';
      const premiered = this.formatDate(jsonData.upload_date);

      // Use uploader as primary, fall back to channel
      const studio = this.escapeXml(
        jsonData.uploader ||
        jsonData.channel ||
        jsonData.uploader_id ||
        jsonData.channel_id ||
        'Unknown Channel'
      );
      const credits = this.escapeXml(jsonData.uploader || '');

      // Runtime calculations
      const durationSeconds = jsonData.duration || 0;
      const runtimeMinutes = this.calculateRuntime(durationSeconds);

      // Build genre tags from categories
      const genres = (jsonData.categories || [])
        .map(cat => `  <genre>${this.escapeXml(cat)}</genre>`)
        .join('\n');

      // Build tag elements from tags array
      const tags = (jsonData.tags || [])
        .map(tag => `  <tag>${this.escapeXml(tag)}</tag>`)
        .join('\n');

      // Build the XML content
      let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      xml += '<movie>\n';
      xml += `  <title>${title}</title>\n`;

      if (plot) {
        xml += `  <plot>${plot}</plot>\n`;
      }

      xml += '\n  <!-- IDs -->\n';
      if (youtubeId) {
        xml += `  <uniqueid type="youtube" default="true">${youtubeId}</uniqueid>\n`;
        xml += `  <youtubeid>${youtubeId}</youtubeid>\n`;
      }

      if (premiered) {
        xml += '\n  <!-- Dates -->\n';
        xml += `  <premiered>${premiered}</premiered>\n`;
      }

      xml += '\n  <!-- People / orgs -->\n';
      xml += `  <studio>${studio}</studio>\n`;
      if (credits) {
        xml += `  <credits>${credits}</credits>\n`;
      }

      if (genres || tags) {
        xml += '\n  <!-- Classification -->\n';
        if (genres) {
          xml += genres + '\n';
        }
        if (tags) {
          xml += tags + '\n';
        }
      }

      // Add rating information if available
      if (jsonData.normalized_rating) {
        xml += '\n  <!-- Ratings -->\n';
        xml += `  <mpaa>${this.escapeXml(jsonData.normalized_rating)}</mpaa>\n`;
        xml += '  <ratings>\n';
        xml += `    <rating name="mpaa" max="10">${this.escapeXml(jsonData.normalized_rating)}</rating>\n`;
        if (jsonData.rating_source) {
          xml += `    <rating name="source">${this.escapeXml(jsonData.rating_source)}</rating>\n`;
        }
        xml += '  </ratings>\n';
      }

      if (durationSeconds > 0) {
        xml += '\n  <!-- Runtime -->\n';
        xml += `  <runtime>${runtimeMinutes}</runtime>\n`;
        xml += '  <fileinfo>\n';
        xml += '    <streamdetails>\n';
        xml += '      <video>\n';
        xml += `        <durationinseconds>${durationSeconds}</durationinseconds>\n`;
        xml += '      </video>\n';
        xml += '    </streamdetails>\n';
        xml += '  </fileinfo>\n';
      }

      if (youtubeId) {
        xml += '\n  <!-- Backlink to YouTube in Kodi format -->\n';
        xml += `  <trailer>${this.buildYouTubeTrailerUrl(youtubeId)}</trailer>\n`;
      }

      // Optional: Add channel as collection (commented out by default)
      // xml += `\n  <!-- Optional: group by channel -->\n`;
      // xml += `  <!-- <set>${studio}</set> -->\n`;

      xml += '</movie>\n';

      // Write the NFO file
      fs.writeFileSync(nfoPath, xml, 'utf8');
      logger.info({ nfoPath }, 'NFO file created successfully');

      return true;
    } catch (error) {
      logger.error({ err: error, videoPath }, 'Error creating NFO file');
      return false;
    }
  }
}

module.exports = new NfoGenerator();