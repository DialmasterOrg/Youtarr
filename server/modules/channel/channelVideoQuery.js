const ChannelVideo = require('../../models/channelvideo');
const watchStatusQueries = require('../mediaServers/watchStatusQueries');
const fileCheckModule = require('../fileCheckModule');
const { PUBLISHED_AT_SOURCE } = require('../constants/publishedAtSource');

class ChannelVideoQuery {
  /**
   * Enrich videos with download status by checking Videos table and file existence
   * @param {Array} videos - Array of video objects
   * @param {boolean} checkFiles - Whether to check file existence for current page (default false)
   * @returns {Promise<Array>} - Videos with 'added' and 'removed' properties
   */
  async enrichVideosWithDownloadStatus(videos, checkFiles = false) {
    const Video = require('../../models/video');
    const { sequelize, Sequelize } = require('../../db');

    // Get all youtube IDs from the input videos
    const youtubeIds = videos.map(v => v.youtube_id || v.youtubeId);

    // Query Videos table for ALL matching IDs (regardless of removed status)
    const downloadedVideos = await Video.findAll({
      where: {
        youtubeId: youtubeIds
      },
      attributes: [
        'id',
        'youtubeId',
        'removed',
        'fileSize',
        'filePath',
        'audioFilePath',
        'audioFileSize',
        'normalized_rating',
        'rating_source',
        'protected',
        'last_downloaded_at',
        'video_resolution'
      ]
    });

    // Create Maps for O(1) lookup of download status
    const downloadStatusMap = new Map();
    const videosToCheck = [];

    downloadedVideos.forEach(v => {
      downloadStatusMap.set(v.youtubeId, {
        id: v.id,
        added: true,
        removed: v.removed,
        fileSize: v.fileSize,
        filePath: v.filePath,
        audioFilePath: v.audioFilePath,
        audioFileSize: v.audioFileSize,
        normalized_rating: v.normalized_rating,
        protected: v.protected,
        last_downloaded_at: v.last_downloaded_at,
        video_resolution: v.video_resolution
      });

      // Collect videos that need file checking (only if checkFiles is true and have any file path)
      if (checkFiles && (v.filePath || v.audioFilePath)) {
        videosToCheck.push(v);
      }
    });

    // Check file existence for downloaded videos if requested
    if (checkFiles && videosToCheck.length > 0) {
      const { videos: checkedVideos, updates } = await fileCheckModule.checkVideoFiles(videosToCheck);

      // Update the download status map with file check results
      checkedVideos.forEach(v => {
        const status = downloadStatusMap.get(v.youtubeId);
        if (status) {
          status.removed = v.removed;
          status.fileSize = v.fileSize;
          status.audioFileSize = v.audioFileSize;
        }
      });

      // Apply database updates for file status changes
      if (updates.length > 0) {
        await fileCheckModule.applyVideoUpdates(sequelize, Sequelize, updates);
      }
    }

    // Watched-servers summary for the channel listings, honoring the
    // configured watched rule. Rows exist only for downloaded videos a media
    // server actually reported, so a missing row means unknown -
    // never-downloaded and unmatched videos fall through to [].
    const watchedByVideoId = await watchStatusQueries.getWatchedByMap(
      downloadedVideos.map((v) => v.id)
    );

    return videos.map((video) => {
      const plainVideoObject = video.toJSON ? video.toJSON() : video;
      const videoId = plainVideoObject.youtube_id || plainVideoObject.youtubeId;
      const status = downloadStatusMap.get(videoId);

      if (status) {
        // Video exists in database
        plainVideoObject.added = true;
        plainVideoObject.removed = status.removed;
        plainVideoObject.fileSize = status.fileSize;
        plainVideoObject.filePath = status.filePath;
        plainVideoObject.audioFilePath = status.audioFilePath;
        plainVideoObject.audioFileSize = status.audioFileSize;
        if (status.normalized_rating) {
          plainVideoObject.normalized_rating = status.normalized_rating;
        }
        plainVideoObject.id = status.id;
        plainVideoObject.protected = status.protected;
        plainVideoObject.video_resolution = status.video_resolution ?? null;
        plainVideoObject.timeCreated = status.last_downloaded_at
          ? new Date(status.last_downloaded_at).toISOString()
          : null;
        plainVideoObject.watchedBy = watchedByVideoId.get(status.id) || [];
      } else {
        // Video never downloaded
        plainVideoObject.added = false;
        plainVideoObject.removed = false;
        plainVideoObject.fileSize = null;
        plainVideoObject.filePath = null;
        plainVideoObject.audioFilePath = null;
        plainVideoObject.audioFileSize = null;
        plainVideoObject.protected = false;
        plainVideoObject.video_resolution = null;
        plainVideoObject.watchedBy = [];
      }

      // Replace thumbnail with template format (unless video is removed from YouTube)
      if (!plainVideoObject.youtube_removed) {
        plainVideoObject.thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }

      return plainVideoObject;
    });
  }

  /**
   * Apply duration and date filters to a list of videos.
   * @param {Array} videos - Array of video objects to filter
   * @param {number|null} minDuration - Minimum duration in seconds
   * @param {number|null} maxDuration - Maximum duration in seconds
   * @param {string|null} dateFrom - Filter videos from this instant (ISO string,
   *   expected to represent the viewer's local start-of-day)
   * @param {string|null} dateTo - Filter videos to this instant (ISO string,
   *   expected to represent the viewer's local end-of-day, 23:59:59.999)
   * @returns {Array} - Filtered array of videos
   */
  _applyDurationAndDateFilters(videos, minDuration, maxDuration, dateFrom, dateTo) {
    let filtered = videos;

    if (minDuration !== null) {
      filtered = filtered.filter(video =>
        video.duration && video.duration >= minDuration
      );
    }
    if (maxDuration !== null) {
      filtered = filtered.filter(video =>
        video.duration && video.duration <= maxDuration
      );
    }
    // Estimated dates are ordering-only placeholders; date-range filters
    // must not match on them.
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(video =>
        video.publishedAt &&
        video.published_at_source !== PUBLISHED_AT_SOURCE.ESTIMATED &&
        new Date(video.publishedAt) >= fromDate
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter(video =>
        video.publishedAt &&
        video.published_at_source !== PUBLISHED_AT_SOURCE.ESTIMATED &&
        new Date(video.publishedAt) <= toDate
      );
    }

    return filtered;
  }

  /**
   * Apply tri-state status filters (protected / missing / ignored / watched).
   * Mode is 'off' (no filtering), 'only' (keep matches), or 'exclude' (drop matches).
   * Missing is "previously downloaded, file no longer present".
   * Watched is "has a watched-by entry under the configured watched rule";
   * never-downloaded videos are never watched.
   * @param {Array} videos - Array of enriched videos
   * @param {string} protectedMode - 'off' | 'only' | 'exclude'
   * @param {string} missingMode - 'off' | 'only' | 'exclude'
   * @param {string} ignoredMode - 'off' | 'only' | 'exclude'
   * @param {string} watchedMode - 'off' | 'only' | 'exclude'
   * @returns {Array} - Filtered array of videos
   */
  _applyStatusFilters(videos, protectedMode, missingMode, ignoredMode, watchedMode) {
    let filtered = videos;

    if (protectedMode === 'only') {
      filtered = filtered.filter(video => video.protected);
    } else if (protectedMode === 'exclude') {
      filtered = filtered.filter(video => !video.protected);
    }

    if (missingMode === 'only') {
      filtered = filtered.filter(video => video.added === true && video.removed === true);
    } else if (missingMode === 'exclude') {
      filtered = filtered.filter(video => !(video.added === true && video.removed === true));
    }

    if (ignoredMode === 'only') {
      filtered = filtered.filter(video => video.ignored === true);
    } else if (ignoredMode === 'exclude') {
      filtered = filtered.filter(video => video.ignored !== true);
    }

    if (watchedMode === 'only') {
      filtered = filtered.filter(video => video.watchedBy && video.watchedBy.length > 0);
    } else if (watchedMode === 'exclude') {
      filtered = filtered.filter(video => !video.watchedBy || video.watchedBy.length === 0);
    }

    return filtered;
  }

  /**
   * Fetch the newest videos for a channel from the database with search and sort.
   * Returns videos with download status.
   * @param {string} channelId - Channel ID to fetch videos for
   * @param {number} limit - Maximum number of videos to return (default 50)
   * @param {number} offset - Number of videos to skip (default 0)
   * @param {string} downloadedFilter - Tri-state filter on download status: 'off' | 'only' | 'exclude' (default 'off')
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} sortBy - Field to sort by: 'date', 'title', 'duration', 'size' (default 'date')
   * @param {string} sortOrder - Sort order: 'asc' or 'desc' (default 'desc')
   * @param {boolean} checkFiles - Whether to check file existence for current page (default false)
   * @param {string} mediaType - Media type to filter by: 'video', 'short', 'livestream' (default 'video')
   * @param {number|null} minDuration - Minimum duration in seconds (default null)
   * @param {number|null} maxDuration - Maximum duration in seconds (default null)
   * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
   * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Array>} - Array of video objects with download status
   */
  async fetchNewestVideosFromDb(channelId, limit = 50, offset = 0, downloadedFilter = 'off', searchQuery = '', sortBy = 'date', sortOrder = 'desc', checkFiles = false, mediaType = 'video', minDuration = null, maxDuration = null, dateFrom = null, dateTo = null, protectedFilter = 'off', missingFilter = 'off', ignoredFilter = 'off', watchedFilter = 'off') {
    // First get all videos to enrich with download status
    const allChannelVideos = await ChannelVideo.findAll({
      where: {
        channel_id: channelId,
        media_type: mediaType,
      },
      order: [['publishedAt', 'DESC']],
    });

    // Enrich all videos with download status, but only check files for the current page
    // We'll determine which videos are on the current page after filtering and sorting
    const enrichedVideos = await this.enrichVideosWithDownloadStatus(allChannelVideos, false);

    // Filter if needed
    let filteredVideos = enrichedVideos;
    if (downloadedFilter === 'exclude') {
      filteredVideos = enrichedVideos.filter(video => !video.added || video.removed);
    } else if (downloadedFilter === 'only') {
      filteredVideos = enrichedVideos.filter(video => video.added && !video.removed);
    }

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredVideos = filteredVideos.filter(video =>
        video.title && video.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply duration and date filters
    filteredVideos = this._applyDurationAndDateFilters(filteredVideos, minDuration, maxDuration, dateFrom, dateTo);

    filteredVideos = this._applyStatusFilters(filteredVideos, protectedFilter, missingFilter, ignoredFilter, watchedFilter);

    // Apply sorting
    filteredVideos.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
      case 'date':
        comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'duration':
        comparison = (a.duration || 0) - (b.duration || 0);
        break;
      case 'size':
        comparison = (a.fileSize || 0) - (b.fileSize || 0);
        break;
      default:
        comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const paginatedVideos = filteredVideos.slice(offset, offset + limit);

    // If checkFiles is true, check file existence for only the current page
    if (checkFiles && paginatedVideos.length > 0) {
      // Re-enrich only the paginated videos with file checking enabled
      const paginatedChannelVideos = paginatedVideos.map(v => ({
        youtube_id: v.youtube_id || v.youtubeId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        publishedAt: v.publishedAt,
        availability: v.availability,
        youtube_removed: v.youtube_removed,
        ignored: v.ignored,
        ignored_at: v.ignored_at,
        normalized_rating: v.normalized_rating,
        media_type: v.media_type,
        live_status: v.live_status
      }));

      // This will check files for only the current page
      const checkedVideos = await this.enrichVideosWithDownloadStatus(paginatedChannelVideos, true);

      // Merge the checked results back into the paginated videos
      for (let i = 0; i < paginatedVideos.length; i++) {
        if (checkedVideos[i]) {
          paginatedVideos[i].added = checkedVideos[i].added;
          paginatedVideos[i].removed = checkedVideos[i].removed;
          paginatedVideos[i].fileSize = checkedVideos[i].fileSize;
          paginatedVideos[i].thumbnail = checkedVideos[i].thumbnail;
        }
        // If a video is removed from YouTube, fallback to using the locally stored thumbnail if available
        if (paginatedVideos[i].youtube_removed) {
          paginatedVideos[i].thumbnail = `/images/videothumb-${paginatedVideos[i].youtube_id}.jpg`;
        }
      }
    }

    // Estimated dates exist only for ordering (already applied above); blank
    // them so consumers render "no date" instead of a fabricated one.
    for (const video of paginatedVideos) {
      if (video.published_at_source === PUBLISHED_AT_SOURCE.ESTIMATED) {
        video.publishedAt = null;
      }
    }

    return paginatedVideos;
  }

  /**
   * Get the total count and oldest video date for a channel
   * @param {string} channelId - Channel ID
   * @param {string} downloadedFilter - Tri-state filter on download status: 'off' | 'only' | 'exclude' (default 'off')
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} mediaType - Media type to filter by: 'video', 'short', 'livestream' (default 'video')
   * @param {number|null} minDuration - Minimum duration in seconds (default null)
   * @param {number|null} maxDuration - Maximum duration in seconds (default null)
   * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
   * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Object>} - Object with totalCount and oldestVideoDate
   */
  async getChannelVideoStats(channelId, downloadedFilter = 'off', searchQuery = '', mediaType = 'video', minDuration = null, maxDuration = null, dateFrom = null, dateTo = null, protectedFilter = 'off', missingFilter = 'off', ignoredFilter = 'off', watchedFilter = 'off') {
    // If we have search or filter, we need to get all videos
    if (downloadedFilter !== 'off' || searchQuery || minDuration !== null || maxDuration !== null || dateFrom || dateTo || protectedFilter !== 'off' || missingFilter !== 'off' || ignoredFilter !== 'off' || watchedFilter !== 'off') {
      // Need to filter by download status and/or search
      const allChannelVideos = await ChannelVideo.findAll({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        },
        order: [['publishedAt', 'DESC']],
      });

      const enrichedVideos = await this.enrichVideosWithDownloadStatus(allChannelVideos);

      let filteredVideos = enrichedVideos;

      // Apply download filter
      if (downloadedFilter === 'exclude') {
        filteredVideos = filteredVideos.filter(video => !video.added || video.removed);
      } else if (downloadedFilter === 'only') {
        filteredVideos = filteredVideos.filter(video => video.added && !video.removed);
      }

      // Apply search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredVideos = filteredVideos.filter(video =>
          video.title && video.title.toLowerCase().includes(searchLower)
        );
      }

      // Apply duration and date filters
      filteredVideos = this._applyDurationAndDateFilters(filteredVideos, minDuration, maxDuration, dateFrom, dateTo);

      filteredVideos = this._applyStatusFilters(filteredVideos, protectedFilter, missingFilter, ignoredFilter, watchedFilter);

      // Estimated dates are ordering-only placeholders; never surface them.
      const oldest = filteredVideos.length > 0 ? filteredVideos[filteredVideos.length - 1] : null;
      return {
        totalCount: filteredVideos.length,
        oldestVideoDate: oldest && oldest.published_at_source !== PUBLISHED_AT_SOURCE.ESTIMATED ?
          oldest.publishedAt : null
      };
    } else {
      // Fast path - just use database counts when no filters
      const totalCount = await ChannelVideo.count({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        }
      });

      const oldestVideo = await ChannelVideo.findOne({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        },
        order: [['publishedAt', 'ASC']],
        attributes: ['publishedAt', 'published_at_source']
      });

      return {
        totalCount,
        oldestVideoDate: oldestVideo && oldestVideo.published_at_source !== PUBLISHED_AT_SOURCE.ESTIMATED ?
          oldestVideo.publishedAt : null
      };
    }
  }
}

module.exports = new ChannelVideoQuery();
