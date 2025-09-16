const configModule = require('./configModule');
const downloadModule = require('./downloadModule');
const archiveModule = require('./archiveModule');
const cron = require('node-cron');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const Channel = require('../models/channel');
const ChannelVideo = require('../models/channelvideo');
const MessageEmitter = require('./messageEmitter.js');
const { Op } = require('sequelize');

const { v4: uuidv4 } = require('uuid');
const { spawn, execSync } = require('child_process');

class ChannelModule {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
    this.scheduleTask();
    this.subscribe();
    this.populateMissingChannelInfo();
    this.normalizeChannelUrls();
  }


  /**
   * Execute yt-dlp command with promise-based handling
   * @param {Array} args - Arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @returns {Promise<string>} - Output content if outputFile provided
   */
  async executeYtDlpCommand(args, outputFile = null) {
    const ytDlp = spawn('yt-dlp', args);

    if (outputFile) {
      const writeStream = fs.createWriteStream(outputFile);
      ytDlp.stdout.pipe(writeStream);
    }

    await new Promise((resolve, reject) => {
      ytDlp.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
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
    const tempFilePath = path.join(__dirname, `${prefix}-${uuidv4()}.json`);
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
    };
  }

  /**
   * Insert or update channel in database
   * @param {Object} channelData - Channel data to save
   * @param {boolean} enabled - Whether the channel should be enabled (default: false)
   * @returns {Promise<Object>} - Saved channel record
   */
  async upsertChannel(channelData, enabled = false) {
    // First, try to find by channel_id (preferred)
    let channel = await Channel.findOne({
      where: { channel_id: channelData.id }
    });

    if (!channel) {
      // Fallback: try to find by URL (for legacy data without channel_id)
      channel = await Channel.findOne({
        where: { url: channelData.url }
      });

      if (channel) {
        // Found by URL - update with channel_id and other fields
        // This backfills legacy data with the channel_id
        await channel.update({
          channel_id: channelData.id,
          title: channelData.title,
          description: channelData.description,
          uploader: channelData.uploader,
          url: channelData.url,
          enabled: enabled,
        });
      }
    } else {
      // Found by channel_id - just update metadata
      await channel.update({
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: enabled,
      });
    }

    // Only create if not found by either method
    if (!channel) {
      channel = await Channel.create({
        channel_id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: channelData.url,
        enabled: enabled,
      });
    }

    return channel;
  }

  /**
   * Resize channel thumbnail image
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async resizeChannelThumbnail(channelId) {
    const realImagePath = path.resolve(
      __dirname,
      `../images/channelthumb-${channelId}.jpg`
    );
    const smallImagePath = path.resolve(
      __dirname,
      `../images/channelthumb-${channelId}-small.jpg`
    );

    try {
      execSync(
        `${configModule.ffmpegPath} -y -i ${realImagePath} -vf "scale=iw*0.4:ih*0.4" ${smallImagePath}`,
        { stdio: 'inherit' }
      );
      await fsPromises.rename(smallImagePath, realImagePath);
      console.log('Image resized successfully');
    } catch (err) {
      console.log(`Error resizing image: ${err}`);
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
      console.log('Checking for channels with potentially stale handle URLs...');

      // Find all enabled channels with channel_id and handle URLs
      const channels = await Channel.findAll({
        where: {
          enabled: true,
          channel_id: { [Op.ne]: null }
        },
        attributes: ['id', 'channel_id', 'url', 'title', 'lastFetched']
      });

      let handleUrlCount = 0;
      for (const channel of channels) {
        // Check if URL looks like a handle URL
        if (channel.url && channel.url.includes('@')) {
          handleUrlCount++;
          const daysSinceUpdate = channel.lastFetched
            ? Math.floor((Date.now() - new Date(channel.lastFetched).getTime()) / (1000 * 60 * 60 * 24))
            : 'never';
          console.log(`Channel "${channel.title}" uses handle URL: ${channel.url} (last updated: ${daysSinceUpdate === 'never' ? 'never' : `${daysSinceUpdate} days ago`})`);
        }
      }

      if (handleUrlCount > 0) {
        console.log(`Found ${handleUrlCount} channel(s) with handle URLs. These will be updated automatically when accessed.`);
      } else {
        console.log('No channels with handle URLs found.');
      }
    } catch (error) {
      console.error('Error during channel URL check:', error);
    }
  }

  /**
   * Trigger automatic channel video downloads.
   * Called by cron scheduler based on configured frequency.
   * @returns {void}
   */
  channelAutoDownload() {
    console.log('The current time is ' + new Date());
    console.log(
      'Running new Channel Downloads at interval: ' +
        configModule.getConfig().channelDownloadFrequency
    );
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
    const imagePath = path.resolve(
      __dirname,
      '../images/channelthumb-%(channel_id)s.jpg'
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
    console.log(`Storing handle URL for channel ${channelData.id}: ${actualChannelUrl}`);

    await Promise.all([
      this.upsertChannel({
        id: channelData.id,
        title: channelData.title,
        description: channelData.description,
        uploader: channelData.uploader,
        url: actualChannelUrl,  // Store the actual handle URL for display
      }, enableChannel),
      this.processChannelThumbnail(channelUrl, channelData.id)
    ]);

    if (emitMessage) {
      console.log('Channel data fetched -- emitting message!');
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'channel',
        'channelsUpdated',
        { text: 'Channel Updated' }
      );
    }

    return {
      id: channelData.id,
      uploader: channelData.uploader,
      uploader_id: channelData.uploader_id,
      title: channelData.title,
      description: channelData.description,
      url: channelUrl,
    };
  }

  /**
   * Schedule or reschedule the automatic download task.
   * Manages cron job based on configuration settings.
   * @returns {void}
   */
  scheduleTask() {
    console.log(
      'Scheduling task to run at: ' +
        configModule.getConfig().channelDownloadFrequency
    );
    if (this.task) {
      console.log('Stopping old task');
      this.task.stop();
    }

    if (configModule.getConfig().channelAutoDownload) {
      this.task = cron.schedule(
        configModule.getConfig().channelDownloadFrequency,
        this.channelAutoDownload
      );
      console.log('Auto-downloads enabled, task scheduled!');
    } else {
      console.log('Auto-downloads disabled');
    }
  }

  /**
   * Read all enabled channels from the database.
   * @returns {Promise<Array>} - Array of channel objects with url, uploader, and channel_id
   */
  async readChannels() {
    try {
      const channels = await Channel.findAll({
        where: { enabled: true },
      });

      return channels.map((channel) => ({
        url: channel.url,
        uploader: channel.uploader || '',
        channel_id: channel.channel_id || '',
      }));
    } catch (err) {
      console.error('Error reading channels from database:', err);
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
      console.error('Error updating channels in database:', err);
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
   * @returns {Promise<string>} - Path to the temporary file
   */
  async generateChannelsFile() {
    const tempFilePath = path.join(__dirname, `channels-temp-${uuidv4()}.txt`);
    try {
      const channels = await Channel.findAll({
        where: { enabled: true },
        attributes: ['channel_id', 'url']
      });

      // Use canonical channel URLs with the explicit Videos tab when channel_id exists,
      // so the auto-download list aligns with the ChannelVideos tab (newest-first Videos only).
      const urls = channels.map(c => {
        if (c.channel_id) {
          const canonical = this.resolveChannelUrlFromId(c.channel_id);
          return `${canonical}/videos`;
        }
        return c.url;
      }).join('\n');

      await fsPromises.writeFile(tempFilePath, urls);

      return tempFilePath;
    } catch (err) {
      console.error('Error generating channels file:', err);
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
  async insertVideosIntoDb(videos, channelId) {
    for (const video of videos) {
      const [videoRecord, created] = await ChannelVideo.findOrCreate({
        where: {
          youtube_id: video.youtube_id,
          channel_id: channelId
        },
        defaults: {
          ...video,
          channel_id: channelId,
        },
      });

      if (!created) {
        await videoRecord.update({
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration,
          publishedAt: video.publishedAt,
          availability: video.availability || null,
        });
      }
    }
  }

  /**
   * Enrich videos with download status
   * @param {Array} videos - Array of video objects
   * @returns {Array} - Videos with 'added' property
   */
  enrichVideosWithDownloadStatus(videos) {
    const completeListArray = archiveModule.readCompleteListLines();

    return videos.map((video) => {
      const plainVideoObject = video.toJSON ? video.toJSON() : video;
      plainVideoObject.added = completeListArray.includes(
        `youtube ${plainVideoObject.youtube_id}`
      );
      return plainVideoObject;
    });
  }

  /**
   * Fetch the newest videos for a channel from the database.
   * Returns up to 50 most recent videos with download status.
   * @param {string} channelId - Channel ID to fetch videos for
   * @returns {Promise<Array>} - Array of video objects with download status
   */
  async fetchNewestVideosFromDb(channelId) {
    const videos = await ChannelVideo.findAll({
      where: {
        channel_id: channelId,
      },
      order: [['publishedAt', 'DESC']],
      limit: 50,
    });

    return this.enrichVideosWithDownloadStatus(videos);
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
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return ninetyDaysAgo.toISOString();
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
    };
  }

  /**
   * Extract video entries from yt-dlp JSON response.
   * Handles both flat (direct video entries) and nested (playlists within playlist) structures.
   * @param {Object} jsonOutput - Parsed JSON from yt-dlp
   * @returns {Array} - Array of parsed video metadata objects
   */
  extractVideosFromYtDlpResponse(jsonOutput) {
    const videos = [];

    if (!jsonOutput.entries || !Array.isArray(jsonOutput.entries)) {
      console.log('No entries found in yt-dlp JSON response');
      return videos;
    }

    const entries = jsonOutput.entries;

    // Prefer nested playlist selection using stable, non-localized URL slugs
    const playlists = entries.filter(e => e && e._type === 'playlist');
    if (playlists.length > 0) {
      // Find the Videos tab by webpage_url ending with /videos (or with query params)
      const videosPlaylist = playlists.find(p => {
        const url = typeof p.webpage_url === 'string' ? p.webpage_url : '';
        return url.endsWith('/videos') || url.includes('/videos?');
      });

      if (videosPlaylist && Array.isArray(videosPlaylist.entries)) {
        for (const entry of videosPlaylist.entries) {
          videos.push(this.parseVideoMetadata(entry));
        }
        return videos;
      }

      // Do not fallback to other playlists (e.g., Shorts/Live) if Videos tab isn't present
      return videos; // empty
    }

    // Flat structure fallback: entries are videos directly
    // Include typical watch URLs and exclude shorts URLs when possible
    // NOTE: This fallback should never be hit now that we are using canonical urls.. but just in case
    const flatVideoEntries = entries.filter(e => e && e._type !== 'playlist');
    if (flatVideoEntries.length > 0) {
      for (const entry of flatVideoEntries) {
        const url = String(entry && entry.url ? entry.url : '');
        if (url.includes('/shorts/')) continue;
        // If URL is missing, still include as a best-effort fallback
        videos.push(this.parseVideoMetadata(entry));
      }
    }

    return videos;
  }

  /**
   * Fetch channel videos using yt-dlp.
   * Retrieves metadata for recent videos from YouTube.
   * Uses canonical channel URL for stability when handles change.
   * @param {string} channelId - Channel ID to fetch videos for
   * @param {Date|null} mostRecentVideoDate - Date of the most recent video we have
   * @returns {Promise<Object>} - Object with videos array and current channel URL
   * @throws {Error} - If channel not found in database
   */
  async fetchChannelVideosViaYtDlp(channelId, mostRecentVideoDate = null) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Determine how many videos to fetch based on recency
    // If we have recent data (within 3 days), fetch fewer videos for faster response
    let videoCount = 50; // Default/max for initial fetch or stale data
    if (mostRecentVideoDate) {
      const daysSinceLastVideo = Math.floor((Date.now() - new Date(mostRecentVideoDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastVideo <= 5) {
        // If we fetched videos today, then fetch last 5 videos, else fetch 10 videos per day
        videoCount = Math.max(5, daysSinceLastVideo * 10);
      }
    }

    // Always use canonical URL based on channel ID for yt-dlp
    // This ensures stability even when channel handles change
    const canonicalUrl = this.resolveChannelUrlFromId(channelId);

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
   * Check if channel videos need refreshing
   * @param {Object} channel - Channel database record
   * @param {number} videoCount - Current video count
   * @returns {boolean} - True if refresh needed
   */
  shouldRefreshChannelVideos(channel, videoCount) {
    if (!channel) return false;

    return !channel.lastFetched ||
           new Date() - new Date(channel.lastFetched) > 1 * 60 * 60 * 1000 ||
           videoCount === 0;
  }

  /**
   * Build channel videos response object
   * @param {Array} videos - Array of videos
   * @param {Object} channel - Channel database record
   * @param {string} dataSource - Data source ('cache' or 'yt_dlp')
   * @returns {Object} - Formatted response
   */
  buildChannelVideosResponse(videos, channel, dataSource = 'cache') {
    return {
      videos: videos,
      videoFail: videos.length === 0,
      failureReason: videos.length === 0 ? 'fetch_error' : null,
      dataSource: dataSource,
      lastFetched: channel ? channel.lastFetched : null,
    };
  }

  /**
   * Get channel videos with smart caching.
   * Returns cached data if fresh, otherwise fetches new data from YouTube.
   * Falls back to cached data on errors.
   * @param {string} channelId - Channel ID to get videos for
   * @returns {Promise<Object>} - Response object with videos and metadata
   */
  async getChannelVideos(channelId) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    try {
      let newestVideos = await this.fetchNewestVideosFromDb(channelId);

      if (this.shouldRefreshChannelVideos(channel, newestVideos.length)) {
        // Get the most recent video date to optimize fetch count
        const mostRecentVideoDate = newestVideos.length > 0 ? newestVideos[0].publishedAt : null;
        await this.fetchAndSaveVideosViaYtDlp(channel, channelId, mostRecentVideoDate);
        newestVideos = await this.fetchNewestVideosFromDb(channelId);
        return this.buildChannelVideosResponse(newestVideos, channel, 'yt_dlp');
      }

      return this.buildChannelVideosResponse(newestVideos, channel, 'cache');

    } catch (error) {
      console.error('Error fetching channel videos:', error.message);
      const cachedVideos = await this.fetchNewestVideosFromDb(channelId);
      return this.buildChannelVideosResponse(cachedVideos, channel, 'cache');
    }
  }

  /**
   * Fetch videos from YouTube and save to database.
   * Updates channel's lastFetched timestamp on success.
   * Also updates the channel URL if it has changed (e.g., handle renamed).
   * @param {Object} channel - Channel database record
   * @param {string} channelId - Channel ID
   * @param {Date|null} mostRecentVideoDate - Date of the most recent video we have
   * @returns {Promise<void>}
   * @throws {Error} - Re-throws yt-dlp errors
   */
  async fetchAndSaveVideosViaYtDlp(channel, channelId, mostRecentVideoDate = null) {
    try {
      const result = await this.fetchChannelVideosViaYtDlp(channelId, mostRecentVideoDate);
      const { videos, currentChannelUrl } = result;

      if (videos.length > 0) {
        await this.insertVideosIntoDb(videos, channelId);
      }

      if (channel) {
        // Update URL if it has changed (e.g., handle renamed)
        if (currentChannelUrl && currentChannelUrl !== channel.url) {
          console.log(`Channel URL updated for ${channel.title}: ${currentChannelUrl}`);
          channel.url = currentChannelUrl;
        }

        channel.lastFetched = new Date();
        await channel.save();
      }
    } catch (ytdlpError) {
      console.error('Error fetching channel videos:', ytdlpError.message);
      throw ytdlpError;
    }
  }
}

module.exports = new ChannelModule();
