const configModule = require('./configModule');
const downloadModule = require('./downloadModule');
const tempPathManager = require('./download/tempPathManager');
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
const Playlist = require('../models/playlist');
const PlaylistVideo = require('../models/playlistvideo');
const Video = require('../models/video');
const MessageEmitter = require('./messageEmitter.js');
const { Op, fn, col, where } = require('sequelize');
const fileCheckModule = require('./fileCheckModule');
const logger = require('../logger');
const { sanitizeNameLikeYtDlp } = require('./filesystem');

const { spawn } = require('child_process');

const SUB_FOLDER_DEFAULT_KEY = '__default__';
const MAX_LOAD_MORE_VIDEOS = 5000;

class PlaylistModule {
  constructor() {
    this.playlistAutoDownload = this.playlistAutoDownload.bind(this);
    this.scheduleTask();
    this.subscribe();
    
    // Listen for config changes to reschedule task
    configModule.onConfigChange(() => {
      this.scheduleTask();
    });
    
    // Track active fetch operations per playlist to prevent concurrent fetches
    this.activeFetches = new Map();
  }

  /**
   * Check if a fetch operation is currently in progress for a playlist
   * @param {string} playlistId - Playlist ID to check
   * @returns {Object} - Object with isFetching boolean and operation details if fetching
   */
  isFetchInProgress(playlistId) {
    if (this.activeFetches.has(playlistId)) {
      const activeOperation = this.activeFetches.get(playlistId);
      return {
        isFetching: true,
        startTime: activeOperation.startTime,
        type: activeOperation.type
      };
    }
    return { isFetching: false };
  }

  /**
   * Execute yt-dlp command with promise-based handling
   * @param {Array} args - Pre-built arguments for yt-dlp command
   * @param {string|null} outputFile - Optional output file path
   * @returns {Promise<string>} - Output content if outputFile provided, or stdout
   */
  async executeYtDlpCommand(args, outputFile = null) {
    return new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      // Capture stdout (for --dump-json output)
      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        } else {
          if (outputFile) {
            try {
              // Write stdout to file
              await fs.writeFile(outputFile, stdout, 'utf8');
              resolve(stdout);
            } catch (writeError) {
              reject(new Error(`Failed to write output file: ${writeError.message}`));
            }
          } else {
            resolve(stdout);
          }
        }
      });

      ytdlp.on('error', (err) => {
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  }

  /**
   * Fetch playlist metadata from YouTube
   * @param {string} playlistUrl - Playlist URL
   * @returns {Promise<Object>} - Playlist metadata
   */
  async fetchPlaylistMetadata(playlistUrl) {
    const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
    const tempFile = path.join(tempPathManager.getTempBasePath(), `playlist-${Date.now()}.json`);

    try {
      const args = YtdlpCommandBuilder.buildPlaylistInfoArgs(playlistUrl, tempFile);
      const output = await this.executeYtDlpCommand(args, tempFile);
      const jsonOutput = JSON.parse(output);

      return jsonOutput;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        await fs.unlink(tempFile);
      }
    }
  }

  /**
   * Find playlist by URL or ID
   * @param {string} playlistUrlOrId - Playlist URL or ID
   * @returns {Promise<Object>} - Object with foundPlaylist and playlistUrl
   */
  async findPlaylistByUrlOrId(playlistUrlOrId) {
    let playlistUrl = playlistUrlOrId;
    
    // If it looks like a playlist ID (starts with PL), construct the URL
    if (playlistUrlOrId.startsWith('PL')) {
      playlistUrl = `https://www.youtube.com/playlist?list=${playlistUrlOrId}`;
    }

    // Try to find existing playlist by URL or ID
    const foundPlaylist = await Playlist.findOne({
      where: {
        [Op.or]: [
          { url: playlistUrl },
          { playlist_id: playlistUrlOrId }
        ]
      }
    });

    return { foundPlaylist, playlistUrl };
  }

  /**
   * Map playlist database record to response format
   * @param {Object} playlist - Playlist database record
   * @returns {Object} - Formatted playlist response
   */
  mapPlaylistToResponse(playlist) {
    return {
      id: playlist.playlist_id,
      playlist_id: playlist.playlist_id,
      uploader: playlist.uploader,
      uploader_id: playlist.uploader_id,
      title: playlist.title,
      description: playlist.description,
      url: playlist.url,
      enabled: playlist.enabled,
      auto_download_enabled: playlist.auto_download_enabled,
      sub_folder: playlist.sub_folder,
      video_quality: playlist.video_quality,
      folder_name: playlist.folder_name,
      min_duration: playlist.min_duration,
      max_duration: playlist.max_duration,
      title_filter_regex: playlist.title_filter_regex,
      audio_format: playlist.audio_format,
    };
  }

  /**
   * Get playlist information from database or fetch from YouTube
   * @param {string} playlistUrlOrId - YouTube playlist URL or playlist ID
   * @param {boolean} emitMessage - Whether to emit WebSocket update message
   * @param {boolean} enablePlaylist - Whether to enable the playlist if it's new
   * @returns {Promise<Object>} - Playlist information object
   */
  async getPlaylistInfo(playlistUrlOrId, emitMessage = true, enablePlaylist = false) {
    const { foundPlaylist, playlistUrl } = await this.findPlaylistByUrlOrId(playlistUrlOrId);

    if (foundPlaylist) {
      if (emitMessage) {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'playlist',
          'playlistsUpdated',
          { text: 'Playlist Updated' }
        );
      }
      return this.mapPlaylistToResponse(foundPlaylist);
    }

    logger.info('Fetching playlist metadata from YouTube');
    const playlistData = await this.fetchPlaylistMetadata(playlistUrl);
    logger.info('Playlist metadata fetched successfully');

    // Reject playlists with no videos
    if (!playlistData.entries || playlistData.entries.length === 0) {
      const error = new Error('Playlist has no videos');
      error.code = 'PLAYLIST_EMPTY';
      throw error;
    }

    const playlistId = playlistData.id;
    const folderName = sanitizeNameLikeYtDlp(playlistData.title || playlistData.uploader || playlistId);

    // Create the playlist record
    await this.upsertPlaylist({
      id: playlistId,
      title: playlistData.title,
      description: playlistData.description,
      uploader: playlistData.uploader,
      uploader_id: playlistData.uploader_id || playlistData.channel_id,
      url: playlistUrl,
      folder_name: folderName,
    }, enablePlaylist);

    if (emitMessage) {
      logger.debug('Playlist data fetched, emitting update message');
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'playlist',
        'playlistsUpdated',
        { text: 'Playlist Updated' }
      );
    }

    return {
      id: playlistId,
      playlist_id: playlistId,
      uploader: playlistData.uploader,
      uploader_id: playlistData.uploader_id || playlistData.channel_id,
      title: playlistData.title,
      description: playlistData.description,
      url: playlistUrl,
      enabled: enablePlaylist,
      auto_download_enabled: false,
      sub_folder: null,
      video_quality: null,
      folder_name: folderName,
    };
  }

  /**
   * Upsert playlist record in database
   * @param {Object} playlistData - Playlist data to upsert
   * @param {boolean} enable - Whether to enable the playlist
   * @returns {Promise<Object>} - Created or updated playlist
   */
  async upsertPlaylist(playlistData, enable = false) {
    const [playlist, created] = await Playlist.findOrCreate({
      where: { playlist_id: playlistData.id },
      defaults: {
        playlist_id: playlistData.id,
        title: playlistData.title,
        description: playlistData.description,
        uploader: playlistData.uploader,
        uploader_id: playlistData.uploader_id,
        url: playlistData.url,
        folder_name: playlistData.folder_name,
        enabled: enable,
        auto_download_enabled: false,
      },
    });

    if (!created) {
      // Update existing playlist
      await playlist.update({
        title: playlistData.title,
        description: playlistData.description,
        uploader: playlistData.uploader,
        uploader_id: playlistData.uploader_id,
        url: playlistData.url,
        folder_name: playlistData.folder_name,
      });
    }

    return playlist;
  }

  /**
   * Get paginated list of playlists
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated playlists response
   */
  async getPlaylistsPaginated({ page = 1, pageSize = 20, searchTerm = '', sortBy = 'uploader', sortOrder = 'ASC', subFolder = null }) {
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const whereClause = {};
    if (searchTerm) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${searchTerm}%` } },
        { uploader: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    if (subFolder !== null && subFolder !== undefined) {
      const normalizedSubFolder = subFolder === SUB_FOLDER_DEFAULT_KEY ? null : subFolder;
      whereClause.sub_folder = normalizedSubFolder;
    }

    const order = [[sortBy, sortOrder]];

    const { count, rows } = await Playlist.findAndCountAll({
      where: whereClause,
      order,
      limit,
      offset,
    });

    // Get unique subfolders for filter
    const subFolders = await Playlist.findAll({
      attributes: [[fn('DISTINCT', col('sub_folder')), 'sub_folder']],
      raw: true,
    });

    return {
      playlists: rows.map(p => this.mapPlaylistToResponse(p)),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      subFolders: subFolders.map(sf => sf.sub_folder),
    };
  }

  /**
   * Update playlist settings
   * @param {string} playlistId - Playlist ID
   * @param {Object} updates - Settings to update
   * @returns {Promise<Object>} - Updated playlist
   */
  async updatePlaylistSettings(playlistId, updates) {
    const playlist = await Playlist.findOne({
      where: { playlist_id: playlistId }
    });

    if (!playlist) {
      throw new Error('Playlist not found');
    }

    await playlist.update(updates);

    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'playlist',
      'playlistsUpdated',
      { text: 'Playlist settings updated' }
    );

    return this.mapPlaylistToResponse(playlist);
  }

  /**
   * Delete playlist and associated videos
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<void>}
   */
  async deletePlaylist(playlistId) {
    await PlaylistVideo.destroy({
      where: { playlist_id: playlistId }
    });

    await Playlist.destroy({
      where: { playlist_id: playlistId }
    });

    MessageEmitter.emitMessage(
      'broadcast',
      null,
      'playlist',
      'playlistsUpdated',
      { text: 'Playlist deleted' }
    );
  }

  /**
   * Fetch playlist videos from YouTube
   * @param {string} playlistId - Playlist ID
   * @param {Date|null} mostRecentVideoDate - Date of most recent video we have
   * @returns {Promise<Object>} - Object with videos array
   */
  async fetchPlaylistVideosViaYtDlp(playlistId, mostRecentVideoDate = null) {
    const playlist = await Playlist.findOne({
      where: { playlist_id: playlistId }
    });

    if (!playlist) {
      throw new Error('Playlist not found in database');
    }

    const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
    const tempFile = path.join(tempPathManager.getTempBasePath(), `playlist-videos-${Date.now()}.json`);

    try {
      const playlistUrl = playlist.url || `https://www.youtube.com/playlist?list=${playlistId}`;
      const args = YtdlpCommandBuilder.buildPlaylistVideoListArgs(playlistUrl, tempFile);
      
      const output = await this.executeYtDlpCommand(args, tempFile);
      
      // Parse multiple JSON objects (one per line)
      const videos = output
        .split('\n')
        .filter(line => line.trim())
        .map((line, index) => {
          try {
            const entry = JSON.parse(line);
            return {
              youtube_id: entry.id,
              title: entry.title,
              thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url,
              duration: entry.duration,
              publishedAt: entry.timestamp ? new Date(entry.timestamp * 1000).toISOString() : null,
              playlist_index: entry.playlist_index || index + 1,
              availability: entry.availability,
            };
          } catch (err) {
            logger.error({ err, line }, 'Failed to parse video entry');
            return null;
          }
        })
        .filter(v => v !== null);

      return { videos };
    } finally {
      if (fs.existsSync(tempFile)) {
        await fs.unlink(tempFile);
      }
    }
  }

  /**
   * Fetch all videos for a playlist and store in database
   * @param {string} playlistId - Playlist ID
   * @param {number} requestedPage - Page number for pagination
   * @param {number} requestedPageSize - Page size for pagination
   * @param {boolean} hideDownloaded - Whether to hide downloaded videos
   * @returns {Promise<Object>} - Response with videos and metadata
   */
  async fetchAllPlaylistVideos(playlistId, requestedPage = 1, requestedPageSize = 50, hideDownloaded = false) {
    const fetchKey = playlistId;
    const startTime = Date.now();

    // Check if fetch is already in progress
    if (this.activeFetches.has(fetchKey)) {
      throw new Error(`Fetch operation is already in progress for playlist ${playlistId}`);
    }

    // Mark fetch as active
    this.activeFetches.set(fetchKey, {
      startTime: new Date(),
      type: 'full_fetch'
    });

    try {
      const playlist = await Playlist.findOne({
        where: { playlist_id: playlistId }
      });

      if (!playlist) {
        throw new Error('Playlist not found');
      }

      // Get most recent video date
      const mostRecentVideo = await PlaylistVideo.findOne({
        where: { playlist_id: playlistId },
        order: [['publishedAt', 'DESC']],
      });

      const mostRecentVideoDate = mostRecentVideo?.publishedAt 
        ? new Date(mostRecentVideo.publishedAt) 
        : null;

      // Fetch videos from YouTube
      const { videos } = await this.fetchPlaylistVideosViaYtDlp(playlistId, mostRecentVideoDate);

      // Store videos in database
      for (const video of videos) {
        await PlaylistVideo.findOrCreate({
          where: {
            playlist_id: playlistId,
            youtube_id: video.youtube_id,
          },
          defaults: {
            ...video,
            playlist_id: playlistId,
            media_type: 'video',
          },
        });
      }

      // Update lastFetched timestamp
      await playlist.update({ lastFetched: new Date() });

      // Get paginated results
      const result = await this.getPlaylistVideos(
        playlistId,
        requestedPage,
        requestedPageSize,
        hideDownloaded
      );

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      logger.info({
        playlistId,
        elapsedSeconds,
        videosFound: videos.length
      }, 'Full playlist fetch completed');

      return {
        success: true,
        videosFound: videos.length,
        elapsedSeconds: elapsedSeconds,
        ...result
      };

    } catch (error) {
      logger.error({ err: error, playlistId }, 'Error fetching playlist videos');
      throw error;
    } finally {
      // Always clear the active fetch record
      this.activeFetches.delete(fetchKey);
    }
  }

  /**   * Get a single playlist by ID
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<Object|null>} - Playlist data or null if not found
   */
  async getPlaylist(playlistId) {
    try {
      const playlist = await Playlist.findOne({
        where: { playlist_id: playlistId },
      });

      if (!playlist) {
        return null;
      }

      return playlist.dataValues;
    } catch (error) {
      logger.error({ err: error, playlistId }, 'Error fetching playlist');
      throw error;
    }
  }

  /**   * Get paginated playlist videos
   * @param {string} playlistId - Playlist ID
   * @param {number} page - Page number
   * @param {number} pageSize - Page size
   * @param {boolean} hideDownloaded - Whether to hide downloaded videos
   * @param {string} searchQuery - Search query
   * @param {string} sortBy - Sort field
   * @param {string} sortOrder - Sort order
   * @returns {Promise<Object>} - Paginated videos response
   */
  async getPlaylistVideos(playlistId, page = 1, pageSize = 50, hideDownloaded = false, searchQuery = '', sortBy = 'playlist_index', sortOrder = 'asc') {
    const offset = (page - 1) * pageSize;

    const whereClause = { playlist_id: playlistId };

    if (searchQuery) {
      whereClause.title = { [Op.like]: `%${searchQuery}%` };
    }

    if (hideDownloaded) {
      // Check against videos table
      const downloadedVideoIds = await Video.findAll({
        attributes: ['youtubeId'],
        where: { removed: false },
        raw: true,
      });

      const downloadedIds = downloadedVideoIds.map(v => v.youtubeId);
      if (downloadedIds.length > 0) {
        whereClause.youtube_id = { [Op.notIn]: downloadedIds };
      }
    }

    // Map sort fields
    const sortField = sortBy === 'date' ? 'publishedAt' : sortBy;
    const order = [[sortField, sortOrder.toUpperCase()]];

    const { count, rows } = await PlaylistVideo.findAndCountAll({
      where: whereClause,
      order,
      limit: pageSize,
      offset,
    });

    // Check which videos are already downloaded
    const youtubeIds = rows.map(v => v.youtube_id);
    const downloadedVideos = await Video.findAll({
      where: { youtubeId: { [Op.in]: youtubeIds } },
      attributes: ['youtubeId'],
      raw: true,
    });

    const downloadedSet = new Set(downloadedVideos.map(v => v.youtubeId));

    const videosWithDownloadStatus = rows.map(v => ({
      youtube_id: v.youtube_id,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      publishedAt: v.publishedAt,
      playlist_index: v.playlist_index,
      added: downloadedSet.has(v.youtube_id),
      media_type: v.media_type,
      ignored: v.ignored,
    }));

    return {
      videos: videosWithDownloadStatus,
      totalCount: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
    };
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }

  /**
   * Schedule automatic playlist download task
   */
  scheduleTask() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    const config = configModule.getConfig();
    const isAutoDownloadEnabled = config.playlistAutoDownload;
    const cronSchedule = config.playlistDownloadFrequency || '0 */6 * * *'; // Default: every 6 hours

    if (isAutoDownloadEnabled) {
      logger.info({ cronSchedule }, 'Scheduling playlist auto-download task');
      this.task = cron.schedule(cronSchedule, this.playlistAutoDownload, {
        scheduled: true,
      });
    } else {
      logger.info('Playlist auto-download is disabled');
    }
  }

  /**
   * Auto-download videos from enabled playlists
   */
  async playlistAutoDownload() {
    logger.info('Starting automatic playlist download');

    try {
      const enabledPlaylists = await Playlist.findAll({
        where: {
          enabled: true,
          auto_download_enabled: true,
        },
      });

      logger.info({ count: enabledPlaylists.length }, 'Found enabled playlists for auto-download');

      for (const playlist of enabledPlaylists) {
        try {
          // Fetch latest videos
          await this.fetchAllPlaylistVideos(playlist.playlist_id, 1, 50, false);

          // Get videos that aren't downloaded yet
          const { videos } = await this.getPlaylistVideos(
            playlist.playlist_id,
            1,
            1000, // Get many videos to check
            true // hideDownloaded
          );

          // Apply filters if configured
          let filteredVideos = videos.filter(v => !v.ignored);

          if (playlist.min_duration) {
            filteredVideos = filteredVideos.filter(v => !v.duration || v.duration >= playlist.min_duration);
          }

          if (playlist.max_duration) {
            filteredVideos = filteredVideos.filter(v => !v.duration || v.duration <= playlist.max_duration);
          }

          if (playlist.title_filter_regex) {
            const regex = new RegExp(playlist.title_filter_regex, 'i');
            filteredVideos = filteredVideos.filter(v => regex.test(v.title));
          }

          // Download videos using the same method as manual downloads
          if (filteredVideos.length > 0) {
            const urls = filteredVideos.map(video => 
              `https://www.youtube.com/watch?v=${video.youtube_id}`
            );

            const overrideSettings = {};
            if (playlist.video_quality) {
              overrideSettings.resolution = playlist.video_quality;
            }
            if (playlist.sub_folder) {
              overrideSettings.subfolder = playlist.sub_folder;
            }

            await downloadModule.doSpecificDownloads({
              body: {
                urls: urls,
                overrideSettings: Object.keys(overrideSettings).length > 0 ? overrideSettings : undefined,
                initiatedBy: { 
                  type: 'playlist_auto', 
                  name: playlist.title || `Playlist ${playlist.playlist_id}` 
                }
              }
            });
          }

          logger.info({
            playlistId: playlist.playlist_id,
            videosQueued: filteredVideos.length
          }, 'Queued playlist videos for download');

        } catch (error) {
          logger.error({ err: error, playlistId: playlist.playlist_id }, 'Error auto-downloading from playlist');
        }
      }

      logger.info('Automatic playlist download completed');
    } catch (error) {
      logger.error({ err: error }, 'Error in playlist auto-download');
    }
  }

  /**
   * Toggle ignore status for a playlist video
   * @param {string} playlistId - Playlist ID
   * @param {string} youtubeId - YouTube video ID
   * @param {boolean} ignored - Whether to ignore the video
   * @returns {Promise<void>}
   */
  async togglePlaylistVideoIgnore(playlistId, youtubeId, ignored) {
    const playlistVideo = await PlaylistVideo.findOne({
      where: { playlist_id: playlistId, youtube_id: youtubeId }
    });

    if (!playlistVideo) {
      throw new Error('Playlist video not found');
    }

    await playlistVideo.update({
      ignored,
      ignored_at: ignored ? new Date() : null,
    });
  }
  /**
   * Queue all non-ignored videos from a playlist for download
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<Object>} - Result with jobId and videoCount
   */
  async queuePlaylistDownload(playlistId) {
    // Get playlist
    const playlist = await Playlist.findOne({
      where: { playlist_id: playlistId }
    });

    if (!playlist) {
      const error = new Error('Playlist not found');
      error.code = 'PLAYLIST_NOT_FOUND';
      throw error;
    }

    // Get all non-ignored videos
    const videos = await PlaylistVideo.findAll({
      where: {
        playlist_id: playlistId,
        ignored: false
      },
      order: [['playlist_index', 'ASC']]
    });

    if (videos.length === 0) {
      return {
        message: 'No videos to download',
        videoCount: 0,
        jobId: null
      };
    }

    // Apply playlist filters
    let filteredVideos = [...videos];

    if (playlist.min_duration) {
      filteredVideos = filteredVideos.filter(v => !v.duration || v.duration >= playlist.min_duration);
    }

    if (playlist.max_duration) {
      filteredVideos = filteredVideos.filter(v => !v.duration || v.duration <= playlist.max_duration);
    }

    if (playlist.title_filter_regex) {
      const regex = new RegExp(playlist.title_filter_regex, 'i');
      filteredVideos = filteredVideos.filter(v => regex.test(v.title));
    }

    logger.info({
      playlistId,
      totalVideos: videos.length,
      filteredVideos: filteredVideos.length
    }, 'Queueing playlist videos for download');

    // Build URL array for download
    const urls = filteredVideos.map(video => 
      `https://www.youtube.com/watch?v=${video.youtube_id}`
    );

    if (urls.length === 0) {
      return {
        message: 'No videos to download after applying filters',
        videoCount: 0,
        jobId: null
      };
    }

    // Build override settings for quality and subfolder
    const overrideSettings = {};
    if (playlist.video_quality) {
      overrideSettings.resolution = playlist.video_quality;
    }
    if (playlist.sub_folder) {
      overrideSettings.subfolder = playlist.sub_folder;
    }

    // Queue all videos as a single download job
    await downloadModule.doSpecificDownloads({
      body: {
        urls: urls,
        overrideSettings: Object.keys(overrideSettings).length > 0 ? overrideSettings : undefined,
        initiatedBy: { 
          type: 'playlist', 
          name: playlist.title || `Playlist ${playlistId}` 
        }
      }
    });

    return {
      message: `Queued ${filteredVideos.length} videos for download`,
      videoCount: filteredVideos.length
    };
  }

  /**
   * Manually download new videos from all enabled playlists
   * Similar to playlistAutoDownload but can be triggered manually
   * @param {Object} overrideSettings - Optional override settings for resolution, videoCount, etc.
   * @returns {Promise<Object>} - Summary of downloads queued
   */
  async downloadAllPlaylists(overrideSettings = {}) {
    logger.info('Starting manual download from all playlists');

    try {
      const enabledPlaylists = await Playlist.findAll({
        where: {
          enabled: true,
          auto_download_enabled: true,
        },
      });

      logger.info({ count: enabledPlaylists.length }, 'Found enabled playlists for manual download');

      let totalVideosQueued = 0;
      const results = [];

      for (const playlist of enabledPlaylists) {
        try {
          // Fetch latest videos
          await this.fetchAllPlaylistVideos(playlist.playlist_id, 1, 50, false);

          // Get videos that aren't downloaded yet
          const { videos } = await this.getPlaylistVideos(
            playlist.playlist_id,
            1,
            1000, // Get many videos to check
            true // hideDownloaded
          );

          // Apply filters if configured
          let filteredVideos = videos.filter(v => !v.ignored);

          if (playlist.min_duration) {
            filteredVideos = filteredVideos.filter(v => !v.duration || v.duration >= playlist.min_duration);
          }

          if (playlist.max_duration) {
            filteredVideos = filteredVideos.filter(v => !v.duration || v.duration <= playlist.max_duration);
          }

          if (playlist.title_filter_regex) {
            const regex = new RegExp(playlist.title_filter_regex, 'i');
            filteredVideos = filteredVideos.filter(v => regex.test(v.title));
          }

          // Download videos using the same method as manual downloads
          if (filteredVideos.length > 0) {
            const urls = filteredVideos.map(video => 
              `https://www.youtube.com/watch?v=${video.youtube_id}`
            );

            const playlistOverrideSettings = {};
            
            // Use override settings first, then playlist settings
            if (overrideSettings.resolution || playlist.video_quality) {
              playlistOverrideSettings.resolution = overrideSettings.resolution || playlist.video_quality;
            }
            if (playlist.sub_folder) {
              playlistOverrideSettings.subfolder = playlist.sub_folder;
            }

            await downloadModule.doSpecificDownloads({
              body: {
                urls: urls,
                overrideSettings: Object.keys(playlistOverrideSettings).length > 0 ? playlistOverrideSettings : undefined,
                initiatedBy: { 
                  type: 'playlist_manual', 
                  name: playlist.title || `Playlist ${playlist.playlist_id}` 
                }
              }
            });

            totalVideosQueued += filteredVideos.length;
            results.push({
              playlistId: playlist.playlist_id,
              playlistTitle: playlist.title,
              videosQueued: filteredVideos.length
            });
          }

          logger.info({
            playlistId: playlist.playlist_id,
            videosQueued: filteredVideos.length
          }, 'Queued playlist videos for manual download');

        } catch (error) {
          logger.error({ err: error, playlistId: playlist.playlist_id }, 'Error manually downloading from playlist');
          results.push({
            playlistId: playlist.playlist_id,
            playlistTitle: playlist.title,
            error: error.message
          });
        }
      }

      logger.info({ totalVideosQueued }, 'Manual download from all playlists completed');
      
      return {
        success: true,
        message: `Queued ${totalVideosQueued} videos from ${enabledPlaylists.length} playlist(s)`,
        totalVideos: totalVideosQueued,
        playlistCount: enabledPlaylists.length,
        results
      };
    } catch (error) {
      logger.error({ err: error }, 'Error in manual playlist downloads');
      throw error;
    }
  }
}

module.exports = new PlaylistModule();
