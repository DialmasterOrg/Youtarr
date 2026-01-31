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
const ratingMapper = require('./ratingMapper');
const { Op, fn, col, where } = require('sequelize');
const fileCheckModule = require('./fileCheckModule');
const logger = require('../logger');
const { sanitizeNameLikeYtDlp } = require('./filesystem');

const { v4: uuidv4 } = require('uuid');
const { spawn, execSync } = require('child_process');

const SUB_FOLDER_DEFAULT_KEY = '__default__';

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

// Maximum number of videos to load when user clicks "Load More"
// Limit set here because some channels have tens or hundreds of thousands of videos...
// which effectively is not "loadable", so we had to set some reasonable limit.
// Unfortunately, yt-dlp ALWAYS starts a fetch with the newest video, so there is no way to "page" through
const MAX_LOAD_MORE_VIDEOS = 5000;

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
   * Check if a fetch operation is currently in progress for a channel/tab combination
   * @param {string} channelId - Channel ID to check
   * @param {string} tabType - Tab type to check (optional, defaults to checking any tab)
   * @returns {Object} - Object with isFetching boolean and operation details if fetching
   */
  isFetchInProgress(channelId, tabType = null) {
    if (tabType) {
      // Check for specific tab
      const key = `${channelId}:${tabType}`;
      if (this.activeFetches.has(key)) {
        const activeOperation = this.activeFetches.get(key);
        return {
          isFetching: true,
          startTime: activeOperation.startTime,
          type: activeOperation.type,
          tabType: tabType
        };
      }
    } else {
      // Check for any tab on this channel (legacy behavior)
      for (const [key, value] of this.activeFetches.entries()) {
        if (key.startsWith(`${channelId}:`)) {
          return {
            isFetching: true,
            startTime: value.startTime,
            type: value.type,
            tabType: key.split(':')[1]
          };
        }
      }
    }
    return { isFetching: false };
  }


  /**
   * Execute yt-dlp command with promise-based handling
   * NOTE: Args should be pre-built using ytdlpCommandBuilder methods which include
   * common arguments (cookies, proxy, sleep-requests, etc.)
   * @param {Array} args - Pre-built arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @returns {Promise<string>} - Output content if outputFile provided
   */
  async executeYtDlpCommand(args, outputFile = null) {
    const ytDlp = spawn('yt-dlp', args, {
      env: {
        ...process.env,
        TMPDIR: '/tmp'
      }
    });

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
        if (stderrBuffer.includes("Sign in to confirm you're not a bot") ||
            stderrBuffer.includes("Sign in to confirm that you're not a bot")) {
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

    return '';
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
      audio_format: channel.audio_format || null,
      min_duration: channel.min_duration || null,
      max_duration: channel.max_duration || null,
      title_filter_regex: channel.title_filter_regex || null,
      default_rating: channel.default_rating || null,
    };
  }

  /**
   * Map channel database record to list response format expected by the UI
   * @param {Object} channel - Channel database record
   * @returns {Object} - Simplified channel representation
   */
  mapChannelListEntry(channel) {
    return {
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
      default_rating: channel.default_rating || null,
      audio_format: channel.audio_format || null,
    };
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
   * Fetch channel metadata from YouTube along with sanitized folder name.
   * Uses a combined yt-dlp call that outputs both folder name and JSON metadata.
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<Object>} - Channel metadata with folder_name property
   */
  async fetchChannelMetadata(channelUrl) {
    const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
    return await this.withTempFile('channel', async (outputFilePath) => {
      const args = YtdlpCommandBuilder.buildMetadataWithFolderNameArgs(channelUrl, {
        playlistEnd: 1,
        skipSleepRequests: true,
      });
      logger.info('fetchChannelMetadata executing yt-dlp with args' + JSON.stringify(args));
      const content = await this.executeYtDlpCommand(args, outputFilePath);
      logger.info('fetchChannelMetadata received yt-dlp output of length ' + content.length);

      const metadata = JSON.parse(content);

      const unsanitizedFolderName = metadata.uploader || metadata.channel || metadata.uploader_id;
      const sanitizedFolderName = sanitizeNameLikeYtDlp(unsanitizedFolderName);

      return { ...metadata, folder_name: sanitizedFolderName };

    });
  }

  /**
   * Extract the avatar thumbnail URL from channel metadata
   * @param {Object} channelData - Channel metadata from yt-dlp
   * @returns {string|null} - Avatar thumbnail URL or null if not found
   */
  extractAvatarThumbnailUrl(channelData) {
    if (!channelData.thumbnails || !Array.isArray(channelData.thumbnails)) {
      return null;
    }
    // Prefer 900x900 (height and width), then any square dimension thumb, then avatar_uncropped
    // (avatar_uncropped last since it is good, but usually HUGE)
    const avatarThumb = channelData.thumbnails.find(t => t.width === 900 && t.height === 900)
      || channelData.thumbnails.find(t => t.width && t.height && t.width === t.height)
      || channelData.thumbnails.find(t => t.id === 'avatar_uncropped');
    logger.info({ channelId: channelData.channel_id, avatarThumb }, 'Extracted avatar thumbnail URL');
    return avatarThumb?.url || null;
  }

  /**
   * Download channel thumbnail directly from URL
   * @param {string} thumbnailUrl - Direct URL to the thumbnail image
   * @param {string} channelId - Channel ID for naming the file
   * @returns {Promise<void>}
   */
  async downloadChannelThumbnailFromUrl(thumbnailUrl, channelId) {
    const https = require('https');
    const http = require('http');
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(imageDir, `channelthumb-${channelId}.jpg`);

    return new Promise((resolve, reject) => {
      const protocol = thumbnailUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(imagePath);

      protocol.get(thumbnailUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(imagePath);
          return this.downloadChannelThumbnailFromUrl(response.headers.location, channelId)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(imagePath);
          return reject(new Error(`Failed to download thumbnail: HTTP ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          logger.debug({ channelId, imagePath }, 'Channel thumbnail downloaded via HTTP');
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
        reject(err);
      });
    });
  }

  /**
   * Download channel thumbnail using yt-dlp (fallback method)
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<void>}
   */
  async downloadChannelThumbnailViaYtdlp(channelUrl) {
    const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(
      imageDir,
      'channelthumb-%(channel_id)s.jpg'
    );

    const args = YtdlpCommandBuilder.buildThumbnailDownloadArgs(channelUrl, imagePath);
    await this.executeYtDlpCommand(args);
  }

  /**
   * Process channel thumbnail (download and resize)
   * @param {Object} channelData - Channel metadata containing thumbnails array
   * @param {string} channelId - Channel ID
   * @param {string} channelUrl - Channel URL (fallback for yt-dlp download)
   * @returns {Promise<void>}
   */
  async processChannelThumbnail(channelData, channelId, channelUrl) {
    const thumbnailUrl = this.extractAvatarThumbnailUrl(channelData);
    logger.info({ channelId, thumbnailUrl }, 'Processing channel thumbnail');

    if (thumbnailUrl) {
      try {
        await this.downloadChannelThumbnailFromUrl(thumbnailUrl, channelId);
      } catch (err) {
        logger.warn({ err, channelId }, 'Failed to download thumbnail via HTTP, falling back to yt-dlp');
        await this.downloadChannelThumbnailViaYtdlp(channelUrl);
      }
    } else {
      logger.info({ channelId }, 'No avatar thumbnail URL found in metadata, using yt-dlp');
      await this.downloadChannelThumbnailViaYtdlp(channelUrl);
    }

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

    logger.info('Fetching channel metadata from YouTube');
    const channelData = await this.fetchChannelMetadata(channelUrl);
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
    await this.upsertChannel({
      id: properChannelId,
      title: channelData.title,
      description: channelData.description,
      uploader: channelData.uploader,
      url: actualChannelUrl,  // Store the actual handle URL for display
      folder_name: folderName,
    }, enableChannel);

    // Now process thumbnail using the proper channel ID (uses metadata URL, falls back to yt-dlp)
    logger.info('Processing channel thumbnail');
    await this.processChannelThumbnail(channelData, properChannelId, channelUrl);
    logger.info('Channel thumbnail processed successfully');

    // Detect available tabs (fast via RSS feeds)
    const tabResult = await this.detectAndSaveChannelTabs(properChannelId);

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
      auto_download_enabled_tabs: tabResult?.autoDownloadEnabledTabs || 'video',
      available_tabs: tabResult?.availableTabs?.join(',') || null,
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
        if (!channel.channel_id) continue;

        // Use folder_name (sanitized by yt-dlp) if available, fall back to uploader
        const channelFolderName = channel.folder_name || channel.uploader;
        if (!channelFolderName) continue;

        const channelFolderPath = path.join(outputDir, channelFolderName);
        const channelPosterPath = path.join(channelFolderPath, 'poster.jpg');

        // Check if channel folder exists and poster.jpg doesn't exist
        if (fs.existsSync(channelFolderPath) && !fs.existsSync(channelPosterPath)) {
          const channelThumbPath = path.join(imageDir, `channelthumb-${channel.channel_id}.jpg`);

          if (fs.existsSync(channelThumbPath)) {
            try {
              fs.copySync(channelThumbPath, channelPosterPath);
            } catch (copyErr) {
              logger.error({ err: copyErr, channelFolderName }, 'Error backfilling poster for channel');
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

      return channels.map((channel) => this.mapChannelListEntry(channel));
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

      this.backfillChannelPosters(rows);

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
        channels: rows.map((channel) => this.mapChannelListEntry(channel)),
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
          const channelInfo = await this.getChannelInfo(url, false, true);
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
          content_rating: video.content_rating || null,
          age_limit: video.age_limit || null,
          normalized_rating: video.normalized_rating || null,
          rating_source: video.rating_source || null,
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
      attributes: ['id', 'youtubeId', 'removed', 'fileSize', 'filePath', 'audioFilePath', 'audioFileSize', 'normalized_rating']
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
        filePath: v.filePath,
        audioFilePath: v.audioFilePath,
        audioFileSize: v.audioFileSize,
        normalized_rating: v.normalized_rating
      });

      // Collect videos that need file checking (only if checkFiles is true and have any file path)
      if (checkFiles && (v.filePath || v.audioFilePath)) {
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
          status.audioFileSize = v.audioFileSize;
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
        plainVideoObject.filePath = status.filePath;
        plainVideoObject.audioFilePath = status.audioFilePath;
        plainVideoObject.audioFileSize = status.audioFileSize;
        if (status.normalized_rating !== undefined && status.normalized_rating !== null) {
          plainVideoObject.normalized_rating = status.normalized_rating;
        }
      } else {
        // Video never downloaded
        plainVideoObject.added = false;
        plainVideoObject.removed = false;
        plainVideoObject.fileSize = null;
        plainVideoObject.filePath = null;
        plainVideoObject.audioFilePath = null;
        plainVideoObject.audioFileSize = null;
      }

      // Replace thumbnail with template format (unless video is removed from YouTube)
      if (!plainVideoObject.youtube_removed) {
        plainVideoObject.thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }

      return plainVideoObject;
    });
  }

  /**
   * Apply duration and date filters to a list of videos.
   * @param {Array} videos - Array of video objects to filter
   * @param {number|null} minDuration - Minimum duration in seconds
   * @param {number|null} maxDuration - Maximum duration in seconds
   * @param {string|null} dateFrom - Filter videos from this date (ISO string)
   * @param {string|null} dateTo - Filter videos to this date (ISO string)
   * @returns {Array} - Filtered array of videos
   */
  _applyDurationAndDateFilters(videos, minDuration, maxDuration, dateFrom, dateTo) {
    let filtered = videos;

    if (minDuration !== null) {
      filtered = filtered.filter(video =>
        video.duration && video.duration >= minDuration
      );
    }
    if (maxDuration !== null) {
      filtered = filtered.filter(video =>
        video.duration && video.duration <= maxDuration
      );
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(video =>
        video.publishedAt && new Date(video.publishedAt) >= fromDate
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      filtered = filtered.filter(video =>
        video.publishedAt && new Date(video.publishedAt) <= toDate
      );
    }

    return filtered;
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
  * @param {string} maxRating - Maximum allowed rating filter (default '')
  * @param {number|null} minDuration - Minimum duration in seconds (default null)
  * @param {number|null} maxDuration - Maximum duration in seconds (default null)
  * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
  * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Array>} - Array of video objects with download status
   */
  async fetchNewestVideosFromDb(channelId, limit = 50, offset = 0, excludeDownloaded = false, searchQuery = '', sortBy = 'date', sortOrder = 'desc', checkFiles = false, mediaType = 'video', maxRating = '', minDuration = null, maxDuration = null, dateFrom = null, dateTo = null) {
    let whereClause = {
      channel_id: channelId,
    };

    if (mediaType === 'video') {
      // For 'video' type, we want records where media_type is 'video', NULL, or ''
      // Since NULL can't be in Op.in, we use an OR condition
      whereClause = {
        channel_id: channelId,
        [Op.or]: [
          { media_type: 'video' },
          { media_type: null },
          { media_type: '' }
        ]
      };
    } else {
      whereClause.media_type = mediaType;
    }

    logger.info({ channelId, mediaType, whereClause }, 'fetchNewestVideosFromDb - query clause');
    // First get all videos to enrich with download status
    const allChannelVideos = await ChannelVideo.findAll({
      where: whereClause,
      order: [['publishedAt', 'DESC']],
    });

    logger.info({ channelId, mediaType, videoCount: allChannelVideos.length }, 'fetchNewestVideosFromDb - videos found');

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

    const maxRatingLimit = ratingMapper.getRatingAgeLimit(maxRating);
    if (maxRatingLimit !== null && maxRatingLimit !== undefined) {
      filteredVideos = filteredVideos.filter(video => {
        const videoLimit = ratingMapper.getRatingAgeLimit(video.normalized_rating);
        return videoLimit === null || videoLimit <= maxRatingLimit;
      });
    }

    // Apply duration and date filters
    filteredVideos = this._applyDurationAndDateFilters(filteredVideos, minDuration, maxDuration, dateFrom, dateTo);

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
        ignored_at: v.ignored_at,
        normalized_rating: v.normalized_rating,
        media_type: v.media_type,
        live_status: v.live_status
      }));

      // This will check files for only the current page
      const checkedVideos = await this.enrichVideosWithDownloadStatus(paginatedChannelVideos, true);

      // Merge the checked results back into the paginated videos
      for (let i = 0; i < paginatedVideos.length; i++) {
        if (checkedVideos[i]) {
          paginatedVideos[i].added = checkedVideos[i].added;
          paginatedVideos[i].removed = checkedVideos[i].removed;
          paginatedVideos[i].fileSize = checkedVideos[i].fileSize;
          paginatedVideos[i].thumbnail = checkedVideos[i].thumbnail;
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
   * @param {string} maxRating - Maximum allowed rating filter (default '')
   * @param {number|null} minDuration - Minimum duration in seconds (default null)
   * @param {number|null} maxDuration - Maximum duration in seconds (default null)
   * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
   * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Object>} - Object with totalCount and oldestVideoDate
   */
  async getChannelVideoStats(channelId, excludeDownloaded = false, searchQuery = '', mediaType = 'video', maxRating = '', minDuration = null, maxDuration = null, dateFrom = null, dateTo = null) {
    // If we have search or filter, we need to get all videos
    if (excludeDownloaded || searchQuery || maxRating || minDuration !== null || maxDuration !== null || dateFrom || dateTo) {
      let whereClause = {
        channel_id: channelId,
      };

      if (mediaType === 'video') {
        whereClause = {
          channel_id: channelId,
          [Op.or]: [
            { media_type: 'video' },
            { media_type: null },
            { media_type: '' }
          ]
        };
      } else {
        whereClause.media_type = mediaType;
      }

      logger.info({ channelId, mediaType, whereClause }, 'getChannelVideoStats - filtered path');
      // Need to filter by download status and/or search
      const allChannelVideos = await ChannelVideo.findAll({
        where: whereClause,
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

      const maxRatingLimit = ratingMapper.getRatingAgeLimit(maxRating);
      if (maxRatingLimit !== null && maxRatingLimit !== undefined) {
        filteredVideos = filteredVideos.filter(video => {
          const videoLimit = ratingMapper.getRatingAgeLimit(video.normalized_rating);
          return videoLimit === null || videoLimit <= maxRatingLimit;
        });
      }

      // Apply duration and date filters
      filteredVideos = this._applyDurationAndDateFilters(filteredVideos, minDuration, maxDuration, dateFrom, dateTo);

      return {
        totalCount: filteredVideos.length,
        oldestVideoDate: filteredVideos.length > 0 ?
          filteredVideos[filteredVideos.length - 1].publishedAt : null
      };
    } else {
      const countWhereClause = {
        channel_id: channelId,
      };

      if (mediaType === 'video') {
        countWhereClause.media_type = { [Op.or]: ['video', null, ''] };
      } else {
        countWhereClause.media_type = mediaType;
      }

      // Fast path - just use database counts when no filters
      const totalCount = await ChannelVideo.count({
        where: countWhereClause
      });

      logger.info({ channelId, mediaType, countWhereClause, totalCount }, 'getChannelVideoStats - fast path');

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
    // Extract rating information
    const contentRating = entry.contentRating || entry.content_rating || null;
    const ageLimit = entry.age_limit || null;

    // Map to normalized rating
    const ratingInfo = ratingMapper.mapFromEntry(contentRating, ageLimit);

    return {
      title: entry.title || 'Untitled',
      youtube_id: entry.id,
      publishedAt: this.extractPublishedDate(entry),
      thumbnail: this.extractThumbnailUrl(entry),
      duration: entry.duration || 0,
      availability: entry.availability || null,
      media_type: entry.media_type || 'video',
      live_status: entry.live_status || null,
      content_rating: contentRating,
      age_limit: ageLimit,
      normalized_rating: ratingInfo.normalized_rating,
      rating_source: ratingInfo.source,
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

    const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
    return await this.withTempFile('channel-videos', async (outputFilePath) => {
      const args = YtdlpCommandBuilder.buildMetadataFetchArgs(canonicalUrl, {
        flatPlaylist: true,
        extractorArgs: 'youtubetab:approximate_date',
        playlistEnd: videoCount
      });
      const content = await this.executeYtDlpCommand(args, outputFilePath);

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
   * Build RSS feed URL for a specific tab type.
   * Uses YouTube's RSS feed playlist IDs which have specific prefixes:
   * - Videos: UULF + channel_unique_id
   * - Shorts: UUSH + channel_unique_id
   * - Live/Streams: UULV + channel_unique_id
   * @param {string} channelId - Full channel ID (e.g., "UCwaNuezahYT3BOjfXsne2mg")
   * @param {string} tabType - Tab type ('videos', 'shorts', or 'streams')
   * @returns {string} - RSS feed URL
   */
  buildRssFeedUrl(channelId, tabType) {
    // Strip the "UC" prefix to get the unique channel portion
    const uniquePortion = channelId.substring(2);

    // Map tab types to RSS playlist prefixes
    const prefixMap = {
      [TAB_TYPES.VIDEOS]: 'UULF',
      [TAB_TYPES.SHORTS]: 'UUSH',
      [TAB_TYPES.LIVE]: 'UULV',
    };

    const prefix = prefixMap[tabType];
    if (!prefix) {
      throw new Error(`Unknown tab type: ${tabType}`);
    }

    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${prefix}${uniquePortion}`;
  }

  /**
   * Check if a tab exists for a channel by testing its RSS feed.
   * A non-404 response indicates the tab exists.
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Tab type to check
   * @returns {Promise<boolean>} - True if tab exists
   */
  async checkTabExistsViaRss(channelId, tabType) {
    const rssUrl = this.buildRssFeedUrl(channelId, tabType);

    try {
      const response = await fetch(rssUrl, { method: 'GET' });
      // Any non-404 response means the tab exists
      // (YouTube returns 404 for non-existent playlist feeds)
      return response.status !== 404;
    } catch (error) {
      // Network error - assume tab doesn't exist
      logger.debug({ channelId, tabType, error: error.message }, 'RSS feed check failed');
      return false;
    }
  }

  /**
   * Detect and save available tabs for a channel.
   * Uses RSS feed checks for fast detection instead of yt-dlp.
   * Uses activeFetches map to prevent concurrent detection for the same channel.
   * @param {string} channelId - Channel ID to detect tabs for
   * @returns {Promise<{availableTabs: string[], autoDownloadEnabledTabs: string}|null>} - Detected tabs or null if skipped/failed
   */
  async detectAndSaveChannelTabs(channelId) {
    // Check if already detecting (use activeFetches map to prevent concurrent)
    const fetchKey = `tabs-${channelId}`;
    if (this.activeFetches.has(fetchKey)) {
      logger.debug({ channelId }, 'Tab detection already in progress, skipping');
      return null;
    }
    this.activeFetches.set(fetchKey, { startTime: new Date().toISOString(), type: 'tabDetection' });

    try {
      const channel = await Channel.findOne({ where: { channel_id: channelId } });
      if (!channel) {
        logger.warn({ channelId }, 'Channel not found for tab detection');
        return null;
      }

      // If already populated (race condition), return cached values
      if (channel.available_tabs) {
        logger.debug({ channelId }, 'Tabs already detected, returning cached');
        return {
          availableTabs: channel.available_tabs.split(','),
          autoDownloadEnabledTabs: channel.auto_download_enabled_tabs || 'video'
        };
      }

      logger.info({ channelId, channelTitle: channel.title }, 'Starting tab detection for channel (via RSS)');

      // Check all tabs in parallel using RSS feeds - much faster than yt-dlp
      const tabTypesToTest = [TAB_TYPES.VIDEOS, TAB_TYPES.SHORTS, TAB_TYPES.LIVE];
      const tabChecks = await Promise.all(
        tabTypesToTest.map(async (tabType) => {
          const exists = await this.checkTabExistsViaRss(channelId, tabType);
          if (exists) {
            logger.info({ channelId, tabType }, 'Tab exists for channel');
          } else {
            logger.debug({ channelId, tabType }, 'Tab not available for channel');
          }
          return { tabType, exists };
        })
      );

      const availableTabs = tabChecks
        .filter(result => result.exists)
        .map(result => result.tabType);

      // Determine smart default for auto_download_enabled_tabs
      let autoDownloadEnabledTabs = 'video';
      if (!availableTabs.includes(TAB_TYPES.VIDEOS) && availableTabs.length > 0) {
        autoDownloadEnabledTabs = MEDIA_TAB_TYPE_MAP[availableTabs[0]] || 'video';
        logger.info({ channelId, defaultTab: autoDownloadEnabledTabs }, 'Channel has no videos tab, using alternative default');
      }

      // Update channel with detected tabs
      await Channel.update(
        {
          available_tabs: availableTabs.length > 0 ? availableTabs.join(',') : null,
          auto_download_enabled_tabs: autoDownloadEnabledTabs
        },
        { where: { channel_id: channelId } }
      );

      logger.info({ channelId, availableTabs, autoDownloadEnabledTabs }, 'Tab detection completed');

      // Emit WebSocket update so frontend can refresh
      MessageEmitter.emitMessage('broadcast', null, 'channel', 'channelTabsDetected', {
        channelId,
        availableTabs,
        autoDownloadEnabledTabs
      });

      return { availableTabs, autoDownloadEnabledTabs };
    } catch (err) {
      logger.error({ err, channelId }, 'Tab detection failed');
      return null;
    } finally {
      this.activeFetches.delete(fetchKey);
    }
  }

  /**
   * Get available tabs for a channel.
   * Returns cached result if available, otherwise detects tabs via RSS feeds.
   * @param {string} channelId - Channel ID to get tabs for
   * @returns {Promise<Object>} - Object with availableTabs array
   */
  async getChannelAvailableTabs(channelId) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Fast path: return cached tabs
    if (channel.available_tabs) {
      return {
        availableTabs: channel.available_tabs.split(','),
      };
    }

    // No tabs cached - detect them now (fast via RSS feeds)
    const result = await this.detectAndSaveChannelTabs(channelId);

    return {
      availableTabs: result?.availableTabs || [],
    };
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
   * @param {string} maxRating - Maximum allowed rating filter (default '')
   * @param {number|null} minDuration - Minimum duration in seconds (default null)
   * @param {number|null} maxDuration - Maximum duration in seconds (default null)
   * @param {string|null} dateFrom - Filter videos from this date (ISO string, default null)
   * @param {string|null} dateTo - Filter videos to this date (ISO string, default null)
   * @returns {Promise<Object>} - Response object with videos and metadata
   */
  async getChannelVideos(channelId, page = 1, pageSize = 50, hideDownloaded = false, searchQuery = '', sortBy = 'date', sortOrder = 'desc', tabType = TAB_TYPES.VIDEOS, maxRating = '', minDuration = null, maxDuration = null, dateFrom = null, dateTo = null) {
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
        // Use composite key to allow concurrent fetches for different tabs
        const fetchKey = `${channelId}:${tabType}`;

        // Check if there's already an active fetch for this channel/tab
        if (this.activeFetches.has(fetchKey)) {
          logger.info({ channelId, tabType }, 'Skipping auto-refresh - fetch already in progress for this tab');
        } else {
          // Register this fetch operation
          this.activeFetches.set(fetchKey, {
            startTime: new Date().toISOString(),
            type: 'autoRefresh',
            tabType: tabType
          });

          try {
            // Fetch videos for the specified tab type
            await this.fetchAndSaveVideosViaYtDlp(channel, channelId, tabType, mostRecentVideoDate);
          } finally {
            // Clear the active fetch record
            this.activeFetches.delete(fetchKey);
          }
        }
      }

      // Now fetch the requested page of videos with file checking enabled
      const offset = (page - 1) * pageSize;
  const paginatedVideos = await this.fetchNewestVideosFromDb(channelId, pageSize, offset, hideDownloaded, searchQuery, sortBy, sortOrder, true, mediaType, maxRating, minDuration, maxDuration, dateFrom, dateTo);

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
  const stats = await this.getChannelVideoStats(channelId, hideDownloaded, searchQuery, mediaType, maxRating, minDuration, maxDuration, dateFrom, dateTo);

      return this.buildChannelVideosResponse(paginatedVideos, channel, 'cache', stats, autoDownloadsEnabled, mediaType);

    } catch (error) {
      logger.error({ err: error, channelId }, 'Error fetching channel videos');
      const offset = (page - 1) * pageSize;
  const cachedVideos = await this.fetchNewestVideosFromDb(channelId, pageSize, offset, hideDownloaded, searchQuery, sortBy, sortOrder, true, mediaType, maxRating, minDuration, maxDuration, dateFrom, dateTo);
  const stats = await this.getChannelVideoStats(channelId, hideDownloaded, searchQuery, mediaType, maxRating, minDuration, maxDuration, dateFrom, dateTo);
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
    // Use composite key to allow concurrent fetches for different tabs
    const fetchKey = `${channelId}:${tabType}`;

    // Check if there's already an active fetch for this channel/tab combination
    if (this.activeFetches.has(fetchKey)) {
      const activeOperation = this.activeFetches.get(fetchKey);
      throw new Error(`A fetch operation is already in progress for this channel tab (started ${activeOperation.startTime})`);
    }

    // Register this fetch operation
    this.activeFetches.set(fetchKey, {
      startTime: new Date().toISOString(),
      type: 'fetchAll',
      tabType: tabType
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

        // Fetch videos from YouTube (limited to MAX_LOAD_MORE_VIDEOS to prevent hanging on large channels)
        const canonicalUrl = `${this.resolveChannelUrlFromId(channelId)}/${tabType}`;

        const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
        const result = await this.withTempFile('channel-all-videos', async (outputFilePath) => {
          const args = YtdlpCommandBuilder.buildMetadataFetchArgs(canonicalUrl, {
            flatPlaylist: true,
            extractorArgs: 'youtubetab:approximate_date',
            playlistEnd: MAX_LOAD_MORE_VIDEOS
          });
          const content = await this.executeYtDlpCommand(args, outputFilePath);

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
      this.activeFetches.delete(fetchKey);
    }
  }

  /**
   * Diagnostic helper to check what media_type values exist in database for a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} - Count by media_type value
   */
}

module.exports = new ChannelModule();
