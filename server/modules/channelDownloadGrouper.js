const Channel = require('../models/channel');
const configModule = require('./configModule');
const channelSettingsModule = require('./channelSettingsModule');
const { buildOutputTemplate, buildThumbnailTemplate } = require('./filesystem');
const downloadSettingsResolver = require('./download/downloadSettingsResolver');
const titleShowStore = require('./tvShows/titleShowStore');

/**
 * Encapsulates channel filter settings for download filtering
 */
class ChannelFilterConfig {
  /**
   * @param {Array<{filterRegex: string, excludeRegexes: string[]}>|null} [showFilters] - One per title show
   *   when the channel downloads only its title shows
   */
  constructor(minDuration = null, maxDuration = null, titleFilterRegex = null, audioFormat = null, skipVideoFolder = false, showFilters = null) {
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
    this.titleFilterRegex = titleFilterRegex;
    this.audioFormat = audioFormat;
    this.skipVideoFolder = !!skipVideoFolder;
    this.showFilters = showFilters && showFilters.length > 0 ? showFilters : null;
  }

  /**
   * Build a unique key for grouping channels with identical filters
   * Uses JSON.stringify to avoid collisions with sentinel values
   * @returns {string} - Unique key representing this filter configuration
   */
  buildFilterKey() {
    // Use JSON to safely encode null values without collision risk
    const key = {
      min: this.minDuration,
      max: this.maxDuration,
      regex: this.titleFilterRegex,
      audio: this.audioFormat,
      skipVF: this.skipVideoFolder
    };
    if (this.showFilters) key.shows = this.showFilters;
    return JSON.stringify(key);
  }

  /**
   * Check if any grouping criteria (filters or structural settings) are set.
   * Includes duration/title filters and structural options like skipVideoFolder
   * that affect how downloads are organized on disk.
   * @returns {boolean} - True if at least one criterion is configured
   */
  hasGroupingCriteria() {
    return this.minDuration !== null ||
           this.maxDuration !== null ||
           this.titleFilterRegex !== null ||
           this.audioFormat !== null ||
           // skipVideoFolder affects download path structure, so channels with
           // different settings must be in separate download groups
           this.skipVideoFolder ||
           this.showFilters !== null;
  }

  /**
   * Create a ChannelFilterConfig from a channel record
   * @param {Object} channel - Channel record from database
   * @param {Object} [config] - Global config (defaults to configModule.config)
   * @param {Array<Object>|null} [showFilters] - The channel's title show filters; applied only when the
   *   channel downloads just its title shows
   * @returns {ChannelFilterConfig} - New filter config instance
   */
  static fromChannel(channel, config = configModule.config, showFilters = null) {
    return new ChannelFilterConfig(
      channel.min_duration,
      channel.max_duration,
      channel.title_filter_regex,
      channel.audio_format,
      downloadSettingsResolver.resolveSkipVideoFolder({ channel, config }),
      channel.tv_show_only_downloads ? showFilters : null
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
        'skip_video_folder',
        'tv_show_only_downloads'
      ]
    });

    return channels;
  }

  /**
   * Group channels by quality, subfolder, and filter settings for batch downloads
   * Channels with identical settings can be downloaded together in a single yt-dlp invocation
   * @param {Array} channels - Array of channel records
   * @param {string} globalQuality - Global quality setting (fallback)
   * @param {Map<string, Array<Object>>} [showFilters] - Title show filters by channel id
   * @returns {Array} - Array of groups, each with { quality, subfolder, filterConfig, channels }
   */
  groupChannels(channels, globalQuality, showFilters = new Map()) {
    const groups = new Map();

    for (const channel of channels) {
      // Determine effective quality (channel override or global)
      const quality = channel.video_quality || globalQuality || '1080';

      // Resolve effective subfolder (handles ##USE_GLOBAL_DEFAULT## -> default, NULL -> root)
      const subFolder = channelSettingsModule.resolveEffectiveSubfolder(channel.sub_folder);

      // Create filter config for this channel
      const filterConfig = ChannelFilterConfig.fromChannel(channel, undefined, showFilters.get(channel.channel_id));

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
    const prefix = configModule.getConfig().videoFilenamePrefix;
    return buildOutputTemplate(configModule.directoryPath, subFolder, prefix);
  }

  /**
   * Build thumbnail output path template for a channel group
   * @param {string|null} subFolder - Subfolder name or null
   * @returns {string} - Thumbnail path template for yt-dlp
   */
  buildThumbnailPathTemplate(subFolder) {
    const prefix = configModule.getConfig().videoFilenamePrefix;
    return buildThumbnailTemplate(configModule.directoryPath, subFolder, prefix);
  }

  /**
   * Generate download groups for batch channel downloads
   * @param {string} overrideQuality - Optional quality override for this download run
   * @returns {Promise<Array>} - Array of download groups with settings
   */
  async generateDownloadGroups(overrideQuality = null) {
    const channels = await this.getEnabledChannelsWithSettings();
    const globalQuality = overrideQuality || configModule.config.preferredResolution || '1080';
    // Channels downloading only their title shows get one match filter per show.
    const showOnly = channels.filter((channel) => channel.tv_show_only_downloads).map((channel) => channel.channel_id);
    const showFilters = showOnly.length > 0 ? await titleShowStore.showFiltersByChannel(showOnly) : new Map();

    // If override quality is specified, use it for ALL channels (ignore per-channel settings)
    if (overrideQuality) {
      const groups = this.groupChannelsBySubfolderOnly(channels, showFilters);
      return groups.map(group => ({
        ...group,
        quality: overrideQuality,
        outputPath: this.buildOutputPathTemplate(group.subFolder),
        thumbnailPath: this.buildThumbnailPathTemplate(group.subFolder)
      }));
    }

    // Otherwise, respect per-channel quality settings
    const groups = this.groupChannels(channels, globalQuality, showFilters);

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
   * @param {Map<string, Array<Object>>} [showFilters] - Title show filters by channel id
   * @returns {Array} - Array of groups by subfolder and filter config
   */
  groupChannelsBySubfolderOnly(channels, showFilters = new Map()) {
    const groups = new Map();

    for (const channel of channels) {
      // Resolve effective subfolder (handles ##USE_GLOBAL_DEFAULT## -> default, NULL -> root)
      const subFolder = channelSettingsModule.resolveEffectiveSubfolder(channel.sub_folder);

      // Create filter config for this channel (filters still apply with quality override)
      const filterConfig = ChannelFilterConfig.fromChannel(channel, undefined, showFilters.get(channel.channel_id));

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
