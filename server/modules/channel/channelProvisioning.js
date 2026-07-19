const logger = require('../../logger');
const Channel = require('../../models/channel');
const MessageEmitter = require('../messageEmitter.js');
const { GLOBAL_DEFAULT_SENTINEL } = require('../filesystem');
const channelIdentity = require('./channelIdentity');
const channelMappers = require('./channelMappers');
const channelMetadataFetcher = require('./channelMetadataFetcher');
const channelThumbnails = require('./channelThumbnails');
const tabManager = require('./tabManager');

class ChannelProvisioning {
  /**
   * Insert or update channel in database
   * @param {Object} channelData - Channel data to save
   * @param {boolean} enabled - Whether the channel should be enabled (default: false)
   * @param {string|null} autoDownloadEnabledTabs - Comma-separated list of enabled tabs (default: null, uses model default)
   * @param {Object} initialSettings - Optional settings to apply only when creating a new channel (e.g., video_quality, sub_folder, default_rating)
   * @returns {Promise<Object>} - Saved channel record
   */
  async upsertChannel(channelData, enabled = false, autoDownloadEnabledTabs = null, initialSettings = {}) {
    // First, try to find by channel_id (preferred)
    let channel = await Channel.findOne({
      where: { channel_id: channelData.id }
    });

    // `enabled` is only upgraded here: demoting it on update would soft-delete
    // a subscribed channel (e.g. re-fetching metadata for a URL variant).
    const updateData = {
      channel_id: channelData.id,
      title: channelData.title,
      description: channelData.description,
      uploader: channelData.uploader,
      url: channelData.url,
    };
    if (enabled) {
      updateData.enabled = true;
    }

    // Only set folder_name if explicitly provided (don't overwrite existing with null)
    if (channelData.folder_name) {
      updateData.folder_name = channelData.folder_name;
    }

    // Only set auto_download_enabled_tabs if explicitly provided
    if (autoDownloadEnabledTabs !== null) {
      updateData.auto_download_enabled_tabs = autoDownloadEnabledTabs;
    }

    if (!channel) {
      // Fallback: try to find by URL (for legacy data without channel_id)
      channel = await Channel.findOne({
        where: { url: channelData.url }
      });

      if (channel) {
        // Found by URL - update with channel_id and other fields
        // This backfills legacy data with the channel_id
        await channel.update(updateData);
      }
    } else {
      // Found by channel_id - just update metadata
      await channel.update(updateData);
    }

    // Only create if not found by either method
    if (!channel) {
      // New rows always carry an explicit enabled state
      updateData.enabled = enabled;
      // Apply initial settings only for new channels
      if (initialSettings.video_quality != null) updateData.video_quality = initialSettings.video_quality;
      // Three sub_folder states must stay distinct:
      //   absent          -> global-default sentinel (falls through to global default)
      //   explicit null   -> filesystem root (user chose "No Subfolder")
      //   explicit value  -> that value
      // hasOwnProperty, not a null check, keeps explicit-null distinct from absent.
      // Mirrors playlistModule.ensureSourceChannel.
      if (Object.prototype.hasOwnProperty.call(initialSettings, 'sub_folder')) {
        updateData.sub_folder = initialSettings.sub_folder;
      } else {
        updateData.sub_folder = GLOBAL_DEFAULT_SENTINEL;
      }
      if (initialSettings.default_rating != null) updateData.default_rating = initialSettings.default_rating;
      if (initialSettings.min_duration != null) updateData.min_duration = initialSettings.min_duration;
      if (initialSettings.max_duration != null) updateData.max_duration = initialSettings.max_duration;
      if (initialSettings.title_filter_regex != null) updateData.title_filter_regex = initialSettings.title_filter_regex;
      if (initialSettings.audio_format != null) updateData.audio_format = initialSettings.audio_format;

      channel = await Channel.create(updateData);
    }

    return channel;
  }

  /**
   * Get channel information from database or fetch from YouTube.
   * First checks database, then fetches from YouTube if not found.
   * Also handles channel thumbnail download and processing.
   * @param {string} channelUrlOrId - YouTube channel URL or channel ID
   * @param {boolean} emitMessage - Whether to emit WebSocket update message
   * @param {boolean} enableChannel - Whether to enable the channel if it's new (default: false)
   * @param {object} initialSettings - Optional per-channel settings (video_quality, sub_folder, default_rating) passed to upsertChannel
   * @returns {Promise<Object>} - Channel information object
   */
  async getChannelInfo(channelUrlOrId, emitMessage = true, enableChannel = false, initialSettings = {}, { skipTabDetection = false } = {}) {
    const { foundChannel, channelUrl } = await channelIdentity.findChannelByUrlOrId(channelUrlOrId);

    if (foundChannel) {
      // A disabled row is a soft-deleted channel; callers that subscribe
      // (enableChannel=true) restore it here, keeping its previous settings.
      if (enableChannel && !foundChannel.enabled) {
        await foundChannel.update({ enabled: true });
        logger.info({ channelId: foundChannel.channel_id }, 'Re-enabled soft-deleted channel');
      }
      if (emitMessage) {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'channel',
          'channelsUpdated',
          { text: 'Channel Updated' }
        );
      }
      return { ...channelMappers.mapChannelToResponse(foundChannel), existing: true };
    }

    logger.info('Fetching channel metadata from YouTube');
    const channelData = await channelMetadataFetcher.fetchChannelMetadata(channelUrl);
    logger.info('Channel metadata fetched successfully');

    // Reject channels with no videos - these can't be usefully added
    if (!channelData.entries || channelData.entries.length === 0) {
      const error = new Error('Channel has no videos');
      error.code = 'CHANNEL_EMPTY';
      throw error;
    }

    // Extract the actual current handle URL from the response
    const actualChannelUrl = channelData.channel_url || channelData.url || channelUrl;

    // Get the proper channel ID - prefer channel_id, then uploader_id, fallback to id
    // yt-dlp sometimes returns the handle as 'id', but channel_id or uploader_id should have the UCxxx format
    const properChannelId = channelData.channel_id || channelData.uploader_id || channelData.id;

    logger.info({ channelId: properChannelId, channelUrl: actualChannelUrl }, 'Storing handle URL for channel');

    // Use the sanitized folder name from the metadata (already fetched in the same yt-dlp call)
    // Fall back to uploader if folder_name wasn't available
    const folderName = channelData.folder_name || channelData.uploader;

    // First, upsert the channel so it exists in the database
    // We'll update auto_download_enabled_tabs after detecting available tabs
    const savedChannel = await this.upsertChannel({
      id: properChannelId,
      title: channelData.title,
      description: channelData.description,
      uploader: channelData.uploader,
      url: actualChannelUrl,  // Store the actual handle URL for display
      folder_name: folderName,
    }, enableChannel, null, initialSettings);

    // Now process thumbnail using the proper channel ID (uses metadata URL, falls back to yt-dlp)
    logger.info('Processing channel thumbnail');
    await channelThumbnails.processChannelThumbnail(channelData, properChannelId, channelUrl);
    logger.info('Channel thumbnail processed successfully');

    // When skipTabDetection is true (e.g. bulk import), leave available_tabs as null
    // so the frontend's lazy-load system detects tabs on first channel page visit.
    let tabResult = null;
    if (!skipTabDetection) {
      tabResult = await tabManager.detectAndSaveChannelTabs(properChannelId);
    }

    if (emitMessage) {
      logger.debug('Channel data fetched, emitting update message');
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'channel',
        'channelsUpdated',
        { text: 'Channel Updated' }
      );
    }

    return {
      id: properChannelId,
      uploader: channelData.uploader,
      uploader_id: channelData.uploader_id || properChannelId,
      title: channelData.title,
      description: channelData.description,
      url: channelUrl,
      // The row may pre-date this call (matched by channel_id under a
      // different URL), so report its actual enabled state, not enableChannel.
      enabled: !!savedChannel?.enabled,
      auto_download_enabled_tabs: tabResult?.autoDownloadEnabledTabs || 'video',
      available_tabs: tabResult?.availableTabs?.join(',') || null,
      sub_folder: GLOBAL_DEFAULT_SENTINEL,
      video_quality: null,
    };
  }
}

module.exports = new ChannelProvisioning();
