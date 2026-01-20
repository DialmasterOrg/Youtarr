const express = require('express');
const router = express.Router();

/**
 * Creates channel routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.channelModule - Channel module
 * @param {Object} deps.archiveModule - Archive module
 * @returns {express.Router}
 */
module.exports = function createChannelRoutes({ verifyToken, channelModule, archiveModule }) {
  const channelSettingsModule = require('../modules/channelSettingsModule');
  const ChannelVideo = require('../models/channelvideo');

  /**
   * @swagger
   * /getchannels:
   *   get:
   *     summary: Get channels list
   *     description: Retrieve a paginated list of YouTube channels.
   *     tags: [Channels]
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
   *         description: Number of items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term to filter channels
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort order
   *       - in: query
   *         name: subFolder
   *         schema:
   *           type: string
   *         description: Filter by subfolder
   *     responses:
   *       200:
   *         description: List of channels
   *       500:
   *         description: Failed to fetch channels
   */
  router.get('/getchannels', verifyToken, async (req, res) => {
    try {
      const result = await channelModule.getChannelsPaginated({
        page: req.query.page,
        pageSize: req.query.pageSize,
        searchTerm: req.query.search,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        subFolder: req.query.subFolder,
      });
      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to fetch channels');
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  /**
   * @swagger
   * /updatechannels:
   *   post:
   *     summary: Update channels
   *     description: Add, remove, or update YouTube channels. Accepts either an array of channels or a delta object with add/remove arrays.
   *     tags: [Channels]
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
   *                     description: Channel URLs to enable
   *                   remove:
   *                     type: array
   *                     items:
   *                       type: string
   *                     description: Channel URLs to disable
   *     responses:
   *       200:
   *         description: Channels updated successfully
   *       400:
   *         description: Invalid payload
   *       500:
   *         description: Failed to update channels
   */
  router.post('/updatechannels', verifyToken, async (req, res) => {
    try {
      const payload = req.body;

      if (Array.isArray(payload)) {
        await channelModule.writeChannels(payload);
        return res.json({ status: 'success' });
      }

      if (payload && (Array.isArray(payload.add) || Array.isArray(payload.remove))) {
        const enableUrls = Array.isArray(payload.add) ? payload.add : [];
        const disableUrls = Array.isArray(payload.remove) ? payload.remove : [];

        if (enableUrls.length === 0 && disableUrls.length === 0) {
          return res.status(400).json({
            status: 'error',
            message: 'No channel changes provided'
          });
        }

        await channelModule.updateChannelsByDelta({ enableUrls, disableUrls });
        return res.json({ status: 'success' });
      }

      return res.status(400).json({
        status: 'error',
        message: 'Invalid payload for channel update'
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to update channels');
      res.status(500).json({
        status: 'error',
        message: 'Failed to update channels'
      });
    }
  });

  /**
   * @swagger
   * /addchannelinfo:
   *   post:
   *     summary: Add channel info
   *     description: Fetch and add information about a YouTube channel by URL.
   *     tags: [Channels]
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
   *                 description: YouTube channel URL
   *     responses:
   *       200:
   *         description: Channel info retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 channelInfo:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     channel_id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     description:
   *                       type: string
   *       400:
   *         description: URL is missing
   *       403:
   *         description: Cookies required
   *       404:
   *         description: Channel not found
   *       503:
   *         description: Unable to connect to YouTube
   */
  router.post('/addchannelinfo', verifyToken, async (req, res) => {
    const logger = require('../logger');
    logger.info('addchannelinfo endpoint start');
    const url = req.body.url;
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is missing in the request'
      });
    }

    try {
      req.log.info({ url }, 'Adding channel info');
      let channelInfo = await channelModule.getChannelInfo(url, false);
      channelInfo.channel_id = channelInfo.id;
      logger.info('addchannelinfo returning result');
      res.json({ status: 'success', channelInfo: channelInfo });
    } catch (error) {
      req.log.error({ err: error, url }, 'Failed to get channel info');

      if (error.code === 'CHANNEL_NOT_FOUND') {
        return res.status(404).json({
          status: 'error',
          message: 'Channel not found. Please check the URL and try again.',
          error: error.message
        });
      } else if (error.code === 'COOKIES_REQUIRED') {
        return res.status(403).json({
          status: 'error',
          message: error.message,
          error: error.message
        });
      } else if (error.code === 'NETWORK_ERROR') {
        return res.status(503).json({
          status: 'error',
          message: 'Unable to connect to YouTube. Please try again later.',
          error: error.message
        });
      } else if (error.code === 'CHANNEL_EMPTY') {
        return res.status(422).json({
          status: 'error',
          message: 'This channel has no videos to download.',
          error: error.message
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to get channel information. Please try again.',
          error: error.message || 'Unknown error'
        });
      }
    }
  });

  /**
   * @swagger
   * /getchannelinfo/{channelId}:
   *   get:
   *     summary: Get channel info
   *     description: Retrieve detailed information about a specific channel.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *     responses:
   *       200:
   *         description: Channel information
   */
  router.get('/getchannelinfo/:channelId', verifyToken, async (req, res) => {
    const channelId = req.params.channelId;
    const channelInfo = await channelModule.getChannelInfo(channelId, true);
    res.json(channelInfo);
  });

  /**
   * @swagger
   * /api/channels/{channelId}/tabs:
   *   get:
   *     summary: Get channel tabs
   *     description: Get available tabs (videos, shorts, streams) for a channel.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *     responses:
   *       200:
   *         description: Available tabs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 availableTabs:
   *                   type: array
   *                   items:
   *                     type: string
   *                     enum: [videos, shorts, streams]
   *       500:
   *         description: Failed to get available tabs
   */
  router.get('/api/channels/:channelId/tabs', verifyToken, async (req, res) => {
    req.log.info({ channelId: req.params.channelId }, 'Getting available tabs for channel');
    const channelId = req.params.channelId;

    try {
      // Returns { availableTabs: string[] }
      const result = await channelModule.getChannelAvailableTabs(channelId);
      res.status(200).json(result);
    } catch (error) {
      req.log.error({ err: error, channelId }, 'Failed to get available tabs');
      res.status(500).json({
        error: 'Failed to get available tabs',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/tabs/{tabType}/auto-download:
   *   patch:
   *     summary: Update tab auto-download setting
   *     description: Enable or disable auto-download for a specific channel tab.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *       - in: path
   *         name: tabType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [videos, shorts, streams]
   *         description: Tab type
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - enabled
   *             properties:
   *               enabled:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Setting updated successfully
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Failed to update setting
   */
  router.patch('/api/channels/:channelId/tabs/:tabType/auto-download', verifyToken, async (req, res) => {
    const { channelId, tabType } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'enabled must be a boolean value'
      });
    }

    try {
      await channelModule.updateAutoDownloadForTab(channelId, tabType, enabled);
      res.status(200).json({ success: true });
    } catch (error) {
      req.log.error({ err: error, channelId, tabType, enabled }, 'Failed to update auto download setting');
      res.status(500).json({
        error: 'Failed to update auto download setting',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/settings:
   *   get:
   *     summary: Get channel settings
   *     description: Retrieve settings for a specific channel.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *     responses:
   *       200:
   *         description: Channel settings
   *       500:
   *         description: Failed to get settings
   */
  router.get('/api/channels/:channelId/settings', verifyToken, async (req, res) => {
    try {
      const settings = await channelSettingsModule.getChannelSettings(req.params.channelId);
      res.json(settings);
    } catch (error) {
      console.error('Error getting channel settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/settings:
   *   put:
   *     summary: Update channel settings
   *     description: Update settings for a specific channel.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               subfolder:
   *                 type: string
   *               title_filter_regex:
   *                 type: string
   *     responses:
   *       200:
   *         description: Settings updated successfully
   *       409:
   *         description: Cannot change subfolder while downloads are in progress
   *       500:
   *         description: Failed to update settings
   */
  router.put('/api/channels/:channelId/settings', verifyToken, async (req, res) => {
    try {
      const result = await channelSettingsModule.updateChannelSettings(
        req.params.channelId,
        req.body
      );
      res.json(result);
    } catch (error) {
      console.error('Error updating channel settings:', error);
      const statusCode = error.message.includes('Cannot change subfolder while downloads are in progress') ? 409 : 500;
      res.status(statusCode).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/channels/subfolders:
   *   get:
   *     summary: Get all subfolders
   *     description: Get a list of all subfolders used by channels.
   *     tags: [Channels]
   *     responses:
   *       200:
   *         description: List of subfolders
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Failed to get subfolders
   */
  router.get('/api/channels/subfolders', verifyToken, async (req, res) => {
    try {
      const subfolders = await channelSettingsModule.getAllSubFolders();
      res.json(subfolders);
    } catch (error) {
      console.error('Error getting subfolders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/channels/using-default-subfolder:
   *   get:
   *     summary: Get channels using default subfolder
   *     description: Get count of channels that are using the default subfolder setting.
   *     tags: [Channels]
   *     responses:
   *       200:
   *         description: Count of channels using default subfolder
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: integer
   *       500:
   *         description: Failed to get count
   */
  router.get('/api/channels/using-default-subfolder', verifyToken, async (req, res) => {
    try {
      const result = await channelSettingsModule.getChannelsUsingDefaultSubfolder();
      res.json(result);
    } catch (error) {
      console.error('Error getting channels using default subfolder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/filter-preview:
   *   get:
   *     summary: Preview title filter
   *     description: Preview which videos would be matched by a title filter regex.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
   *       - in: query
   *         name: title_filter_regex
   *         schema:
   *           type: string
   *         description: Regex pattern to test
   *     responses:
   *       200:
   *         description: Filter preview results
   *       500:
   *         description: Failed to preview filter
   */
  router.get('/api/channels/:channelId/filter-preview', verifyToken, async (req, res) => {
    try {
      const { title_filter_regex } = req.query;
      const result = await channelSettingsModule.previewTitleFilter(
        req.params.channelId,
        title_filter_regex || ''
      );
      res.json(result);
    } catch (error) {
      console.error('Error previewing title filter:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /getchannelvideos/{channelId}:
   *   get:
   *     summary: Get channel videos
   *     description: Retrieve a paginated list of videos for a specific channel.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
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
   *           default: date
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *       - in: query
   *         name: tabType
   *         schema:
   *           type: string
   *           enum: [videos, shorts, streams]
   *           default: videos
   *     responses:
   *       200:
   *         description: List of channel videos
   */
  router.get('/getchannelvideos/:channelId', verifyToken, async (req, res) => {
    req.log.info({ channelId: req.params.channelId }, 'Getting channel videos');
    const channelId = req.params.channelId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const hideDownloaded = req.query.hideDownloaded === 'true';
    const searchQuery = req.query.searchQuery || '';
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder || 'desc';
    const tabType = req.query.tabType || 'videos';
    const maxRating = req.query.maxRating || '';
    const result = await channelModule.getChannelVideos(channelId, page, pageSize, hideDownloaded, searchQuery, sortBy, sortOrder, tabType, maxRating);

    if (Array.isArray(result)) {
      res.status(200).json({
        videos: result,
        videoFail: result.length === 0,
      });
    } else {
      res.status(200).json(result);
    }
  });

  /**
   * @swagger
   * /fetchallchannelvideos/{channelId}:
   *   post:
   *     summary: Fetch all channel videos
   *     description: Trigger a full fetch of all videos from a channel's YouTube page.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube channel ID
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
   *         name: tabType
   *         schema:
   *           type: string
   *           enum: [videos, shorts, streams]
   *           default: videos
   *     responses:
   *       200:
   *         description: Fetch completed
   *       409:
   *         description: Fetch operation already in progress
   *       500:
   *         description: Failed to fetch videos
   */
  router.post('/fetchallchannelvideos/:channelId', verifyToken, async (req, res) => {
    req.log.info({ channelId: req.params.channelId }, 'Fetching all videos for channel');
    const channelId = req.params.channelId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const hideDownloaded = req.query.hideDownloaded === 'true';
    const tabType = req.query.tabType || 'videos';

    try {
      const result = await channelModule.fetchAllChannelVideos(channelId, page, pageSize, hideDownloaded, tabType);
      res.status(200).json(result);
    } catch (error) {
      req.log.error({ err: error, channelId }, 'Failed to fetch all channel videos');

      const isConcurrencyError = error.message.includes('fetch operation is already in progress');
      const statusCode = isConcurrencyError ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        error: isConcurrencyError ? 'FETCH_IN_PROGRESS' : 'Failed to fetch all channel videos',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/videos/{youtubeId}/ignore:
   *   post:
   *     summary: Ignore a video
   *     description: Mark a channel video as ignored so it won't be downloaded.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
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
   *         description: Channel video not found
   *       500:
   *         description: Failed to ignore video
   */
  router.post('/api/channels/:channelId/videos/:youtubeId/ignore', verifyToken, async (req, res) => {
    const { channelId, youtubeId } = req.params;
    req.log.info({ channelId, youtubeId }, 'Ignoring channel video');

    try {
      const channelVideo = await ChannelVideo.findOne({
        where: { channel_id: channelId, youtube_id: youtubeId }
      });

      if (!channelVideo) {
        return res.status(404).json({
          success: false,
          error: 'Channel video not found'
        });
      }

      await channelVideo.update({
        ignored: true,
        ignored_at: new Date()
      });

      await archiveModule.addVideoToArchive(youtubeId);

      req.log.info({ channelId, youtubeId }, 'Successfully ignored channel video');
      res.json({
        success: true,
        message: 'Video marked as ignored'
      });
    } catch (error) {
      req.log.error({ err: error, channelId, youtubeId }, 'Failed to ignore channel video');
      res.status(500).json({
        success: false,
        error: 'Failed to ignore video',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/videos/{youtubeId}/unignore:
   *   post:
   *     summary: Unignore a video
   *     description: Remove the ignored status from a channel video so it can be downloaded.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
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
   *         description: Channel video not found
   *       500:
   *         description: Failed to unignore video
   */
  router.post('/api/channels/:channelId/videos/:youtubeId/unignore', verifyToken, async (req, res) => {
    const { channelId, youtubeId } = req.params;
    req.log.info({ channelId, youtubeId }, 'Unignoring channel video');

    try {
      const channelVideo = await ChannelVideo.findOne({
        where: { channel_id: channelId, youtube_id: youtubeId }
      });

      if (!channelVideo) {
        return res.status(404).json({
          success: false,
          error: 'Channel video not found'
        });
      }

      await channelVideo.update({
        ignored: false,
        ignored_at: null
      });

      await archiveModule.removeVideoFromArchive(youtubeId);

      req.log.info({ channelId, youtubeId }, 'Successfully unignored channel video');
      res.json({
        success: true,
        message: 'Video unmarked as ignored'
      });
    } catch (error) {
      req.log.error({ err: error, channelId, youtubeId }, 'Failed to unignore channel video');
      res.status(500).json({
        success: false,
        error: 'Failed to unignore video',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/videos/bulk-ignore:
   *   post:
   *     summary: Bulk ignore videos
   *     description: Mark multiple channel videos as ignored.
   *     tags: [Channels]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - youtubeIds
   *             properties:
   *               youtubeIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Videos ignored successfully
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Failed to bulk ignore videos
   */
  router.post('/api/channels/:channelId/videos/bulk-ignore', verifyToken, async (req, res) => {
    const { channelId } = req.params;
    const { youtubeIds } = req.body;

    if (!Array.isArray(youtubeIds) || youtubeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'youtubeIds must be a non-empty array'
      });
    }

    req.log.info({ channelId, count: youtubeIds.length }, 'Bulk ignoring channel videos');

    try {
      const results = await Promise.all(
        youtubeIds.map(async (youtubeId) => {
          const channelVideo = await ChannelVideo.findOne({
            where: { channel_id: channelId, youtube_id: youtubeId }
          });

          if (channelVideo) {
            await channelVideo.update({
              ignored: true,
              ignored_at: new Date()
            });
            await archiveModule.addVideoToArchive(youtubeId);
            return { youtubeId, success: true };
          }
          return { youtubeId, success: false, reason: 'not found' };
        })
      );

      const successCount = results.filter(r => r.success).length;
      req.log.info({ channelId, successCount, total: youtubeIds.length }, 'Bulk ignore completed');

      res.json({
        success: true,
        message: `Successfully ignored ${successCount} of ${youtubeIds.length} videos`,
        results
      });
    } catch (error) {
      req.log.error({ err: error, channelId }, 'Failed to bulk ignore channel videos');
      res.status(500).json({
        success: false,
        error: 'Failed to bulk ignore videos',
        message: error.message
      });
    }
  });

  return router;
};

