const logger = require('../../logger');
const Channel = require('../../models/channel');
const { sanitizeNameLikeYtDlp } = require('../filesystem');
const youtubeApi = require('../youtubeApi');
const channelYtdlpExecutor = require('./channelYtdlpExecutor');
const { logApiFallback } = require('./apiFallbackLogger');

class ChannelMetadataFetcher {
  /**
   * Fetch channel metadata from YouTube along with sanitized folder name.
   * Uses a combined yt-dlp call that outputs both folder name and JSON metadata.
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<Object>} - Channel metadata with folder_name property
   */
  async fetchChannelMetadata(channelUrl) {
    if (youtubeApi.isAvailable()) {
      try {
        const apiKey = youtubeApi.getApiKey();
        const info = await youtubeApi.client.getChannelInfo(apiKey, channelUrl);
        if (info && info.channelId) {
          logger.info({ channelId: info.channelId, source: 'youtube-api' }, 'Fetched channel metadata via YouTube API');
          const unsanitizedFolderName = info.title || info.customUrl || info.channelId;
          const sanitizedFolderName = sanitizeNameLikeYtDlp(unsanitizedFolderName);

          // Callers rely on entries.length > 0 as a "channel has uploads" signal.
          // When videoCount is null (owner hid the count), assume uploads exist;
          // yt-dlp will catch truly-empty channels later if the API is wrong.
          const hasVideos = info.videoCount === null || info.videoCount > 0;
          const entries = hasVideos ? [{ id: info.channelId }] : [];

          return {
            channel_id: info.channelId,
            id: info.channelId,
            title: info.title,
            description: info.description,
            uploader: info.title,
            uploader_id: info.customUrl || info.channelId,
            uploads_playlist_id: info.uploadsPlaylistId,
            thumbnails: info.thumbnailUrl
              ? [{ id: 'avatar_uncropped', url: info.thumbnailUrl, width: 800, height: 800 }]
              : [],
            folder_name: sanitizedFolderName,
            entries,
          };
        }
        logger.info({ channelUrl }, 'YouTube API getChannelInfo returned no items, falling back to yt-dlp');
      } catch (apiErr) {
        logApiFallback(
          apiErr,
          { channelUrl },
          'YouTube API fetchChannelMetadata failed, falling back to yt-dlp'
        );
      }
    }

    const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    return await channelYtdlpExecutor.withTempFile('channel', async (outputFilePath) => {
      const args = YtdlpCommandBuilder.buildMetadataWithFolderNameArgs(channelUrl, {
        playlistEnd: 1,
        skipSleepRequests: true,
      });
      logger.info('fetchChannelMetadata executing yt-dlp with args' + JSON.stringify(args));
      const content = await channelYtdlpExecutor.executeYtDlpCommand(args, outputFilePath);
      logger.info('fetchChannelMetadata received yt-dlp output of length ' + content.length);

      const metadata = JSON.parse(content);

      const unsanitizedFolderName = metadata.uploader || metadata.channel || metadata.uploader_id;
      const sanitizedFolderName = sanitizeNameLikeYtDlp(unsanitizedFolderName);

      return { ...metadata, folder_name: sanitizedFolderName };

    });
  }

  /**
   * Resolve the folder name for a channel with fallback to yt-dlp.
   * Uses cached folder_name if available, otherwise calls yt-dlp to get
   * the authoritative sanitized folder name and saves it to the database.
   *
   * @param {Object} channel - Channel record with channel_id, folder_name, uploader
   * @returns {Promise<string>} - The resolved folder name
   */
  async resolveChannelFolderName(channel) {
    // Fast path: use cached folder_name if available
    if (channel.folder_name) {
      return channel.folder_name;
    }

    // Slow path: call yt-dlp to get authoritative folder name
    const channelUrl = `https://www.youtube.com/channel/${channel.channel_id}`;
    let channelData;
    try {
      channelData = await this.fetchChannelMetadata(channelUrl);
    } catch (fetchErr) {
      // If yt-dlp fails, fall back to sanitizing the uploader name
      logger.warn({ channelId: channel.channel_id, uploader: channel.uploader },
        'Could not determine folder_name via yt-dlp, using uploader as fallback');
      return sanitizeNameLikeYtDlp(channel.uploader);
    }

    const folderName = channelData.folder_name;

    if (folderName) {
      // Save to database for future fast access
      try {
        await Channel.update(
          { folder_name: folderName },
          { where: { channel_id: channel.channel_id } }
        );
        logger.info({ channelId: channel.channel_id, folderName },
          'Populated folder_name via yt-dlp fallback');
      } catch (updateErr) {
        logger.warn({ err: updateErr.message, channelId: channel.channel_id },
          'Failed to save folder_name to database');
      }
      return folderName;
    }

    // Ultimate fallback (should rarely happen - yt-dlp returned no folder_name)
    // Just sanitize the uploader we already have
    logger.warn({ channelId: channel.channel_id, uploader: channel.uploader },
      'Could not determine folder_name via yt-dlp, using uploader as fallback');
    return sanitizeNameLikeYtDlp(channel.uploader);
  }
}

module.exports = new ChannelMetadataFetcher();
