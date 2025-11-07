const configModule = require('./configModule');
const downloadModule = require('./downloadModule');
const cron = require('node-cron');
const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const Channel = require('../models/channel');
const ChannelVideo = require('../models/channelvideo');
const MessageEmitter = require('./messageEmitter.js');
const { Op } = require('sequelize');
const fileCheckModule = require('./fileCheckModule');
const logger = require('../logger');

const { v4: uuidv4 } = require('uuid');
const { spawn, execSync } = require('child_process');

const TAB_TYPES = {
  VIDEOS: 'videos',
  SHORTS: 'shorts',
  LIVE: 'streams',
};

const MEDIA_TAB_TYPE_MAP = {
  'videos': 'video',
  'shorts': 'short',
  'streams': 'livestream',
};

class ChannelModule {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
    this.scheduleTask();
    this.subscribe();
    this.populateMissingChannelInfo();
    this.normalizeChannelUrls();
    // Track active fetch operations per channel to prevent concurrent fetches
    this.activeFetches = new Map();
  }

  /**
   * Get the last fetched timestamp for a specific tab type
   * @param {Object} channel - Channel database record
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @returns {Date|null} - Last fetched timestamp for the tab, or null if never fetched
   */
  getLastFetchedForTab(channel, mediaType) {
    if (!channel || !channel.lastFetchedByTab) {
      return null;
    }

    try {
      const lastFetchedByTab = JSON.parse(channel.lastFetchedByTab);
      const timestamp = lastFetchedByTab[mediaType];
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      logger.error({ err: error, channelId: channel?.channel_id, mediaType }, 'Error parsing lastFetchedByTab');
      return null;
    }
  }

  /**
   * Set the last fetched timestamp for a specific tab type
   * Uses atomic SQL UPDATE to prevent race conditions when multiple tabs fetch concurrently
   * @param {Object} channel - Channel database record
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @param {Date} timestamp - Timestamp to set
   * @returns {Promise<void>}
   */
  async setLastFetchedForTab(channel, mediaType, timestamp) {
    if (!channel || !channel.channel_id) return;

    const { sequelize } = require('../db');

    // Use atomic JSON_SET to update just this one key without read-modify-write race
    // COALESCE handles the case where lastFetchedByTab is NULL
    await sequelize.query(`
      UPDATE channels
      SET lastFetchedByTab = JSON_SET(
        COALESCE(lastFetchedByTab, '{}'),
        :jsonPath,
        :timestamp
      )
      WHERE channel_id = :channelId
    `, {
      replacements: {
        jsonPath: `$.${mediaType}`,
        timestamp: timestamp.toISOString(),
        channelId: channel.channel_id
      }
    });

    // Reload channel to sync in-memory state with database
    await channel.reload();
  }


  /**
   * Execute yt-dlp command with promise-based handling
   * @param {Array} args - Arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @param {boolean} useCookies - Whether to include cookies if configured
   * @returns {Promise<string>} - Output content if outputFile provided
   */
  async executeYtDlpCommand(args, outputFile = null, useCookies = true) {
    // Add cookies if configured and requested
    const configModule = require('./configModule');
    let finalArgs = [...args];
    if (useCookies) {
      const cookiesPath = configModule.getCookiesPath();
      if (cookiesPath) {
        finalArgs = ['--cookies', cookiesPath, ...args];
      }
    }

    const ytDlp = spawn('yt-dlp', finalArgs);

    if (outputFile) {
      const writeStream = fs.createWriteStream(outputFile);
      ytDlp.stdout.pipe(writeStream);
    }

    // Capture stderr to detect bot challenges
    let stderrBuffer = '';
    ytDlp.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    await new Promise((resolve, reject) => {
      ytDlp.on('exit', (code) => {
        // Check for bot detection
        if (stderrBuffer.includes('Sign in to confirm you\'re not a bot') ||
            stderrBuffer.includes('Sign in to confirm that you\'re not a bot')) {
          const error = new Error('Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.');
          error.code = 'COOKIES_REQUIRED';
          reject(error);
        } else if (code === 0) {
          resolve();
        } else {
          // Check for common error patterns in stderr
          let errorMessage = `yt-dlp exited with code ${code}`;
          let errorCode = 'YT_DLP_ERROR';

          if (stderrBuffer.includes('Unable to extract') ||
              stderrBuffer.includes('does not exist') ||
              stderrBuffer.includes('This channel does not exist') ||
              stderrBuffer.includes('ERROR: [youtube]')) {
            errorMessage = 'Channel not found or invalid URL';
            errorCode = 'CHANNEL_NOT_FOUND';
          } else if (stderrBuffer.includes('Unable to download webpage')) {
            errorMessage = 'Network error: Unable to connect to YouTube';
            errorCode = 'NETWORK_ERROR';
          }

          const error = new Error(errorMessage);
          error.code = errorCode;
          error.stderr = stderrBuffer;
          reject(error);
        }
      });
      ytDlp.on('error', reject);
    });

    if (outputFile) {
      const content = await fsPromises.readFile(outputFile, 'utf8');
      await fsPromises.unlink(outputFile);
      return content;
    }
  }

  /**
   * Execute file operation with temporary file handling
   * @param {string} prefix - Prefix for temp file name
   * @param {Function} callback - Async callback that receives the temp file path
   * @returns {Promise<any>} - Result from callback
   */
  async withTempFile(prefix, callback) {
    const tempFilePath = path.join(os.tmpdir(), `${prefix}-${uuidv4()}.json`);
    try {
      const result = await callback(tempFilePath);
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (err) {
        // Ignore cleanup errors
      }
      return result;
    } catch (error) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (err) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Find channel by URL or ID
   * @param {string} channelUrlOrId - Channel URL or ID
   * @returns {Promise<Object>} - Channel object with url and id
   */
  async findChannelByUrlOrId(channelUrlOrId) {
    let channelUrl = '';
    let channelId = '';
    let foundChannel = null;

    if (channelUrlOrId.startsWith('http')) {
      channelUrl = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { url: channelUrl },
      });
      if (foundChannel && foundChannel.channel_id) {
        channelId = foundChannel.channel_id;
        channelUrl = this.resolveChannelUrlFromId(channelId);
      }
    } else {
      channelId = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { channel_id: channelId },
      });
      channelUrl = this.resolveChannelUrlFromId(channelId);
    }

    return { foundChannel, channelUrl, channelId };
  }

  /**
   * Build a canonical YouTube channel URL from a channel-like ID.
   * Handles uploads playlist IDs (UU...) by converting to UC...
   * @param {string} channelId
   * @returns {string}
   */
  resolveChannelUrlFromId(channelId) {
    if (!channelId) return '';
    const normalizedId = channelId.startsWith('UU')
      ? `UC${channelId.substring(2)}`
      : channelId;
    return `https://www.youtube.com/channel/${normalizedId}`;
  }

  /**
   * Map channel database record to response format
   * @param {Object} channel - Channel database record
   * @returns {Object} - Formatted channel response
   */
  mapChannelToResponse(channel) {
    return {
      id: channel.channel_id,
      uploader: channel.uploader,
      uploader_id: channel.uploader_id || channel.channel_id,
      title: channel.title,
      description: channel.description,
      url: channel.url,
      auto_download_enabled_tabs: channel.auto_download_enabled_tabs ?? 'video',
      available_tabs: channel.available_tabs || null,
      sub_folder: channel.sub_folder || null,
      video_quality: channel.video_quality || null,
      min_duration: channel.min_duration || null,
      max_duration: channel.max_duration || null,
      title_filter_regex: channel.title_filter_regex || null,
    };
  }

  /**
   * Insert or update channel in database
   * @param {Object} channelData - Channel data to save
   * @param {boolean} enabled - Whether the channel should be enabled (default: false)
   * @param {string|null} autoDownloadEnabledTabs - Comma-separated list of enabled tabs (default: null, uses model default)
   * @returns {Promise<Object>} - Saved channel record
   */
  async upsertChannel(channelData, enabled = false, autoDownloadEnabledTabs = null) {
    // First, try to find by channel_id (preferred)
    let channel = await Channel.findOne({
      where: { channel_id: channelData.id }
    });

    // Prepare update data
    const updateData = {
      channel_id: channelData.id,
      title: channelData.title,
      description: channelData.description,
      uploader: channelData.uploader,
      url: channelData.url,
      enabled: enabled,
    };

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
      channel = await Channel.create(updateData);
    }

    return channel;
  }

  /**
   * Resize channel thumbnail image
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async resizeChannelThumbnail(channelId) {
    const imagePath = configModule.getImagePath();
    const realImagePath = path.join(
      imagePath,
      `channelthumb-${channelId}.jpg`
    );
    const smallImagePath = path.join(
      imagePath,
      `channelthumb-${channelId}-small.jpg`
    );

    try {
      execSync(
        `${configModule.ffmpegPath} -loglevel error -y -i "${realImagePath}" -vf "scale=iw*0.4:ih*0.4" -q:v 2 "${smallImagePath}"`,
        { stdio: 'inherit' }
      );
      await fsPromises.rename(smallImagePath, realImagePath);
      logger.debug({ channelId }, 'Channel thumbnail resized successfully');
    } catch (err) {
      logger.error({ err, channelId, imagePath: realImagePath }, 'Error resizing channel thumbnail');
    }
  }

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
        await this.getChannelInfo(channelObj.url);
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
   * Trigger automatic channel video downloads.
   * Called by cron scheduler based on configured frequency.
   * Skips execution if a Channel Downloads job is already running to prevent queue backup.
   * @returns {void}
   */
  channelAutoDownload() {
    logger.info({
      currentTime: new Date(),
      interval: configModule.getConfig().channelDownloadFrequency
    }, 'Running scheduled channel downloads');

    // Check if a Channel Downloads job is already running
    const jobModule = require('./jobModule');
    const jobs = jobModule.getAllJobs();
    // Check for both In Progress and Pending channel downloads to prevent accumulation
    // Note: Pending jobs are terminated on app restart, so they won't get stuck
    const hasRunningChannelDownload = Object.values(jobs).some(
      job => job.jobType.includes('Channel Downloads') &&
             (job.status === 'In Progress' || job.status === 'Pending')
    );

    if (hasRunningChannelDownload) {
      logger.warn('Skipping scheduled channel download - previous download still in progress');
      return;
    }

    downloadModule.doChannelDownloads();
  }

  /**
   * Fetch channel metadata from YouTube
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<Object>} - Channel metadata
   */
  async fetchChannelMetadata(channelUrl) {
    return await this.withTempFile('channel', async (outputFilePath) => {
      const content = await this.executeYtDlpCommand([
        '--skip-download',
        '--dump-single-json',
        '-4',
        '--playlist-end',
        '1',
        '--playlist-items',
        '0',
        channelUrl,
      ], outputFilePath);

      return JSON.parse(content);
    });
  }

  /**
   * Download channel thumbnail
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<void>}
   */
  async downloadChannelThumbnail(channelUrl) {
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(
      imageDir,
      'channelthumb-%(channel_id)s.jpg'
    );

    await this.executeYtDlpCommand([
      '--skip-download',
      '--write-thumbnail',
      '--playlist-end',
      '1',
      '--playlist-items',
      '0',
      '--convert-thumbnails',
      'jpg',
      '-o',
      `${imagePath}`,
      channelUrl,
    ]);
  }

  /**
   * Process channel thumbnail (download and resize)
   * @param {string} channelUrl - Channel URL
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async processChannelThumbnail(channelUrl, channelId) {
    await this.downloadChannelThumbnail(channelUrl);
    await this.resizeChannelThumbnail(channelId);
  }

  /**
   * Get channel information from database or fetch from YouTube.
   * First checks database, then fetches from YouTube if not found.
   * Also handles channel thumbnail download and processing.
   * @param {string} channelUrlOrId - YouTube channel URL or channel ID
   * @param {boolean} emitMessage - Whether to emit WebSocket update message
   * @param {boolean} enableChannel - Whether to enable the channel if it's new (default: false)
   * @returns {Promise<Object>} - Channel information object
   */
  async getChannelInfo(channelUrlOrId, emitMessage = true, enableChannel = false) {
    const { foundChannel, channelUrl } = await this.findChannelByUrlOrId(channelUrlOrId);

    if (foundChannel) {
      if (emitMessage) {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'channel',
          'channelsUpdated',
          { text: 'Channel Updated' }
        );
      }
      return this.mapChannelToResponse(foundChannel);
    }

    const channelData = await this.fetchChannelMetadata(channelUrl);

    // Extract the actual current handle URL from the response
    const actualChannelUrl = channelData.channel_url || channelData.url || channelUrl;

    // Get the proper channel ID - prefer channel_id, then uploader_id, fallback to id
    // yt-dlp sometimes returns the handle as 'id', but channel_id or uploader_id should have the UCxxx format
    const properChannelId = channelData.channel_id || channelData.uploader_id || channelData.id;

    logger.info({ channelId: properChannelId, channelUrl: actualChannelUrl }, 'Storing handle URL for channel');

    // First, upsert the channel so it exists in the database
    // We'll update auto_download_enabled_tabs after detecting available tabs
    await this.upsertChannel({
      id: properChannelId,
      title: channelData.title,
      description: channelData.description,
      uploader: channelData.uploader,
      url: actualChannelUrl,  // Store the actual handle URL for display
    }, enableChannel);

    // Now process thumbnail using the proper channel ID
    await this.processChannelThumbnail(channelUrl, properChannelId);

    // Detect available tabs to set smart default for auto_download_enabled_tabs
    // This ensures we don't default to 'video' for channels that only have shorts/streams
    let availableTabs = [];
    let autoDownloadEnabledTabs = 'video'; // Default fallback

    try {
      availableTabs = await this.getChannelAvailableTabs(properChannelId);

      // Determine smart default: prefer 'video' if it exists, otherwise use first available tab
      const TAB_TO_MEDIA_TYPE = {
        'videos': 'video',
        'shorts': 'short',
        'streams': 'livestream'
      };

      if (availableTabs.includes('videos')) {
        autoDownloadEnabledTabs = 'video';
      } else if (availableTabs.length > 0) {
        // Use first available tab as default
        const firstTab = availableTabs[0];
        autoDownloadEnabledTabs = TAB_TO_MEDIA_TYPE[firstTab] || 'video';
        logger.warn({ channelId: properChannelId, defaultTab: autoDownloadEnabledTabs }, 'Channel has no videos tab, using alternative default');
      } else {
        logger.warn({ channelId: properChannelId }, 'Channel has no detectable tabs, using default video tab');
      }

      // Update the channel with the determined auto_download_enabled_tabs
      await this.upsertChannel({
        id: properChannelId,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: actualChannelUrl,
      }, enableChannel, autoDownloadEnabledTabs);

    } catch (err) {
      logger.error({ err, channelId: properChannelId }, 'Error fetching tabs for channel');
      // Keep default 'video' on error
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
      auto_download_enabled_tabs: autoDownloadEnabledTabs,
      available_tabs: availableTabs.length > 0 ? availableTabs.join(',') : null,
      sub_folder: null,
      video_quality: null,
    };
  }

  /**
   * Schedule or reschedule the automatic download task.
   * Manages cron job based on configuration settings.
   * @returns {void}
   */
  scheduleTask() {
    const frequency = configModule.getConfig().channelDownloadFrequency;
    logger.info({ frequency }, 'Scheduling channel download task');

    if (this.task) {
      logger.info('Stopping old scheduled task');
      this.task.stop();
    }

    if (configModule.getConfig().channelAutoDownload) {
      this.task = cron.schedule(
        frequency,
        this.channelAutoDownload
      );
      logger.info({ frequency }, 'Auto-downloads enabled, task scheduled');
    } else {
      logger.info('Auto-downloads disabled');
    }
  }

  /**
   * Backfill poster.jpg files for existing channel folders.
   * Copies channelthumb to each channel's folder as poster.jpg if it doesn't exist.
   * @param {Array} channels - Array of channel database records
   * @returns {Promise<void>}
   */
  async backfillChannelPosters(channels) {
    try {
      const config = configModule.getConfig() || {};
      const shouldWriteChannelPosters = config.writeChannelPosters !== false;

      if (!shouldWriteChannelPosters) {
        return;
      }

      const outputDir = configModule.directoryPath;
      const imageDir = configModule.getImagePath();

      if (!outputDir || !fs.existsSync(outputDir)) {
        return;
      }

      for (const channel of channels) {
        if (!channel.channel_id || !channel.uploader) continue;

        const channelFolderPath = path.join(outputDir, channel.uploader);
        const channelPosterPath = path.join(channelFolderPath, 'poster.jpg');


        // Check if channel folder exists and poster.jpg doesn't exist
        if (fs.existsSync(channelFolderPath) && !fs.existsSync(channelPosterPath)) {
          const channelThumbPath = path.join(imageDir, `channelthumb-${channel.channel_id}.jpg`);


          if (fs.existsSync(channelThumbPath)) {
            try {
              fs.copySync(channelThumbPath, channelPosterPath);
            } catch (copyErr) {
              logger.error({ err: copyErr, channelUploader: channel.uploader }, 'Error backfilling poster for channel');
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error during channel poster backfill');
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
      this.backfillChannelPosters(channels);

      return channels.map((channel) => ({
        url: channel.url,
        uploader: channel.uploader || '',
        channel_id: channel.channel_id || '',
        auto_download_enabled_tabs: channel.auto_download_enabled_tabs ?? 'video',
        available_tabs: channel.available_tabs || null,
        sub_folder: channel.sub_folder || null,
        video_quality: channel.video_quality || null,
        min_duration: channel.min_duration || null,
        max_duration: channel.max_duration || null,
        title_filter_regex: channel.title_filter_regex || null,
      }));
    } catch (err) {
      logger.error({ err }, 'Error reading channels from database');
      return [];
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
        const channelInfo = await this.getChannelInfo(url, false, true);
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
   * Subscribe to configuration changes.
   * Reschedules tasks when configuration is updated.
   * @returns {void}
   */
  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }

  /**
   * Generate a temporary file with enabled channel URLs for yt-dlp
   * Respects the auto_download_enabled_tabs column to generate URLs for each enabled tab type
   * @returns {Promise<string>} - Path to the temporary file
   */
  async generateChannelsFile() {
    const tempFilePath = path.join(os.tmpdir(), `channels-temp-${uuidv4()}.txt`);
    try {
      const channels = await Channel.findAll({
        where: { enabled: true },
        attributes: ['channel_id', 'url', 'auto_download_enabled_tabs']
      });

      // Generate URLs for each channel, respecting their auto_download_enabled_tabs setting
      const urls = [];
      for (const channel of channels) {
        if (channel.channel_id) {
          const canonical = this.resolveChannelUrlFromId(channel.channel_id);

          // Parse the enabled tabs for this channel (empty string means no tabs enabled)
          const enabledTabs = (channel.auto_download_enabled_tabs ?? '')
            .split(',')
            .map(t => t.trim())
            .filter(tab => tab.length > 0);

          if (enabledTabs.length === 0) {
            // All tabs disabled for this channel, skip adding URLs
            continue;
          }

          // Generate a URL for each enabled tab type
          for (const tabType of enabledTabs) {
            // Map the media type back to tab type if needed
            // auto_download_enabled_tabs stores 'video', 'short', 'livestream'
            // but we need 'videos', 'shorts', 'streams' for URLs
            let tabUrl;
            switch (tabType) {
            case 'video':
              tabUrl = 'videos';
              break;
            case 'short':
              tabUrl = 'shorts';
              break;
            case 'livestream':
              tabUrl = 'streams';
              break;
            default:
              tabUrl = 'videos'; // fallback
            }

            urls.push(`${canonical}/${tabUrl}`);
          }
        } else {
          // Fallback for channels without channel_id
          urls.push(channel.url);
        }
      }

      // Check if we have any URLs to download
      if (urls.length === 0) {
        const error = new Error('No valid channel URLs to download - all enabled channels have no enabled tabs');
        logger.warn('No URLs generated for channel downloads - all enabled channels have disabled tabs');
        throw error;
      }

      await fsPromises.writeFile(tempFilePath, urls.join('\n'));

      return tempFilePath;
    } catch (err) {
      logger.error({ err }, 'Error generating channels file');
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (unlinkErr) {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * Insert or update videos in the database.
   * Creates new records or updates existing ones with latest metadata.
   * @param {Array<Object>} videos - Array of video objects to save
   * @param {string} channelId - Channel ID these videos belong to
   * @returns {Promise<void>}
   */
  async insertVideosIntoDb(videos, channelId, mediaType = 'video') {
    const syntheticBaseTime = Date.now();

    for (const [index, video] of videos.entries()) {
      const syntheticPublishedAt = video.publishedAt || new Date(syntheticBaseTime - index * 1000).toISOString();

      const [videoRecord, created] = await ChannelVideo.findOrCreate({
        where: {
          youtube_id: video.youtube_id,
          channel_id: channelId
        },
        defaults: {
          ...video,
          publishedAt: syntheticPublishedAt,
          channel_id: channelId,
          media_type: mediaType,
        },
      });

      if (!created) {
        const updates = {
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration,
          availability: video.availability || null,
          media_type: mediaType,
          live_status: video.live_status || null,
          publishedAt: video.publishedAt || syntheticPublishedAt,
        };

        await videoRecord.update(updates);
      }
    }
  }

  /**
   * Enrich videos with download status by checking Videos table and file existence
   * @param {Array} videos - Array of video objects
   * @param {boolean} checkFiles - Whether to check file existence for current page (default false)
   * @returns {Promise<Array>} - Videos with 'added' and 'removed' properties
   */
  async enrichVideosWithDownloadStatus(videos, checkFiles = false) {
    const Video = require('../models/video');
    const { sequelize, Sequelize } = require('../db');

    // Get all youtube IDs from the input videos
    const youtubeIds = videos.map(v => v.youtube_id || v.youtubeId);

    // Query Videos table for ALL matching IDs (regardless of removed status)
    const downloadedVideos = await Video.findAll({
      where: {
        youtubeId: youtubeIds
      },
      attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath']
    });

    // Create Maps for O(1) lookup of download status
    const downloadStatusMap = new Map();
    const videosToCheck = [];

    downloadedVideos.forEach(v => {
      downloadStatusMap.set(v.youtubeId, {
        id: v.id,
        added: true,
        removed: v.removed,
        fileSize: v.fileSize,
        filePath: v.filePath
      });

      // Collect videos that need file checking (only if checkFiles is true)
      if (checkFiles && v.filePath) {
        videosToCheck.push(v);
      }
    });

    // Check file existence for downloaded videos if requested
    if (checkFiles && videosToCheck.length > 0) {
      const { videos: checkedVideos, updates } = await fileCheckModule.checkVideoFiles(videosToCheck);

      // Update the download status map with file check results
      checkedVideos.forEach(v => {
        const status = downloadStatusMap.get(v.youtubeId);
        if (status) {
          status.removed = v.removed;
          status.fileSize = v.fileSize;
        }
      });

      // Apply database updates for file status changes
      if (updates.length > 0) {
        await fileCheckModule.applyVideoUpdates(sequelize, Sequelize, updates);
      }
    }

    return videos.map((video) => {
      const plainVideoObject = video.toJSON ? video.toJSON() : video;
      const videoId = plainVideoObject.youtube_id || plainVideoObject.youtubeId;
      const status = downloadStatusMap.get(videoId);

      if (status) {
        // Video exists in database
        plainVideoObject.added = true;
        plainVideoObject.removed = status.removed;
        plainVideoObject.fileSize = status.fileSize;
      } else {
        // Video never downloaded
        plainVideoObject.added = false;
        plainVideoObject.removed = false;
        plainVideoObject.fileSize = null;
      }

      // Replace thumbnail with template format (unless video is removed from YouTube)
      if (!plainVideoObject.youtube_removed) {
        plainVideoObject.thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }

      return plainVideoObject;
    });
  }

  /**
   * Fetch the newest videos for a channel from the database with search and sort.
   * Returns videos with download status.
   * @param {string} channelId - Channel ID to fetch videos for
   * @param {number} limit - Maximum number of videos to return (default 50)
   * @param {number} offset - Number of videos to skip (default 0)
   * @param {boolean} excludeDownloaded - Whether to exclude downloaded videos (default false)
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} sortBy - Field to sort by: 'date', 'title', 'duration', 'size' (default 'date')
   * @param {string} sortOrder - Sort order: 'asc' or 'desc' (default 'desc')
   * @param {boolean} checkFiles - Whether to check file existence for current page (default false)
   * @param {string} mediaType - Media type to filter by: 'video', 'short', 'livestream' (default 'video')
   * @returns {Promise<Array>} - Array of video objects with download status
   */
  async fetchNewestVideosFromDb(channelId, limit = 50, offset = 0, excludeDownloaded = false, searchQuery = '', sortBy = 'date', sortOrder = 'desc', checkFiles = false, mediaType = 'video') {
    // First get all videos to enrich with download status
    const allChannelVideos = await ChannelVideo.findAll({
      where: {
        channel_id: channelId,
        media_type: mediaType,
      },
      order: [['publishedAt', 'DESC']],
    });

    // Enrich all videos with download status, but only check files for the current page
    // We'll determine which videos are on the current page after filtering and sorting
    const enrichedVideos = await this.enrichVideosWithDownloadStatus(allChannelVideos, false);

    // Filter if needed
    let filteredVideos = enrichedVideos;
    if (excludeDownloaded) {
      filteredVideos = enrichedVideos.filter(video => !video.added || video.removed);
    }

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredVideos = filteredVideos.filter(video =>
        video.title && video.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filteredVideos.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
      case 'date':
        comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'duration':
        comparison = (a.duration || 0) - (b.duration || 0);
        break;
      case 'size':
        comparison = (a.fileSize || 0) - (b.fileSize || 0);
        break;
      default:
        comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const paginatedVideos = filteredVideos.slice(offset, offset + limit);

    // If checkFiles is true, check file existence for only the current page
    if (checkFiles && paginatedVideos.length > 0) {
      // Re-enrich only the paginated videos with file checking enabled
      const paginatedChannelVideos = paginatedVideos.map(v => ({
        youtube_id: v.youtube_id || v.youtubeId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        publishedAt: v.publishedAt,
        availability: v.availability,
        youtube_removed: v.youtube_removed,
        ignored: v.ignored,
        ignored_at: v.ignored_at
      }));

      // This will check files for only the current page
      const checkedVideos = await this.enrichVideosWithDownloadStatus(paginatedChannelVideos, true);

      // Merge the checked results back into the paginated videos
      for (let i = 0; i < paginatedVideos.length; i++) {
        if (checkedVideos[i]) {
          paginatedVideos[i].added = checkedVideos[i].added;
          paginatedVideos[i].removed = checkedVideos[i].removed;
          paginatedVideos[i].fileSize = checkedVideos[i].fileSize;
        }
        // If a video is removed from YouTube, fallback to using the locally stored thumbnail if available
        if (paginatedVideos[i].youtube_removed) {
          paginatedVideos[i].thumbnail = `/images/videothumb-${paginatedVideos[i].youtube_id}.jpg`;
        }
      }
    }

    return paginatedVideos;
  }

  /**
   * Get the total count and oldest video date for a channel
   * @param {string} channelId - Channel ID
   * @param {boolean} excludeDownloaded - Whether to exclude downloaded videos (default false)
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} mediaType - Media type to filter by: 'video', 'short', 'livestream' (default 'video')
   * @returns {Promise<Object>} - Object with totalCount and oldestVideoDate
   */
  async getChannelVideoStats(channelId, excludeDownloaded = false, searchQuery = '', mediaType = 'video') {
    // If we have search or filter, we need to get all videos
    if (excludeDownloaded || searchQuery) {
      // Need to filter by download status and/or search
      const allChannelVideos = await ChannelVideo.findAll({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        },
        order: [['publishedAt', 'DESC']],
      });

      const enrichedVideos = await this.enrichVideosWithDownloadStatus(allChannelVideos);

      let filteredVideos = enrichedVideos;

      // Apply download filter
      if (excludeDownloaded) {
        filteredVideos = filteredVideos.filter(video => !video.added || video.removed);
      }

      // Apply search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredVideos = filteredVideos.filter(video =>
          video.title && video.title.toLowerCase().includes(searchLower)
        );
      }

      return {
        totalCount: filteredVideos.length,
        oldestVideoDate: filteredVideos.length > 0 ?
          filteredVideos[filteredVideos.length - 1].publishedAt : null
      };
    } else {
      // Fast path - just use database counts when no filters
      const totalCount = await ChannelVideo.count({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        }
      });

      const oldestVideo = await ChannelVideo.findOne({
        where: {
          channel_id: channelId,
          media_type: mediaType,
        },
        order: [['publishedAt', 'ASC']],
        attributes: ['publishedAt']
      });

      return {
        totalCount,
        oldestVideoDate: oldestVideo ? oldestVideo.publishedAt : null
      };
    }
  }

  /**
   * Extract published date from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @returns {string} - ISO date string
   */
  extractPublishedDate(entry) {
    if (entry.timestamp) {
      return new Date(entry.timestamp * 1000).toISOString();
    }
    if (entry.upload_date) {
      const year = entry.upload_date.substring(0, 4);
      const month = entry.upload_date.substring(4, 6);
      const day = entry.upload_date.substring(6, 8);
      return new Date(`${year}-${month}-${day}`).toISOString();
    }
    if (entry.release_timestamp) {
      return new Date(entry.release_timestamp * 1000).toISOString();
    }
    return null;
  }

  /**
   * Extract thumbnail URL from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @returns {string} - Thumbnail URL
   */
  extractThumbnailUrl(entry) {
    if (entry.thumbnail) {
      return entry.thumbnail;
    }
    if (entry.thumbnails && Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
      const mediumThumb = entry.thumbnails.find(t => t.id === 'medium' || t.id === '3');
      return mediumThumb ? mediumThumb.url : entry.thumbnails[entry.thumbnails.length - 1].url;
    }
    if (entry.id) {
      return `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`;
    }
    return '';
  }

  /**
   * Parse video metadata from yt-dlp entry
   * @param {Object} entry - Video entry from yt-dlp
   * @returns {Object} - Parsed video object
   */
  parseVideoMetadata(entry) {
    return {
      title: entry.title || 'Untitled',
      youtube_id: entry.id,
      publishedAt: this.extractPublishedDate(entry),
      thumbnail: this.extractThumbnailUrl(entry),
      duration: entry.duration || 0,
      availability: entry.availability || null,
      media_type: entry.media_type || 'video',
      live_status: entry.live_status || null,
    };
  }

  /**
   * Extract video entries from yt-dlp JSON response.
   * @param {Object} jsonOutput - Parsed JSON from yt-dlp
   * @returns {Array} - Array of parsed video metadata objects
   */
  extractVideosFromYtDlpResponse(jsonOutput) {
    const videos = [];

    if (!jsonOutput.entries || !Array.isArray(jsonOutput.entries)) {
      logger.warn('No entries found in yt-dlp JSON response');
      return videos;
    }

    const entries = jsonOutput.entries;

    // Since we're fetching directly from a specific tab, we should get video entries directly
    for (const entry of entries) {
      if (!entry) continue;

      // Skip playlist entries (shouldn't happen when fetching specific tabs)
      if (entry._type === 'playlist') {
        logger.warn('Unexpected playlist entry found when fetching specific tab');
        continue;
      }

      // Parse and add the video metadata
      videos.push(this.parseVideoMetadata(entry));
    }

    return videos;
  }

  /**
   * Fetch channel videos from specific tab using yt-dlp.
   * Retrieves metadata for recent videos from YouTube.
   * Uses canonical channel URL for stability when handles change.
   * @param {string} channelId - Channel ID to fetch videos for
   * @param {Date|null} mostRecentVideoDate - Date of the most recent video we have
   * @param {string} tabType - Type of tab to fetch videos from
   * @returns {Promise<Object>} - Object with videos array and current channel URL
   * @throws {Error} - If channel not found in database
   */
  async fetchChannelVideosViaYtDlp(channelId, mostRecentVideoDate = null, tabType) {
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

    // Always use canonical URL based on channel ID for yt-dlp
    // This ensures stability even when channel handles change
    const canonicalUrl = `${this.resolveChannelUrlFromId(channelId)}/${tabType}`;

    return await this.withTempFile('channel-videos', async (outputFilePath) => {
      const content = await this.executeYtDlpCommand([
        '--flat-playlist',
        '--dump-single-json',
        '--extractor-args', 'youtubetab:approximate_date',  // Get approximate timestamps for videos
        '--playlist-end', String(videoCount), // Fetch dynamic number of videos
        '-4',
        canonicalUrl,
      ], outputFilePath);

      const jsonOutput = JSON.parse(content);

      // Extract videos using helper method that handles nested structures
      const videos = this.extractVideosFromYtDlpResponse(jsonOutput);

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

    const lastFetched = this.getLastFetchedForTab(channel, mediaType);

    return !lastFetched ||
           new Date() - lastFetched > 1 * 60 * 60 * 1000 ||
           videoCount === 0;
  }

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
    // Parse available tabs if present
    const availableTabs = channel && channel.available_tabs ? channel.available_tabs.split(',') : [];

    // Get the last fetched timestamp for this specific tab
    const lastFetched = channel ? this.getLastFetchedForTab(channel, mediaType) : null;

    return {
      videos: videos,
      videoFail: videos.length === 0 && (!stats || stats.totalCount === 0),
      failureReason: videos.length === 0 && (!stats || stats.totalCount === 0) ? 'fetch_error' : null,
      dataSource: dataSource,
      lastFetched: lastFetched,
      totalCount: stats ? stats.totalCount : videos.length,
      oldestVideoDate: stats ? stats.oldestVideoDate : null,
      autoDownloadsEnabled: autoDownloadsEnabled,
      availableTabs: availableTabs,
    };
  }

  /**
   * Detect which tab types (videos, shorts, streams) are available for a channel.
   * Caches the result in the channel's available_tabs column.
   * @param {string} channelId - Channel ID to detect tabs for
   * @returns {Promise<Array<string>>} - Array of available tab types (e.g., ['videos', 'shorts'])
   */
  async getChannelAvailableTabs(channelId) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // If we already have available_tabs data, return it
    if (channel.available_tabs) {
      return channel.available_tabs.split(',');
    }

    // Otherwise, detect which tabs exist by testing each one
    const availableTabs = [];
    const tabTypesToTest = [TAB_TYPES.VIDEOS, TAB_TYPES.SHORTS, TAB_TYPES.LIVE];
    const canonicalChannelUrl = this.resolveChannelUrlFromId(channelId);

    logger.info({ channelId, channelTitle: channel.title }, 'Detecting available tabs for channel');

    for (const tabType of tabTypesToTest) {
      try {
        const tabUrl = `${canonicalChannelUrl}/${tabType}`;

        // Test if the tab exists by trying to fetch just 1 video
        await this.withTempFile(`tab-test-${tabType}`, async (outputFilePath) => {
          await this.executeYtDlpCommand([
            '--flat-playlist',
            '--dump-single-json',
            '--playlist-end', '1',
            '-4',
            tabUrl,
          ], outputFilePath);
        });

        // If we got here without error, the tab exists
        availableTabs.push(tabType);
        logger.info({ channelId, tabType }, 'Tab exists for channel');
      } catch (error) {
        // Tab doesn't exist or is empty - that's fine
        logger.debug({ channelId, tabType }, 'Tab not available for channel');
      }
    }

    // Store the result in the database for future use
    if (availableTabs.length > 0) {
      channel.available_tabs = availableTabs.join(',');
      await channel.save();
    }

    return availableTabs;
  }

  /**
   * Update the auto download setting for a specific tab type for a channel
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Tab type ('videos', 'shorts', or 'streams')
   * @param {boolean} enabled - Whether to enable auto downloads for this tab
   */
  async updateAutoDownloadForTab(channelId, tabType, enabled) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Convert tabType to mediaType
    const mediaType = MEDIA_TAB_TYPE_MAP[tabType] || 'video';

    // Get current enabled tabs
    const currentEnabledTabs = (channel.auto_download_enabled_tabs || 'video')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let newEnabledTabs;
    if (enabled) {
      // Add mediaType if not already present
      if (!currentEnabledTabs.includes(mediaType)) {
        newEnabledTabs = [...currentEnabledTabs, mediaType];
      } else {
        newEnabledTabs = currentEnabledTabs;
      }
    } else {
      // Remove mediaType
      newEnabledTabs = currentEnabledTabs.filter(t => t !== mediaType);
    }

    // Update the channel (empty string if no tabs are enabled)
    channel.auto_download_enabled_tabs = newEnabledTabs.join(',');
    await channel.save();

    logger.info({
      channelId,
      tabType,
      enabled,
      autoDownloadEnabledTabs: channel.auto_download_enabled_tabs
    }, 'Updated auto download setting for channel tab');
  }

  /**
   * Get channel videos with smart caching.
   * Returns cached data if fresh, otherwise fetches new data from YouTube.
   * Falls back to cached data on errors.
   * @param {string} channelId - Channel ID to get videos for
   * @param {number} page - Page number (1-based, default 1)
   * @param {number} pageSize - Number of videos per page (default 50)
   * @param {boolean} hideDownloaded - Whether to hide downloaded videos (default false)
   * @param {string} searchQuery - Search query to filter videos by title (default '')
   * @param {string} sortBy - Field to sort by: 'date', 'title', 'duration', 'size' (default 'date')
   * @param {string} sortOrder - Sort order: 'asc' or 'desc' (default 'desc')
   * @param {string} tabType - Tab type to fetch: 'videos', 'shorts', or 'streams' (default 'videos')
   * @returns {Promise<Object>} - Response object with videos and metadata
   */
  async getChannelVideos(channelId, page = 1, pageSize = 50, hideDownloaded = false, searchQuery = '', sortBy = 'date', sortOrder = 'desc', tabType = TAB_TYPES.VIDEOS) {
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

    try {
      // First check if we need to refresh recent videos from YouTube
      const allVideos = await this.fetchNewestVideosFromDb(channelId, 1, 0, false, '', 'date', 'desc', false, mediaType);
      const mostRecentVideoDate = allVideos.length > 0 ? allVideos[0].publishedAt : null;

      if (shouldFetchFromYoutube && this.shouldRefreshChannelVideos(channel, allVideos.length, mediaType)) {
        // Check if there's already an active fetch for this channel
        if (this.activeFetches.has(channelId)) {
          logger.info({ channelId }, 'Skipping auto-refresh - fetch already in progress');
        } else {
          // Register this fetch operation
          this.activeFetches.set(channelId, {
            startTime: new Date().toISOString(),
            type: 'autoRefresh'
          });

          try {
            // Fetch videos for the specified tab type
            await this.fetchAndSaveVideosViaYtDlp(channel, channelId, tabType, mostRecentVideoDate);
          } finally {
            // Clear the active fetch record
            this.activeFetches.delete(channelId);
          }
        }
      }

      // Now fetch the requested page of videos with file checking enabled
      const offset = (page - 1) * pageSize;
      const paginatedVideos = await this.fetchNewestVideosFromDb(channelId, pageSize, offset, hideDownloaded, searchQuery, sortBy, sortOrder, true, mediaType);

      // Check if videos still exist on YouTube and mark as removed if they don't
      const videoValidationModule = require('./videoValidationModule');
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
      const stats = await this.getChannelVideoStats(channelId, hideDownloaded, searchQuery, mediaType);

      return this.buildChannelVideosResponse(paginatedVideos, channel, 'cache', stats, autoDownloadsEnabled, mediaType);

    } catch (error) {
      logger.error({ err: error, channelId }, 'Error fetching channel videos');
      const offset = (page - 1) * pageSize;
      const cachedVideos = await this.fetchNewestVideosFromDb(channelId, pageSize, offset, hideDownloaded, searchQuery, sortBy, sortOrder, true, mediaType);
      const stats = await this.getChannelVideoStats(channelId, hideDownloaded, searchQuery, mediaType);
      return this.buildChannelVideosResponse(cachedVideos, channel, 'cache', stats, autoDownloadsEnabled, mediaType);
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
      const result = await this.fetchChannelVideosViaYtDlp(channelId, mostRecentVideoDate, tabType);
      const { videos, currentChannelUrl } = result;

      const mediaType = MEDIA_TAB_TYPE_MAP[tabType];

      if (videos.length > 0) {
        await this.insertVideosIntoDb(videos, channelId, mediaType);
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
        await this.setLastFetchedForTab(channel, mediaType, new Date());
      }
    } catch (ytdlpError) {
      logger.error({ err: ytdlpError, channelId }, 'Error fetching channel videos');
      throw ytdlpError;
    }
  }

  /**
   * Fetch ALL videos for a channel from YouTube and save to database.
   * This is a long-running operation that fetches the complete video history.
   * @param {string} channelId - Channel ID
   * @param {number} requestedPage - Page requested by frontend
   * @param {number} requestedPageSize - Page size requested by frontend
   * @param {boolean} hideDownloaded - Whether to hide downloaded videos in response
   * @param {string} tabType - Tab type to fetch: 'videos', 'shorts', or 'streams' (default 'videos')
   * @returns {Promise<Object>} - Response with success status and paginated data
   */
  async fetchAllChannelVideos(channelId, requestedPage = 1, requestedPageSize = 50, hideDownloaded = false, tabType = TAB_TYPES.VIDEOS) {
    // Check if there's already an active fetch for this channel
    if (this.activeFetches.has(channelId)) {
      const activeOperation = this.activeFetches.get(channelId);
      throw new Error(`A fetch operation is already in progress for this channel (started ${activeOperation.startTime})`);
    }

    // Register this fetch operation
    this.activeFetches.set(channelId, {
      startTime: new Date().toISOString(),
      type: 'fetchAll'
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

        // Fetch ALL videos from YouTube (no --playlist-end parameter)
        const canonicalUrl = `${this.resolveChannelUrlFromId(channelId)}/${tabType}`;

        const result = await this.withTempFile('channel-all-videos', async (outputFilePath) => {
          const content = await this.executeYtDlpCommand([
            '--flat-playlist',
            '--dump-single-json',
            '--extractor-args', 'youtubetab:approximate_date',
            '-4',
            canonicalUrl,
          ], outputFilePath);

          const jsonOutput = JSON.parse(content);
          const videos = this.extractVideosFromYtDlpResponse(jsonOutput);
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
          await this.insertVideosIntoDb(result.videos, channelId, mediaType);
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
        await this.setLastFetchedForTab(channel, mediaType, new Date());

        // Get the requested page of videos after the full fetch
        const offset = (requestedPage - 1) * requestedPageSize;
        const paginatedVideos = await this.fetchNewestVideosFromDb(channelId, requestedPageSize, offset, hideDownloaded, '', 'date', 'desc', false, mediaType);
        const stats = await this.getChannelVideoStats(channelId, hideDownloaded, '', mediaType);

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
      this.activeFetches.delete(channelId);
    }
  }
}

module.exports = new ChannelModule();
