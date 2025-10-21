const Channel = require('../models/channel');
const configModule = require('./configModule');
const path = require('path');

/**
 * Module for grouping channels by their download settings
 * Handles per-channel quality and subfolder organization
 */
class ChannelDownloadGrouper {
  /**
   * Get all enabled channels with their settings
   * @returns {Promise<Array>} - Array of channel records with settings
   */
  async getEnabledChannelsWithSettings() {
    const channels = await Channel.findAll({
      where: { enabled: true },
      attributes: ['channel_id', 'uploader', 'sub_folder', 'video_quality', 'auto_download_enabled_tabs']
    });

    return channels;
  }

  /**
   * Group channels by quality and subfolder settings for batch downloads
   * Channels with the same quality+subfolder can be downloaded together
   * @param {Array} channels - Array of channel records
   * @param {string} globalQuality - Global quality setting (fallback)
   * @returns {Array} - Array of groups, each with { quality, subfolder, channels }
   */
  groupChannels(channels, globalQuality) {
    const groups = new Map();

    for (const channel of channels) {
      // Determine effective quality (channel override or global)
      const quality = channel.video_quality || globalQuality || '1080';

      // Determine subfolder (null if not set)
      const subFolder = channel.sub_folder ? channel.sub_folder.trim() : null;

      // Create group key
      const groupKey = `${quality}|${subFolder || 'root'}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          quality,
          subFolder,
          channels: []
        });
      }

      groups.get(groupKey).channels.push(channel);
    }

    return Array.from(groups.values());
  }

  /**
   * Build output path template for a channel group
   * @param {string|null} subFolder - Subfolder name or null
   * @returns {string} - Path template for yt-dlp -o argument
   */
  buildOutputPathTemplate(subFolder) {
    const baseOutputPath = configModule.directoryPath;
    const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';
    const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s - %(id)s`;
    const VIDEO_FILE_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s  [%(id)s].%(ext)s`;

    if (subFolder) {
      // Include subfolder in path with __ prefix for namespace safety
      const safeSubFolder = `__${subFolder}`;
      return path.join(baseOutputPath, safeSubFolder, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
    } else {
      // Root level (current behavior)
      return path.join(baseOutputPath, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
    }
  }

  /**
   * Build thumbnail output path template for a channel group
   * @param {string|null} subFolder - Subfolder name or null
   * @returns {string} - Thumbnail path template for yt-dlp
   */
  buildThumbnailPathTemplate(subFolder) {
    const baseOutputPath = configModule.directoryPath;
    const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';
    const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s - %(id)s`;

    if (subFolder) {
      // Include subfolder in path with __ prefix for namespace safety
      const safeSubFolder = `__${subFolder}`;
      return path.join(baseOutputPath, safeSubFolder, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, 'poster');
    } else {
      return path.join(baseOutputPath, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, 'poster');
    }
  }

  /**
   * Generate download groups for batch channel downloads
   * @param {string} overrideQuality - Optional quality override for this download run
   * @returns {Promise<Array>} - Array of download groups with settings
   */
  async generateDownloadGroups(overrideQuality = null) {
    const channels = await this.getEnabledChannelsWithSettings();
    const globalQuality = overrideQuality || configModule.config.preferredResolution || '1080';

    // If override quality is specified, use it for ALL channels (ignore per-channel settings)
    if (overrideQuality) {
      const groups = this.groupChannelsBySubfolderOnly(channels);
      return groups.map(group => ({
        ...group,
        quality: overrideQuality,
        outputPath: this.buildOutputPathTemplate(group.subFolder),
        thumbnailPath: this.buildThumbnailPathTemplate(group.subFolder)
      }));
    }

    // Otherwise, respect per-channel quality settings
    const groups = this.groupChannels(channels, globalQuality);

    return groups.map(group => ({
      ...group,
      outputPath: this.buildOutputPathTemplate(group.subFolder),
      thumbnailPath: this.buildThumbnailPathTemplate(group.subFolder)
    }));
  }

  /**
   * Group channels only by subfolder (for use with quality override)
   * @param {Array} channels - Array of channel records
   * @returns {Array} - Array of groups by subfolder
   */
  groupChannelsBySubfolderOnly(channels) {
    const groups = new Map();

    for (const channel of channels) {
      const subFolder = channel.sub_folder ? channel.sub_folder.trim() : null;
      const groupKey = subFolder || 'root';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          subFolder,
          channels: []
        });
      }

      groups.get(groupKey).channels.push(channel);
    }

    return Array.from(groups.values());
  }
}

module.exports = new ChannelDownloadGrouper();
