const Channel = require('../models/channel');
const configModule = require('./configModule');
const channelSettingsModule = require('./channelSettingsModule');
const { buildOutputTemplate, buildThumbnailTemplate } = require('./filesystem');

/**
 * Encapsulates channel filter settings for download filtering
 */
class ChannelFilterConfig {
  constructor(minDuration = null, maxDuration = null, titleFilterRegex = null, audioFormat = null, skipVideoFolder = false) {
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
    this.titleFilterRegex = titleFilterRegex;
    this.audioFormat = audioFormat;
    this.skipVideoFolder = !!skipVideoFolder;
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
      regex: this.titleFilterRegex,
      audio: this.audioFormat,
      skipVF: this.skipVideoFolder
    });
  }

  /**
   * Check if any filters are set
   * @returns {boolean} - True if at least one filter is configured
   */
  hasFilters() {
    return this.minDuration !== null ||
           this.maxDuration !== null ||
           this.titleFilterRegex !== null ||
           this.audioFormat !== null ||
           this.skipVideoFolder;
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
      channel.title_filter_regex,
      channel.audio_format,
      channel.skip_video_folder
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
        'title_filter_regex',
        'audio_format',
        'skip_video_folder'
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

      // Resolve effective subfolder (handles ##USE_GLOBAL_DEFAULT## -> default, NULL -> root)
      const subFolder = channelSettingsModule.resolveEffectiveSubfolder(channel.sub_folder);

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
    return buildOutputTemplate(configModule.directoryPath, subFolder);
  }

  /**
   * Build thumbnail output path template for a channel group
   * @param {string|null} subFolder - Subfolder name or null
   * @returns {string} - Thumbnail path template for yt-dlp
   */
  buildThumbnailPathTemplate(subFolder) {
    return buildThumbnailTemplate(configModule.directoryPath, subFolder);
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
      // Resolve effective subfolder (handles ##USE_GLOBAL_DEFAULT## -> default, NULL -> root)
      const subFolder = channelSettingsModule.resolveEffectiveSubfolder(channel.sub_folder);

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
