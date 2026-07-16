const logger = require('../../logger');
const Channel = require('../../models/channel');
const { MEDIA_TAB_TYPE_MAP } = require('../tabsUtils');
const channelIdentity = require('./channelIdentity');
const channelYtdlpExecutor = require('./channelYtdlpExecutor');
const videoEntryParser = require('./videoEntryParser');
const channelVideoWriter = require('./channelVideoWriter');
const tabState = require('./tabState');

class ChannelVideoFetcher {
  /**
   * Fetch channel videos from a specific tab via yt-dlp.
   * Uses canonical channel URL for stability when handles change.
   * @param {string} channelId - Channel ID to fetch videos for
   * @param {Date|null} mostRecentVideoDate - Date of the most recent video we have
   * @param {string} tabType - Type of tab to fetch videos from
   * @returns {Promise<Object>} - Object with videos array and current channel URL
   * @throws {Error} - If channel not found in database
   */
  async fetchChannelVideos(channelId, mostRecentVideoDate = null, tabType) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Determine how many videos to fetch based on recency
    // If we have recent data (within 10 days), fetch fewer videos for faster response
    let videoCount = 50; // Default/max for initial fetch or stale data
    if (mostRecentVideoDate) {
      const daysSinceLastVideo = Math.floor((Date.now() - new Date(mostRecentVideoDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastVideo <= 10) {
        // Fetch 5 videos minimum, or 5 videos per day since last fetch, up to 50 max
        videoCount = Math.min(50, Math.max(5, daysSinceLastVideo * 5));
      }
    }

    // Always use canonical URL based on channel ID for yt-dlp. This avoids the
    // YouTube API playlist path, which can omit videos that yt-dlp can see.
    const canonicalUrl = `${channelIdentity.resolveChannelUrlFromId(channelId)}/${tabType}`;

    const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    return await channelYtdlpExecutor.withTempFile('channel-videos', async (outputFilePath) => {
      const args = YtdlpCommandBuilder.buildMetadataFetchArgs(canonicalUrl, {
        flatPlaylist: true,
        extractorArgs: 'youtubetab:approximate_date',
        playlistEnd: videoCount
      });
      const content = await channelYtdlpExecutor.executeYtDlpCommand(args, outputFilePath);

      const jsonOutput = JSON.parse(content);

      // Extract videos using helper method that handles nested structures
      const videos = videoEntryParser.extractVideosFromYtDlpResponse(jsonOutput, channel.default_rating);

      // Extract the current channel URL (with handle) from the response
      const currentChannelUrl = jsonOutput.uploader_url || jsonOutput.channel_url || jsonOutput.url;

      return { videos, currentChannelUrl };
    });
  }

  /**
   * Check if channel videos need refreshing for a specific tab
   * @param {Object} channel - Channel database record
   * @param {number} videoCount - Current video count for this tab
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @returns {boolean} - True if refresh needed
   */
  shouldRefreshChannelVideos(channel, videoCount, mediaType) {
    if (!channel) return false;

    // Always re-probe terminated channels so a reinstatement is detected on
    // the very next page load, regardless of cache freshness. Without this,
    // a terminated channel with recent lastFetched would skip yt-dlp and the
    // termination notice would stick until cache expiry.
    if (channel.terminated_at) return true;

    const lastFetched = tabState.getLastFetchedForTab(channel, mediaType);

    return !lastFetched ||
           new Date() - lastFetched > 1 * 60 * 60 * 1000 ||
           videoCount === 0;
  }

  /**
   * Clear terminated_at on a channel when we've proven it's reachable.
   * Swallows failures so the calling page-load path can't be broken by a
   * stuck UPDATE - the marker would just stay set until the next attempt.
   * @param {Object} channel - Sequelize channel instance
   * @param {string} channelId - Channel ID for log context
   * @returns {Promise<void>}
   * @private
   */
  async _clearTerminationMarkerIfSet(channel, channelId) {
    if (!channel || !channel.terminated_at) return;
    try {
      await channel.update({ terminated_at: null });
      logger.info({ channelId }, 'Channel previously marked terminated is reachable again; clearing termination marker');
    } catch (clearErr) {
      logger.warn({ err: clearErr, channelId }, 'Failed to clear terminated_at after successful video fetch');
    }
  }

  /**
   * Fetch videos from YouTube and save to database.
   * Updates channel's lastFetchedByTab timestamp for the specific tab on success.
   * Also updates the channel URL if it has changed (e.g., handle renamed).
   * @param {Object} channel - Channel database record
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Type of tab to fetch videos from
   * @param {Date|null} mostRecentVideoDate - Date of the most recent video we have
   * @returns {Promise<void>}
   * @throws {Error} - Re-throws yt-dlp errors
   */
  async fetchAndSaveVideosViaYtDlp(channel, channelId, tabType, mostRecentVideoDate = null) {
    try {
      const result = await this.fetchChannelVideos(channelId, mostRecentVideoDate, tabType);
      const { videos, currentChannelUrl } = result;

      const mediaType = MEDIA_TAB_TYPE_MAP[tabType];

      if (videos.length > 0) {
        await channelVideoWriter.insertVideosIntoDb(videos, channelId, mediaType);
      }

      if (channel) {
        // Update URL if it has changed (e.g., handle renamed)
        if (currentChannelUrl && currentChannelUrl !== channel.url) {
          logger.info({
            channelTitle: channel.title,
            oldUrl: channel.url,
            newUrl: currentChannelUrl
          }, 'Channel URL updated');
          channel.url = currentChannelUrl;
          await channel.save(); // Save URL change before atomic timestamp update
        }

        // Update the last fetched timestamp for this specific tab (atomic SQL update)
        await tabState.setLastFetchedForTab(channel, mediaType, new Date());

        // Reaching this point means yt-dlp returned a valid response, so the
        // channel is reachable - inverse of persistTerminatedChannel.
        await this._clearTerminationMarkerIfSet(channel, channelId);
      }
    } catch (ytdlpError) {
      logger.error({ err: ytdlpError, channelId }, 'Error fetching channel videos');
      throw ytdlpError;
    }
  }
}

module.exports = new ChannelVideoFetcher();
