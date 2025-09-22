const fs = require('fs-extra');
const path = require('path');

class NFOGeneratorModule {
  /**
   * Generate an episode NFO file
   * @param {Object} data - Episode data
   * @param {string} data.title - Episode title
   * @param {number} data.season - Season number
   * @param {number} data.episode - Episode number
   * @param {string} data.plot - Episode description/plot
   * @param {string} data.aired - Aired date (YYYY-MM-DD format)
   * @param {string} data.studio - Studio/channel name
   * @param {string} data.uniqueId - Unique identifier (YouTube ID)
   * @param {string} data.thumb - Thumbnail filename (optional)
   * @returns {string} NFO XML content
   */
  generateEpisodeNFO(data) {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<episodedetails>
    <title>${this.escapeXML(data.title || '')}</title>
    <season>${data.season || 1}</season>
    <episode>${data.episode || 1}</episode>
    <plot>${this.escapeXML(data.plot || '')}</plot>
    <aired>${data.aired || ''}</aired>
    <premiered>${data.aired || ''}</premiered>
    <studio>${this.escapeXML(data.studio || '')}</studio>
    <uniqueid type="youtube" default="true">${data.uniqueId || ''}</uniqueid>${data.thumb ? `
    <thumb>${this.escapeXML(data.thumb)}</thumb>` : ''}
</episodedetails>`;

    return xmlContent;
  }

  /**
   * Generate a TV show NFO file
   * @param {Object} data - TV show data
   * @param {string} data.title - Series title
   * @param {string} data.plot - Series description
   * @param {string} data.studio - Studio/channel name
   * @param {string} data.premiered - First episode date
   * @param {string} data.status - Show status (Continuing/Ended)
   * @param {string} data.uniqueId - Channel ID
   * @returns {string} NFO XML content
   */
  generateTVShowNFO(data) {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<tvshow>
    <title>${this.escapeXML(data.title || '')}</title>
    <plot>${this.escapeXML(data.plot || '')}</plot>
    <studio>${this.escapeXML(data.studio || '')}</studio>
    <premiered>${data.premiered || ''}</premiered>
    <status>${data.status || 'Continuing'}</status>
    <uniqueid type="youtube_channel">${data.uniqueId || ''}</uniqueid>
</tvshow>`;

    return xmlContent;
  }

  /**
   * Write an episode NFO file to disk
   * @param {string} filePath - Path to save the NFO file (without extension)
   * @param {Object} episodeData - Episode data
   * @returns {Promise<string>} Path to created NFO file
   */
  async writeEpisodeNFO(filePath, episodeData) {
    try {
      const nfoPath = `${filePath}.nfo`;
      const nfoContent = this.generateEpisodeNFO(episodeData);

      await fs.writeFile(nfoPath, nfoContent, 'utf8');
      return nfoPath;
    } catch (error) {
      console.error('Error writing episode NFO:', error);
      throw error;
    }
  }

  /**
   * Write a TV show NFO file to disk
   * @param {string} seriesPath - Path to series directory
   * @param {Object} showData - TV show data
   * @returns {Promise<string>} Path to created NFO file
   */
  async writeTVShowNFO(seriesPath, showData) {
    try {
      const nfoPath = path.join(seriesPath, 'tvshow.nfo');
      const nfoContent = this.generateTVShowNFO(showData);

      await fs.writeFile(nfoPath, nfoContent, 'utf8');
      return nfoPath;
    } catch (error) {
      console.error('Error writing TV show NFO:', error);
      throw error;
    }
  }

  /**
   * Check if a TV show NFO already exists
   * @param {string} seriesPath - Path to series directory
   * @returns {Promise<boolean>} True if tvshow.nfo exists
   */
  async tvShowNFOExists(seriesPath) {
    try {
      const nfoPath = path.join(seriesPath, 'tvshow.nfo');
      return await fs.pathExists(nfoPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create NFO files for a processed video
   * @param {Object} options - NFO creation options
   * @param {string} options.videoPath - Full path to video file (without extension)
   * @param {string} options.seriesPath - Path to series directory
   * @param {Object} options.videoData - Video metadata
   * @param {Object} options.profileData - Profile configuration
   * @param {number} options.season - Season number
   * @param {number} options.episode - Episode number
   * @returns {Promise<Object>} Paths to created NFO files
   */
  async createNFOFiles(options) {
    const results = {
      episodeNFO: null,
      tvshowNFO: null
    };

    try {
      // Format the aired date
      let airedDate = '';
      if (options.videoData.originalDate) {
        const dateStr = options.videoData.originalDate.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        airedDate = `${year}-${month}-${day}`;
      }

      // Create episode NFO
      const episodeData = {
        title: options.videoData.title || options.videoData.youTubeVideoName,
        season: options.season,
        episode: options.episode,
        plot: options.videoData.description || '',
        aired: airedDate,
        studio: options.videoData.youTubeChannelName || '',
        uniqueId: options.videoData.youtubeId || '',
        thumb: path.basename(options.videoPath) + '.jpg'
      };

      results.episodeNFO = await this.writeEpisodeNFO(options.videoPath, episodeData);

      // Create TV show NFO if it doesn't exist
      const tvshowExists = await this.tvShowNFOExists(options.seriesPath);
      if (!tvshowExists) {
        const showData = {
          title: options.profileData.profile_name,
          plot: `YouTube series from ${options.videoData.youTubeChannelName}`,
          studio: options.videoData.youTubeChannelName || '',
          premiered: airedDate,
          status: 'Continuing',
          uniqueId: options.videoData.channel_id || ''
        };

        results.tvshowNFO = await this.writeTVShowNFO(options.seriesPath, showData);
      }

      return results;
    } catch (error) {
      console.error('Error creating NFO files:', error);
      throw error;
    }
  }

  /**
   * Escape special XML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeXML(text) {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse upload date to YYYY-MM-DD format
   * @param {string} uploadDate - Upload date in YYYYMMDD format
   * @returns {string} Formatted date YYYY-MM-DD
   */
  formatUploadDate(uploadDate) {
    if (!uploadDate || uploadDate.length !== 8) {
      return '';
    }

    const year = uploadDate.substring(0, 4);
    const month = uploadDate.substring(4, 6);
    const day = uploadDate.substring(6, 8);

    return `${year}-${month}-${day}`;
  }
}

module.exports = new NFOGeneratorModule();