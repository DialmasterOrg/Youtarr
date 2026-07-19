const logger = require('../../logger');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const { TAB_TYPES, MEDIA_TAB_TYPE_MAP } = require('../tabsUtils');
const channelIdentity = require('./channelIdentity');
const channelYtdlpExecutor = require('./channelYtdlpExecutor');
const videoEntryParser = require('./videoEntryParser');
const channelVideoWriter = require('./channelVideoWriter');
const channelVideoQuery = require('./channelVideoQuery');
const channelVideoFetcher = require('./channelVideoFetcher');
const fetchRegistry = require('./fetchRegistry');
const tabState = require('./tabState');

// Maximum number of videos to load when user clicks "Load More"
// Limit set here because some channels have tens or hundreds of thousands of videos...
// which effectively is not "loadable", so we had to set some reasonable limit.
// Unfortunately, yt-dlp ALWAYS starts a fetch with the newest video, so there is no way to "page" through
const MAX_LOAD_MORE_VIDEOS = 5000;

class ChannelVideosService {
  /**
   * Build channel videos response object
   * @param {Array} videos - Array of videos
   * @param {Object} channel - Channel database record
   * @param {string} dataSource - Data source ('cache' or 'yt_dlp')
   * @param {Object} stats - Stats object with totalCount and oldestVideoDate
   * @param {boolean} autoDownloadsEnabled - Whether auto downloads are enabled
   * @param {string} mediaType - Media type to get last fetched timestamp for
   * @returns {Object} - Formatted response
   */
  buildChannelVideosResponse(videos, channel, dataSource = 'cache', stats = null, autoDownloadsEnabled = false, mediaType = 'video') {
    // Parse available tabs if present (filters out user-hidden tabs)
    const availableTabs = channel
      ? tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs)
      : [];

    // Get the last fetched timestamp for this specific tab
    const lastFetched = channel ? tabState.getLastFetchedForTab(channel, mediaType) : null;

    return {
      videos: videos,
      dataSource: dataSource,
      lastFetched: lastFetched,
      totalCount: stats ? stats.totalCount : videos.length,
      oldestVideoDate: stats ? stats.oldestVideoDate : null,
      autoDownloadsEnabled: autoDownloadsEnabled,
      availableTabs: availableTabs,
    };
  }

  /**
   * Get channel videos with smart caching.
   * Returns cached data if fresh, otherwise fetches new data from YouTube.
   * Falls back to cached data on errors.
   * @param {string} channelId - Channel ID to get videos for
   * @param {number} page - Page number (1-based, default 1)
   * @param {number} pageSize - Number of videos per page (default 50)
   * @param {string} downloadedFilter - Tri-state filter on download status: 'off' | 'only' | 'exclude' (default 'off')
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} sortBy - Field to sort by: 'date', 'title', 'duration', 'size' (default 'date')
   * @param {string} sortOrder - Sort order: 'asc' or 'desc' (default 'desc')
   * @param {string} tabType - Tab type to fetch: 'videos', 'shorts', or 'streams' (default 'videos')
   * @param {number|null} minDuration - Minimum duration in seconds (default null)
   * @param {number|null} maxDuration - Maximum duration in seconds (default null)
   * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
   * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Object>} - Response object with videos and metadata
   */
  async getChannelVideos(channelId, page = 1, pageSize = 50, downloadedFilter = 'off', searchQuery = '', sortBy = 'date', sortOrder = 'desc', tabType = TAB_TYPES.VIDEOS, minDuration = null, maxDuration = null, dateFrom = null, dateTo = null, protectedFilter = 'off', missingFilter = 'off', ignoredFilter = 'off', watchedFilter = 'off') {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    // Convert tabType to mediaType for database filtering
    const mediaType = MEDIA_TAB_TYPE_MAP[tabType] || 'video';
    const autoDownloadsEnabled = channel.auto_download_enabled_tabs.split(',').includes(mediaType);

    // Check if the requested tab exists in available_tabs
    // If available_tabs is populated and the requested tab doesn't exist, don't try to fetch from YouTube
    let shouldFetchFromYoutube = true;
    if (channel.available_tabs) {
      const availableTabs = channel.available_tabs.split(',');
      if (!availableTabs.includes(tabType)) {
        logger.info({
          channelId,
          requestedTab: tabType,
          availableTabs: availableTabs.join(', ')
        }, 'Requested tab not available for channel');
        shouldFetchFromYoutube = false;
      }
    }

    // Tracks whether yt-dlp actually ran AND resolved in this request.
    // Frontends key the "channel state may have changed" signal off this flag,
    // so it must NOT flip true on cache-only or yt-dlp-failed-with-cache paths.
    let freshFetchPerformed = false;

    try {
      // First check if we need to refresh recent videos from YouTube
      const allVideos = await channelVideoQuery.fetchNewestVideosFromDb(channelId, 1, 0, 'off', '', 'date', 'desc', false, mediaType);
      const mostRecentVideoDate = allVideos.length > 0 ? allVideos[0].publishedAt : null;

      if (shouldFetchFromYoutube && channelVideoFetcher.shouldRefreshChannelVideos(channel, allVideos.length, mediaType)) {
        // Use composite key to allow concurrent fetches for different tabs
        const fetchKey = `${channelId}:${tabType}`;

        // Check if there's already an active fetch for this channel/tab
        if (fetchRegistry.has(fetchKey)) {
          logger.info({ channelId, tabType }, 'Skipping auto-refresh - fetch already in progress for this tab');
        } else {
          // Register this fetch operation
          fetchRegistry.set(fetchKey, {
            startTime: new Date().toISOString(),
            type: 'autoRefresh',
            tabType: tabType
          });

          try {
            // Fetch videos for the specified tab type
            await channelVideoFetcher.fetchAndSaveVideosViaYtDlp(channel, channelId, tabType, mostRecentVideoDate);
            freshFetchPerformed = true;
          } finally {
            // Clear the active fetch record
            fetchRegistry.delete(fetchKey);
          }
        }
      }

      // Now fetch the requested page of videos with file checking enabled
      const offset = (page - 1) * pageSize;
      const paginatedVideos = await channelVideoQuery.fetchNewestVideosFromDb(channelId, pageSize, offset, downloadedFilter, searchQuery, sortBy, sortOrder, true, mediaType, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter, watchedFilter);

      // Check if videos still exist on YouTube and mark as removed if they don't
      const videoValidationModule = require('../videoValidationModule');
      const updates = [];
      const timestampUpdates = [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Check all videos concurrently for better performance
      // Only check videos that haven't been checked in the last 24 hours
      const checkPromises = paginatedVideos.map(async (video) => {
        const youtubeId = video.youtube_id || video.youtubeId;
        const lastChecked = video.youtube_removed_checked_at ? new Date(video.youtube_removed_checked_at) : null;

        // Skip if already marked as removed or checked within last 24 hours
        if (video.youtube_removed || (lastChecked && lastChecked > twentyFourHoursAgo)) {
          return null;
        }

        if (youtubeId) {
          const exists = await videoValidationModule.checkVideoExistsOnYoutube(youtubeId);
          const now = new Date();

          if (!exists) {
            logger.info({ youtubeId, channelId }, 'Video no longer exists on YouTube, marking as removed');
            video.youtube_removed = true;
            video.youtube_removed_checked_at = now;
            return { youtube_id: youtubeId, channel_id: channelId, removed: true, checked_at: now };
          } else {
            // Video exists, just update the timestamp
            video.youtube_removed_checked_at = now;
            return { youtube_id: youtubeId, channel_id: channelId, removed: false, checked_at: now };
          }
        }
        return null;
      });

      const checkResults = await Promise.all(checkPromises);
      const validResults = checkResults.filter(result => result !== null);

      // Separate updates for removed videos and timestamp updates
      for (const result of validResults) {
        if (result.removed) {
          updates.push(result);
        } else {
          timestampUpdates.push(result);
        }
      }

      // Bulk update channelvideos table for removed videos
      if (updates.length > 0) {
        for (const update of updates) {
          await ChannelVideo.update(
            { youtube_removed: true, youtube_removed_checked_at: update.checked_at },
            { where: { youtube_id: update.youtube_id, channel_id: update.channel_id } }
          );
        }
      }

      // Bulk update channelvideos table for timestamp-only updates
      if (timestampUpdates.length > 0) {
        for (const update of timestampUpdates) {
          await ChannelVideo.update(
            { youtube_removed_checked_at: update.checked_at },
            { where: { youtube_id: update.youtube_id, channel_id: update.channel_id } }
          );
        }
      }

      // Get stats for the response
      const stats = await channelVideoQuery.getChannelVideoStats(channelId, downloadedFilter, searchQuery, mediaType, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter, watchedFilter);

      return {
        ...this.buildChannelVideosResponse(paginatedVideos, channel, 'cache', stats, autoDownloadsEnabled, mediaType),
        freshFetchPerformed
      };

    } catch (error) {
      logger.error({ err: error, channelId }, 'Error fetching channel videos');
      const offset = (page - 1) * pageSize;
      const cachedVideos = await channelVideoQuery.fetchNewestVideosFromDb(channelId, pageSize, offset, downloadedFilter, searchQuery, sortBy, sortOrder, true, mediaType, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter, watchedFilter);
      const stats = await channelVideoQuery.getChannelVideoStats(channelId, downloadedFilter, searchQuery, mediaType, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter, watchedFilter);
      const response = this.buildChannelVideosResponse(cachedVideos, channel, 'cache', stats, autoDownloadsEnabled, mediaType);
      // Only surface a user-visible error when we have nothing to show.
      // Silent recovery when cached results exist; the filter-aware empty
      // state handles "fetch ok, zero matches" on its own.
      if ((stats ? stats.totalCount : cachedVideos.length) === 0) {
        response.fetchError = true;
      }
      return response;
    }
  }

  /**
   * Fetch ALL videos for a channel from YouTube and save to database.
   * This is a long-running operation that fetches the complete video history.
   * @param {string} channelId - Channel ID
   * @param {number} requestedPage - Page requested by frontend
   * @param {number} requestedPageSize - Page size requested by frontend
   * @param {string} downloadedFilter - Tri-state filter on download status: 'off' | 'only' | 'exclude' (default 'off')
   * @param {string} tabType - Tab type to fetch: 'videos', 'shorts', or 'streams' (default 'videos')
   * @returns {Promise<Object>} - Response with success status and paginated data
   */
  async fetchAllChannelVideos(channelId, requestedPage = 1, requestedPageSize = 50, downloadedFilter = 'off', tabType = TAB_TYPES.VIDEOS) {
    // Use composite key to allow concurrent fetches for different tabs
    const fetchKey = `${channelId}:${tabType}`;

    // Check if there's already an active fetch for this channel/tab combination
    if (fetchRegistry.has(fetchKey)) {
      const activeOperation = fetchRegistry.get(fetchKey);
      throw new Error(`A fetch operation is already in progress for this channel tab (started ${activeOperation.startTime})`);
    }

    // Register this fetch operation
    fetchRegistry.set(fetchKey, {
      startTime: new Date().toISOString(),
      type: 'fetchAll',
      tabType: tabType
    });

    try {
      const channel = await Channel.findOne({
        where: { channel_id: channelId },
      });

      if (!channel) {
        throw new Error('Channel not found in database');
      }

      try {
        logger.info({ channelId, channelTitle: channel.title, tabType }, 'Starting full video fetch for channel');
        const startTime = Date.now();

        const canonicalUrl = `${channelIdentity.resolveChannelUrlFromId(channelId)}/${tabType}`;
        const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
        const result = await channelYtdlpExecutor.withTempFile('channel-all-videos', async (outputFilePath) => {
          const args = YtdlpCommandBuilder.buildMetadataFetchArgs(canonicalUrl, {
            flatPlaylist: true,
            extractorArgs: 'youtubetab:approximate_date',
            playlistEnd: MAX_LOAD_MORE_VIDEOS
          });
          const content = await channelYtdlpExecutor.executeYtDlpCommand(args, outputFilePath);

          const jsonOutput = JSON.parse(content);
          const videos = videoEntryParser.extractVideosFromYtDlpResponse(jsonOutput, channel.default_rating);
          const currentChannelUrl = jsonOutput.uploader_url || jsonOutput.channel_url || jsonOutput.url;
          return { videos, currentChannelUrl };
        });

        const fetchDuration = (Date.now() - startTime) / 1000;
        logger.info({
          channelId,
          videoCount: result.videos.length,
          durationSeconds: fetchDuration
        }, 'Fetched videos from YouTube');

        // Save all videos to database with correct media type
        const mediaType = MEDIA_TAB_TYPE_MAP[tabType] || 'video';
        if (result.videos.length > 0) {
          await channelVideoWriter.insertVideosIntoDb(result.videos, channelId, mediaType);
        }

        // Update channel metadata
        if (result.currentChannelUrl && result.currentChannelUrl !== channel.url) {
          logger.info({
            channelTitle: channel.title,
            oldUrl: channel.url,
            newUrl: result.currentChannelUrl
          }, 'Channel URL updated');
          channel.url = result.currentChannelUrl;
          await channel.save(); // Save URL change before atomic timestamp update
        }
        // Update the last fetched timestamp for this specific tab (atomic SQL update)
        await tabState.setLastFetchedForTab(channel, mediaType, new Date());

        // yt-dlp returned a valid response, so the channel is reachable.
        await channelVideoFetcher._clearTerminationMarkerIfSet(channel, channelId);

        // Get the requested page of videos after the full fetch
        const offset = (requestedPage - 1) * requestedPageSize;
        const paginatedVideos = await channelVideoQuery.fetchNewestVideosFromDb(channelId, requestedPageSize, offset, downloadedFilter, '', 'date', 'desc', false, mediaType);
        const stats = await channelVideoQuery.getChannelVideoStats(channelId, downloadedFilter, '', mediaType);

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        logger.info({
          channelId,
          elapsedSeconds,
          videosFound: result.videos.length
        }, 'Full video fetch completed');

        return {
          success: true,
          videosFound: result.videos.length,
          elapsedSeconds: elapsedSeconds,
          ...this.buildChannelVideosResponse(paginatedVideos, channel, 'yt_dlp_full', stats, false, mediaType)
        };

      } catch (error) {
        logger.error({ err: error, channelId }, 'Error fetching all videos for channel');
        throw error;
      }
    } finally {
      // Always clear the active fetch record, whether successful or failed
      fetchRegistry.delete(fetchKey);
    }
  }
}

module.exports = new ChannelVideosService();
