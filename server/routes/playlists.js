const express = require('express');
const router = express.Router();

/**
 * Creates playlist routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.playlistModule - Playlist module
 * @returns {express.Router}
 */
module.exports = function createPlaylistRoutes({ verifyToken, playlistModule }) {
  const PlaylistVideo = require('../models/playlistvideo');

  /**
   * @swagger
   * /getplaylists:
   *   get:
   *     summary: Get playlists list
   *     description: Retrieve a paginated list of YouTube playlists.
   *     tags: [Playlists]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for filtering playlists
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [uploader, title]
   *           default: uploader
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [ASC, DESC]
   *           default: ASC
   *         description: Sort order
   *       - in: query
   *         name: subFolder
   *         schema:
   *           type: string
   *         description: Filter by subfolder
   *     responses:
   *       200:
   *         description: Paginated list of playlists
   *       500:
   *         description: Failed to fetch playlists
   */
  router.get('/getplaylists', verifyToken, async (req, res) => {
    try {
      const result = await playlistModule.getPlaylistsPaginated({
        page: req.query.page,
        pageSize: req.query.pageSize,
        searchTerm: req.query.search,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        subFolder: req.query.subFolder,
      });
      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to fetch playlists');
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  });

  /**
   * @swagger
   * /updateplaylists:
   *   post:
   *     summary: Update playlists
   *     description: Add, remove, or update YouTube playlists.
   *     tags: [Playlists]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     url:
   *                       type: string
   *                     enabled:
   *                       type: boolean
   *               - type: object
   *                 properties:
   *                   add:
   *                     type: array
   *                     items:
   *                       type: string
   *                   remove:
   *                     type: array
   *                     items:
   *                       type: string
   *     responses:
   *       200:
   *         description: Playlists updated successfully
   *       500:
   *         description: Failed to update playlists
   */
  router.post('/updateplaylists', verifyToken, async (req, res) => {
    try {
      let playlistsToAdd = [];
      let playlistsToRemove = [];

      // Support both array format and delta format
      if (Array.isArray(req.body)) {
        // Legacy array format (for backward compatibility if needed)
        playlistsToAdd = req.body.filter(p => p.enabled);
      } else if (req.body.add || req.body.remove) {
        // Delta format
        playlistsToAdd = req.body.add || [];
        playlistsToRemove = req.body.remove || [];
      }

      // Remove playlists
      for (const playlistId of playlistsToRemove) {
        await playlistModule.deletePlaylist(playlistId);
      }

      // Add playlists
      const addedPlaylists = [];
      for (const playlistUrl of playlistsToAdd) {
        try {
          const playlistInfo = await playlistModule.getPlaylistInfo(playlistUrl, false, true);
          addedPlaylists.push(playlistInfo);
        } catch (error) {
          req.log.error({ err: error, playlistUrl }, 'Failed to add playlist');
        }
      }

      res.json({
        success: true,
        added: addedPlaylists.length,
        removed: playlistsToRemove.length,
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to update playlists');
      res.status(500).json({ error: 'Failed to update playlists' });
    }
  });

  /**
   * @swagger
   * /addplaylistinfo:
   *   post:
   *     summary: Add playlist info
   *     description: Fetch and add information about a YouTube playlist by URL.
   *     tags: [Playlists]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - url
   *             properties:
   *               url:
   *                 type: string
   *                 description: YouTube playlist URL
   *     responses:
   *       200:
   *         description: Playlist info retrieved successfully
   *       400:
   *         description: URL is missing
   *       500:
   *         description: Failed to get playlist info
   */
  router.post('/addplaylistinfo', verifyToken, async (req, res) => {
    const logger = require('../logger');
    logger.info('addplaylistinfo endpoint start');
    const url = req.body.url;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is missing in the request'
      });
    }

    try {
      req.log.info({ url }, 'Adding playlist info');
      let playlistInfo = await playlistModule.getPlaylistInfo(url, false);
      logger.info('addplaylistinfo returning result');
      res.json({ status: 'success', playlistInfo: playlistInfo });
    } catch (error) {
      req.log.error({ err: error, url }, 'Failed to get playlist info');
      
      if (error.code === 'PLAYLIST_EMPTY') {
        return res.status(404).json({
          status: 'error',
          message: 'Playlist has no videos or could not be found'
        });
      }
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch playlist information'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/settings:
   *   put:
   *     summary: Update playlist settings
   *     description: Update settings for a specific playlist.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               enabled:
   *                 type: boolean
   *               auto_download_enabled:
   *                 type: boolean
   *               sub_folder:
   *                 type: string
   *               video_quality:
   *                 type: string
   *               min_duration:
   *                 type: integer
   *               max_duration:
   *                 type: integer
   *               title_filter_regex:
   *                 type: string
   *               audio_format:
   *                 type: string
   *     responses:
   *       200:
   *         description: Settings updated successfully
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Failed to update settings
   */
  router.put('/api/playlists/:playlistId/settings', verifyToken, async (req, res) => {
    const { playlistId } = req.params;
    
    try {
      const playlist = await playlistModule.updatePlaylistSettings(playlistId, req.body);
      res.json({ success: true, playlist });
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to update playlist settings');
      
      if (error.message === 'Playlist not found') {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      res.status(500).json({ error: 'Failed to update playlist settings' });
    }
  });

  /**
   * @swagger
   * /getplaylistvideos/{playlistId}:
   *   get:
   *     summary: Get playlist videos
   *     description: Retrieve a paginated list of videos for a specific playlist.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: hideDownloaded
   *         schema:
   *           type: boolean
   *           default: false
   *       - in: query
   *         name: searchQuery
   *         schema:
   *           type: string
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           default: playlist_index
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *     responses:
   *       200:
   *         description: List of playlist videos
   *       500:
   *         description: Failed to get playlist videos
   */
  router.get('/getplaylistvideos/:playlistId', verifyToken, async (req, res) => {
    req.log.info({ playlistId: req.params.playlistId }, 'Getting playlist videos');
    const playlistId = req.params.playlistId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const hideDownloaded = req.query.hideDownloaded === 'true';
    const searchQuery = req.query.searchQuery || '';
    const sortBy = req.query.sortBy || 'playlist_index';
    const sortOrder = req.query.sortOrder || 'asc';

    try {
      const result = await playlistModule.getPlaylistVideos(
        playlistId,
        page,
        pageSize,
        hideDownloaded,
        searchQuery,
        sortBy,
        sortOrder
      );

      res.status(200).json(result);
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to get playlist videos');
      res.status(500).json({ error: 'Failed to get playlist videos' });
    }
  });

  /**
   * @swagger
   * /fetchallplaylistvideos/{playlistId}:
   *   post:
   *     summary: Fetch all playlist videos
   *     description: Trigger a full fetch of all videos from a playlist.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: hideDownloaded
   *         schema:
   *           type: boolean
   *           default: false
   *     responses:
   *       200:
   *         description: Fetch completed
   *       409:
   *         description: Fetch operation already in progress
   *       500:
   *         description: Failed to fetch videos
   */
  router.post('/fetchallplaylistvideos/:playlistId', verifyToken, async (req, res) => {
    req.log.info({ playlistId: req.params.playlistId }, 'Fetching all videos for playlist');
    const playlistId = req.params.playlistId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const hideDownloaded = req.query.hideDownloaded === 'true';

    try {
      const result = await playlistModule.fetchAllPlaylistVideos(playlistId, page, pageSize, hideDownloaded);
      res.status(200).json(result);
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to fetch all playlist videos');

      const isConcurrencyError = error.message.includes('fetch operation is already in progress');
      const statusCode = isConcurrencyError ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        error: isConcurrencyError ? 'FETCH_IN_PROGRESS' : 'Failed to fetch all playlist videos',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/fetch-status:
   *   get:
   *     summary: Get playlist fetch status
   *     description: Check if a fetch operation is in progress for a playlist.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Fetch status
   *       500:
   *         description: Failed to get fetch status
   */
  router.get('/api/playlists/:playlistId/fetch-status', verifyToken, async (req, res) => {
    const { playlistId } = req.params;

    try {
      const status = playlistModule.isFetchInProgress(playlistId);
      res.status(200).json(status);
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to get fetch status');
      res.status(500).json({
        isFetching: false,
        error: 'Failed to get fetch status'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/videos/{youtubeId}/ignore:
   *   post:
   *     summary: Ignore a video
   *     description: Mark a playlist video as ignored so it won't be downloaded.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Video ignored successfully
   *       404:
   *         description: Playlist video not found
   *       500:
   *         description: Failed to ignore video
   */
  router.post('/api/playlists/:playlistId/videos/:youtubeId/ignore', verifyToken, async (req, res) => {
    const { playlistId, youtubeId } = req.params;
    req.log.info({ playlistId, youtubeId }, 'Ignoring playlist video');

    try {
      await playlistModule.togglePlaylistVideoIgnore(playlistId, youtubeId, true);
      res.status(200).json({ success: true });
    } catch (error) {
      req.log.error({ err: error, playlistId, youtubeId }, 'Failed to ignore video');
      
      if (error.message === 'Playlist video not found') {
        return res.status(404).json({
          success: false,
          error: 'Playlist video not found'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to ignore video'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/videos/{youtubeId}/unignore:
   *   post:
   *     summary: Unignore a video
   *     description: Remove the ignore flag from a playlist video.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Video unignored successfully
   *       404:
   *         description: Playlist video not found
   *       500:
   *         description: Failed to unignore video
   */
  router.post('/api/playlists/:playlistId/videos/:youtubeId/unignore', verifyToken, async (req, res) => {
    const { playlistId, youtubeId } = req.params;
    req.log.info({ playlistId, youtubeId }, 'Unignoring playlist video');

    try {
      await playlistModule.togglePlaylistVideoIgnore(playlistId, youtubeId, false);
      res.status(200).json({ success: true });
    } catch (error) {
      req.log.error({ err: error, playlistId, youtubeId }, 'Failed to unignore video');
      
      if (error.message === 'Playlist video not found') {
        return res.status(404).json({
          success: false,
          error: 'Playlist video not found'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to unignore video'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/download:
   *   post:
   *     summary: Queue playlist videos for download
   *     description: Queue all videos from a playlist for download.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Videos queued successfully
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Failed to queue downloads
   */
  router.post('/api/playlists/:playlistId/download', verifyToken, async (req, res) => {
    const { playlistId } = req.params;
    req.log.info({ playlistId }, 'Queueing playlist videos for download');

    try {
      const result = await playlistModule.queuePlaylistDownload(playlistId);
      res.status(200).json({
        success: true,
        message: result.message,
        jobId: result.jobId,
        videoCount: result.videoCount
      });
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to queue playlist download');
      
      if (error.code === 'PLAYLIST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Playlist not found'
        });
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to queue playlist download'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   delete:
   *     summary: Delete playlist
   *     description: Delete a playlist and all its associated videos.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Playlist deleted successfully
   *       500:
   *         description: Failed to delete playlist
   */
  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   get:
   *     summary: Get a single playlist by ID
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Playlist details
   *       404:
   *         description: Playlist not found
   */
  router.get('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    const { playlistId } = req.params;

    try {
      const playlist = await playlistModule.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({
          success: false,
          error: 'Playlist not found'
        });
      }

      res.status(200).json(playlist);
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to fetch playlist');
      res.status(500).json({
        success: false,
        error: 'Failed to fetch playlist'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/download-all:
   *   post:
   *     summary: Download new videos from all enabled playlists
   *     description: Manually trigger download of new videos from all playlists that have auto-download enabled
   *     tags: [Playlists]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               overrideSettings:
   *                 type: object
   *                 properties:
   *                   resolution:
   *                     type: string
   *                     enum: ['360', '480', '720', '1080', '1440', '2160']
   *                     description: Override download resolution for all playlists
   *     responses:
   *       200:
   *         description: Playlist downloads initiated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 totalVideos:
   *                   type: integer
   *                 playlistCount:
   *                   type: integer
   *       400:
   *         description: Invalid settings provided
   *       500:
   *         description: Failed to initiate downloads
   */
  router.post('/api/playlists/download-all', verifyToken, async (req, res) => {
    req.log.info('Triggering manual download from all playlists');

    try {
      const { overrideSettings } = req.body;
      
      // Validate override settings if provided
      if (overrideSettings) {
        if (overrideSettings.resolution) {
          const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
          if (!validResolutions.includes(overrideSettings.resolution)) {
            return res.status(400).json({
              error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
            });
          }
        }
      }

      const result = await playlistModule.downloadAllPlaylists(overrideSettings || {});
      res.status(200).json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to trigger playlist downloads');
      res.status(500).json({
        success: false,
        error: 'Failed to initiate playlist downloads'
      });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   delete:
   *     summary: Delete a playlist
   *     tags: [Playlists]
   */
  router.delete('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    const { playlistId } = req.params;
    req.log.info({ playlistId }, 'Deleting playlist');

    try {
      await playlistModule.deletePlaylist(playlistId);
      res.status(200).json({ success: true });
    } catch (error) {
      req.log.error({ err: error, playlistId }, 'Failed to delete playlist');
      res.status(500).json({
        success: false,
        error: 'Failed to delete playlist'
      });
    }
  });

  return router;
};
