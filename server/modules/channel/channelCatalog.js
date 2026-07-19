const { Op, fn, col, where } = require('sequelize');
const logger = require('../../logger');
const Channel = require('../../models/channel');
const channelMappers = require('./channelMappers');
const channelThumbnails = require('./channelThumbnails');
const channelProvisioning = require('./channelProvisioning');

const SUB_FOLDER_DEFAULT_KEY = '__default__';

class ChannelCatalog {
  /**
   * Populate missing channel information for all enabled channels.
   * Fetches metadata from YouTube for channels that don't have complete data.
   * @returns {Promise<void>}
   */
  async populateMissingChannelInfo() {
    const channelPromises = await this.readChannels();

    for (let channelObj of channelPromises) {
      const foundChannel = await Channel.findOne({
        where: { url: channelObj.url },
      });

      if (!foundChannel || !foundChannel.uploader) {
        await channelProvisioning.getChannelInfo(channelObj.url);
      }
    }
  }

  /**
   * Normalize channel URLs at startup.
   * This is a lightweight check that only logs potential issues.
   * The actual URL updates happen lazily when channels are accessed.
   * @returns {Promise<void>}
   */
  async normalizeChannelUrls() {
    try {
      logger.info('Checking for channels with potentially stale handle URLs');

      // Find all enabled channels with channel_id and handle URLs
      const channels = await Channel.findAll({
        where: {
          enabled: true,
          channel_id: { [Op.ne]: null }
        },
        attributes: ['id', 'channel_id', 'url', 'title', 'lastFetchedByTab']
      });

      let handleUrlCount = 0;
      for (const channel of channels) {
        // Check if URL looks like a handle URL
        if (channel.url && channel.url.includes('@')) {
          handleUrlCount++;
          // Get the most recent fetch across all tabs
          let mostRecentFetch = null;
          if (channel.lastFetchedByTab) {
            try {
              const lastFetchedByTab = JSON.parse(channel.lastFetchedByTab);
              const timestamps = Object.values(lastFetchedByTab).filter(t => t !== null);
              if (timestamps.length > 0) {
                mostRecentFetch = new Date(Math.max(...timestamps.map(t => new Date(t).getTime())));
              }
            } catch (error) {
              // Ignore parse errors
            }
          }
          const daysSinceUpdate = mostRecentFetch
            ? Math.floor((Date.now() - mostRecentFetch.getTime()) / (1000 * 60 * 60 * 24))
            : 'never';
          logger.info({
            channelTitle: channel.title,
            channelUrl: channel.url,
            lastUpdated: daysSinceUpdate === 'never' ? 'never' : `${daysSinceUpdate} days ago`
          }, 'Channel uses handle URL');
        }
      }

      if (handleUrlCount > 0) {
        logger.info({ handleUrlCount }, 'Found channels with handle URLs - will be updated automatically when accessed');
      } else {
        logger.info('No channels with handle URLs found');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error during channel URL check');
    }
  }

  /**
   * Read all enabled channels from the database.
   * Also backfills poster.jpg files for existing channel folders.
   * @returns {Promise<Array>} - Array of channel objects with url, uploader, channel_id, auto_download_enabled_tabs, available_tabs, sub_folder, and video_quality
   */
  async readChannels() {
    try {
      const channels = await Channel.findAll({
        where: { enabled: true },
      });

      // Backfill poster.jpg for existing channel folders
      channelThumbnails.backfillChannelPosters(channels);

      return channels.map((channel) => channelMappers.mapChannelListEntry(channel));
    } catch (err) {
      logger.error({ err }, 'Error reading channels from database');
      return [];
    }
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
  async getChannelsPaginated({
    page = 1,
    pageSize = 50,
    searchTerm = '',
    sortBy = 'name',
    sortOrder = 'asc',
    subFolder = null,
  } = {}) {
    const parsedPage = parseInt(page, 10);
    const parsedPageSize = parseInt(pageSize, 10);
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safePageSize = Number.isFinite(parsedPageSize)
      ? Math.min(Math.max(parsedPageSize, 1), 100)
      : 50;
    const offset = (safePage - 1) * safePageSize;

    const whereClause = { enabled: true };
    const normalizedSearch = typeof searchTerm === 'string' ? searchTerm.trim().toLowerCase() : '';
    if (normalizedSearch) {
      const escapedSearch = normalizedSearch.replace(/[\\%_]/g, '\\$&');
      const likeValue = `%${escapedSearch}%`;
      whereClause[Op.or] = [
        where(fn('LOWER', col('uploader')), { [Op.like]: likeValue }),
        where(fn('LOWER', col('url')), { [Op.like]: likeValue }),
      ];
    }

    const normalizedSubFolder = typeof subFolder === 'string' ? subFolder.trim() : '';
    if (normalizedSubFolder) {
      if (normalizedSubFolder === SUB_FOLDER_DEFAULT_KEY) {
        whereClause.sub_folder = {
          [Op.or]: [null, ''],
        };
      } else {
        whereClause.sub_folder = normalizedSubFolder;
      }
    }

    const sortMap = {
      name: 'uploader',
      uploader: 'uploader',
      createdat: 'createdAt',
    };
    const normalizedSortKey = typeof sortBy === 'string' ? sortBy.toLowerCase() : 'name';
    const sortColumn = sortMap[normalizedSortKey] || 'uploader';
    const direction = typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    try {
      const { rows, count } = await Channel.findAndCountAll({
        where: whereClause,
        limit: safePageSize,
        offset,
        order: [[sortColumn, direction]],
      });

      const distinctSubFolders = await Channel.findAll({
        attributes: [[fn('DISTINCT', col('sub_folder')), 'sub_folder']],
        where: { enabled: true },
        raw: true,
      });

      channelThumbnails.backfillChannelPosters(rows);

      const totalPages = count > 0 ? Math.ceil(count / safePageSize) : 0;
      const normalizedSubFolders = distinctSubFolders
        .map((entry) => entry.sub_folder)
        .map((value) => (value === null || value === '' ? SUB_FOLDER_DEFAULT_KEY : value))
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => {
          if (a === SUB_FOLDER_DEFAULT_KEY) return -1;
          if (b === SUB_FOLDER_DEFAULT_KEY) return 1;
          return a.localeCompare(b);
        });

      return {
        channels: rows.map((channel) => channelMappers.mapChannelListEntry(channel)),
        total: count,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
        subFolders: normalizedSubFolders,
      };
    } catch (err) {
      logger.error({ err }, 'Error retrieving paginated channels');
      return {
        channels: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        totalPages: 0,
        subFolders: [],
      };
    }
  }

  /**
   * Update the list of enabled channels in the database.
   * Enables new channels, disables removed ones, and fetches metadata for new additions.
   * @param {Array<string>} channelUrls - Array of channel URLs to enable
   * @returns {Promise<void>}
   */
  async writeChannels(channelUrls) {
    try {
      const desiredUrls = Array.from(
        new Set((channelUrls || []).map((u) => (u || '').trim()).filter(Boolean))
      );

      const existing = await Channel.findAll({ attributes: ['url', 'enabled', 'channel_id'] });
      const existingMap = new Map(existing.map((c) => [c.url, c.enabled]));

      const toEnable = desiredUrls.filter((url) => existingMap.get(url) !== true);

      const desiredSet = new Set(desiredUrls);
      const toDisable = existing
        .filter((c) => c.enabled === true && !desiredSet.has(c.url))
        .map((c) => c.url);

      for (const url of toEnable) {
        // Pass enableChannel=true when getting channel info for new/disabled channels
        const channelInfo = await channelProvisioning.getChannelInfo(url, false, true);
        // Still update in case it already existed but was disabled
        // Use channel_id to ensure we update the correct channel regardless of URL format
        if (channelInfo && channelInfo.id) {
          await Channel.update({ enabled: true }, { where: { channel_id: channelInfo.id } });
        }
      }

      if (toDisable.length > 0) {
        await Channel.update({ enabled: false }, { where: { url: toDisable } });
      }
    } catch (err) {
      logger.error({ err }, 'Error updating channels in database');
    }
  }

  /**
   * Apply incremental channel updates using explicit add/remove lists.
   * Enables new channels and disables removed ones without needing the full list.
   * @param {Object} options
   * @param {Array<string|{url: string, channel_id?: string}>} [options.enableUrls=[]] - URLs or objects with URL and channel_id to enable
   * @param {Array<string>} [options.disableUrls=[]] - Channel URLs to disable
   * @returns {Promise<void>}
   */
  async updateChannelsByDelta({ enableUrls = [], disableUrls = [] } = {}) {
    // Handle both string URLs and objects with url/channel_id
    const toEnable = (enableUrls || []).map((item) => {
      if (typeof item === 'string') {
        return { url: item.trim(), channel_id: null };
      }
      return {
        url: (item.url || '').trim(),
        channel_id: item.channel_id || null
      };
    }).filter(item => item.url);

    const toDisable = Array.from(
      new Set((disableUrls || []).map((u) => (u || '').trim()).filter(Boolean))
    );

    try {
      for (const { url, channel_id } of toEnable) {
        let foundChannel = null;

        // First try to find by URL
        if (url) {
          foundChannel = await Channel.findOne({ where: { url } });
        }

        // If not found by URL and we have a channel_id, try that
        if (!foundChannel && channel_id) {
          foundChannel = await Channel.findOne({ where: { channel_id } });
        }

        // If still not found, as a last resort fetch from YouTube
        // This should rarely happen - only if channel was somehow deleted or never added
        if (!foundChannel) {
          logger.warn({ url, channel_id }, 'Channel not found in database, fetching from YouTube');
          const channelInfo = await channelProvisioning.getChannelInfo(url, false, true);
          if (channelInfo && channelInfo.id) {
            await Channel.update({ enabled: true }, { where: { channel_id: channelInfo.id } });
          }
        } else {
          // Channel exists, just enable it
          await foundChannel.update({ enabled: true });
          logger.info({ url, channel_id: foundChannel.channel_id }, 'Enabled existing channel');
        }
      }

      if (toDisable.length > 0) {
        await Channel.update({ enabled: false }, { where: { url: toDisable } });
      }
    } catch (err) {
      logger.error({ err }, 'Error applying channel delta updates');
      throw err;
    }
  }
}

module.exports = new ChannelCatalog();
