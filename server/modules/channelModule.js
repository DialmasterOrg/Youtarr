const { TAB_TYPES } = require('./tabsUtils');
const fetchRegistry = require('./channel/fetchRegistry');
const channelIdentity = require('./channel/channelIdentity');
const channelThumbnails = require('./channel/channelThumbnails');
const channelMetadataFetcher = require('./channel/channelMetadataFetcher');
const tabManager = require('./channel/tabManager');
const channelProvisioning = require('./channel/channelProvisioning');
const channelCatalog = require('./channel/channelCatalog');
const autoDownloadScheduler = require('./channel/autoDownloadScheduler');
const channelVideosService = require('./channel/channelVideosService');

class ChannelModule {
  constructor() {
    autoDownloadScheduler.scheduleTask();
    autoDownloadScheduler.subscribe();
    channelCatalog.populateMissingChannelInfo();
    channelCatalog.normalizeChannelUrls();
  }

  isFetchInProgress(channelId, tabType = null) {
    return fetchRegistry.isFetchInProgress(channelId, tabType);
  }

  /**
   * Build a canonical YouTube channel URL from a channel-like ID.
   * Handles uploads playlist IDs (UU...) by converting to UC...
   * @param {string} channelId
   * @returns {string}
   */
  resolveChannelUrlFromId(channelId) {
    return channelIdentity.resolveChannelUrlFromId(channelId);
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
    return channelMetadataFetcher.resolveChannelFolderName(channel);
  }

  /**
   * Insert or update channel in database
   * @param {Object} channelData - Channel data to save
   * @param {boolean} enabled - Whether the channel should be enabled (default: false)
   * @param {string|null} autoDownloadEnabledTabs - Comma-separated list of enabled tabs (default: null, uses model default)
   * @param {Object} initialSettings - Optional settings to apply only when creating a new channel (e.g., video_quality, sub_folder, default_rating)
   * @returns {Promise<Object>} - Saved channel record
   */
  async upsertChannel(channelData, enabled = false, autoDownloadEnabledTabs = null, initialSettings = {}) {
    return channelProvisioning.upsertChannel(channelData, enabled, autoDownloadEnabledTabs, initialSettings);
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
  async getChannelInfo(channelUrlOrId, emitMessage = true, enableChannel = false, initialSettings = {}, options = {}) {
    return channelProvisioning.getChannelInfo(channelUrlOrId, emitMessage, enableChannel, initialSettings, options);
  }

  /**
   * Backfill poster.jpg files for existing channel folders.
   * Copies channelthumb to each channel's folder as poster.jpg if it doesn't exist.
   * @param {Array} channels - Array of channel database records
   * @returns {Promise<void>}
   */
  async backfillChannelPosters(channels) {
    return channelThumbnails.backfillChannelPosters(channels);
  }

  /**
   * Retrieve channels in a paginated format with optional filtering/sorting
   * @param {Object} options - Pagination and filtering options
   * @param {number|string} [options.page=1] - Page number (1-indexed)
   * @param {number|string} [options.pageSize=50] - Number of items per page
   * @param {string} [options.searchTerm=''] - Search term for uploader or URL
   * @param {string} [options.sortBy='name'] - Sort field ('name'|'uploader'|'createdAt')
   * @param {string} [options.sortOrder='asc'] - Sort direction ('asc'|'desc')
   * @returns {Promise<{channels: Array, total: number, page: number, pageSize: number, totalPages: number}>}
   */
  async getChannelsPaginated(options = {}) {
    return channelCatalog.getChannelsPaginated(options);
  }

  /**
   * Update the list of enabled channels in the database.
   * Enables new channels, disables removed ones, and fetches metadata for new additions.
   * @param {Array<string>} channelUrls - Array of channel URLs to enable
   * @returns {Promise<void>}
   */
  async writeChannels(channelUrls) {
    return channelCatalog.writeChannels(channelUrls);
  }

  /**
   * Apply incremental channel updates using explicit add/remove lists.
   * Enables new channels and disables removed ones without needing the full list.
   * @param {Object} options
   * @param {Array<string|{url: string, channel_id?: string}>} [options.enableUrls=[]] - URLs or objects with URL and channel_id to enable
   * @param {Array<string>} [options.disableUrls=[]] - Channel URLs to disable
   * @returns {Promise<void>}
   */
  async updateChannelsByDelta(delta = {}) {
    return channelCatalog.updateChannelsByDelta(delta);
  }

  /**
   * Subscribe to configuration changes.
   * Reschedules tasks when configuration is updated.
   * @returns {void}
   */
  subscribe() {
    return autoDownloadScheduler.subscribe();
  }

  /**
   * Build the list of yt-dlp target URLs for all enabled channels, one per
   * enabled tab (video/short/livestream). Empty when nothing is downloadable.
   * @returns {Promise<string[]>}
   */
  async getEnabledChannelDownloadUrls() {
    return autoDownloadScheduler.getEnabledChannelDownloadUrls();
  }

  /**
   * Generate a temporary file with enabled channel URLs for yt-dlp
   * Respects the auto_download_enabled_tabs column to generate URLs for each enabled tab type
   * @returns {Promise<string>} - Path to the temporary file
   */
  async generateChannelsFile() {
    return autoDownloadScheduler.generateChannelsFile();
  }

  /**
   * Get available tabs for a channel.
   * Returns cached result if available (filtered through hidden_tabs),
   * otherwise detects tabs now via yt-dlp probing.
   * @param {string} channelId - Channel ID to get tabs for
   * @returns {Promise<Object>} - Object with availableTabs array (effective set)
   */
  async getChannelAvailableTabs(channelId) {
    return tabManager.getChannelAvailableTabs(channelId);
  }

  /**
   * Update the auto download setting for a specific tab type for a channel
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Tab type ('videos', 'shorts', or 'streams')
   * @param {boolean} enabled - Whether to enable auto downloads for this tab
   */
  async updateAutoDownloadForTab(channelId, tabType, enabled) {
    return tabManager.updateAutoDownloadForTab(channelId, tabType, enabled);
  }

  /**
   * Force a fresh yt-dlp probe of a channel's tabs, bypassing any cached
   * available_tabs value.
   * @param {string} channelId - Channel ID to re-detect
   * @returns {Promise<{availableTabs: string[], detectedTabs: string[], hiddenTabs: string[], autoDownloadEnabledTabs: string}>}
   */
  async redetectChannelTabs(channelId) {
    return tabManager.redetectChannelTabs(channelId);
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
    return channelVideosService.getChannelVideos(channelId, page, pageSize, downloadedFilter, searchQuery, sortBy, sortOrder, tabType, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter, watchedFilter);
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
    return channelVideosService.fetchAllChannelVideos(channelId, requestedPage, requestedPageSize, downloadedFilter, tabType);
  }
}

module.exports = new ChannelModule();
