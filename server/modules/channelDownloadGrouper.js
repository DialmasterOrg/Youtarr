const Channel = require('../models/channel');
const configModule = require('./configModule');
const path = require('path');

/**
 * Encapsulates channel filter settings for download filtering
 */
class ChannelFilterConfig {
  constructor(minDuration = null, maxDuration = null, titleFilterRegex = null) {
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
    this.titleFilterRegex = titleFilterRegex;
  }

  /**
   * Build a unique key for grouping channels with identical filters
   * Uses JSON.stringify to avoid collisions with sentinel values
   * @returns {string} - Unique key representing this filter configuration
   */
  buildFilterKey() {
    // Use JSON to safely encode null values without collision risk
    return JSON.stringify({
      min: this.minDuration,
      max: this.maxDuration,
      regex: this.titleFilterRegex
    });
  }

  /**
   * Check if any filters are set
   * @returns {boolean} - True if at least one filter is configured
   */
  hasFilters() {
    return this.minDuration !== null || this.maxDuration !== null || this.titleFilterRegex !== null;
  }

  /**
   * Create a ChannelFilterConfig from a channel record
   * @param {Object} channel - Channel record from database
   * @returns {ChannelFilterConfig} - New filter config instance
   */
  static fromChannel(channel) {
    return new ChannelFilterConfig(
      channel.min_duration,
      channel.max_duration,
      channel.title_filter_regex
    );
  }
}

/**
 * Module for grouping channels by their download settings
 * Handles per-channel quality, subfolder organization, and download filters
 */
class ChannelDownloadGrouper {
  /**
   * Get all enabled channels with their settings
   * @returns {Promise<Array>} - Array of channel records with settings
   */
  async getEnabledChannelsWithSettings() {
    const channels = await Channel.findAll({
      where: { enabled: true },
      attributes: [
        'channel_id',
        'uploader',
        'sub_folder',
        'video_quality',
        'auto_download_enabled_tabs',
        'min_duration',
        'max_duration',
        'title_filter_regex'
      ]
    });

    return channels;
  }

  /**
   * Group channels by quality, subfolder, and filter settings for batch downloads
   * Channels with identical settings can be downloaded together in a single yt-dlp invocation
   * @param {Array} channels - Array of channel records
   * @param {string} globalQuality - Global quality setting (fallback)
   * @returns {Array} - Array of groups, each with { quality, subfolder, filterConfig, channels }
   */
  groupChannels(channels, globalQuality) {
    const groups = new Map();

    for (const channel of channels) {
      // Determine effective quality (channel override or global)
      const quality = channel.video_quality || globalQuality || '1080';

      // Determine subfolder (null if not set)
      const subFolder = channel.sub_folder ? channel.sub_folder.trim() : null;

      // Create filter config for this channel
      const filterConfig = ChannelFilterConfig.fromChannel(channel);

      // Create group key including filter settings
      const groupKey = `${quality}|${subFolder || 'root'}|${filterConfig.buildFilterKey()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          quality,
          subFolder,
          filterConfig,
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
   * Group channels by subfolder and filters (for use with quality override)
   * Quality override should not affect duration/title filters
   * @param {Array} channels - Array of channel records
   * @returns {Array} - Array of groups by subfolder and filter config
   */
  groupChannelsBySubfolderOnly(channels) {
    const groups = new Map();

    for (const channel of channels) {
      const subFolder = channel.sub_folder ? channel.sub_folder.trim() : null;

      // Create filter config for this channel (filters still apply with quality override)
      const filterConfig = ChannelFilterConfig.fromChannel(channel);

      // Group by both subfolder and filter settings
      const groupKey = `${subFolder || 'root'}|${filterConfig.buildFilterKey()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          subFolder,
          filterConfig,
          channels: []
        });
      }

      groups.get(groupKey).channels.push(channel);
    }

    return Array.from(groups.values());
  }
}

const grouperInstance = new ChannelDownloadGrouper();
grouperInstance.ChannelFilterConfig = ChannelFilterConfig;

module.exports = grouperInstance;
