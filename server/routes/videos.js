const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Video validation rate limiter
const videoValidationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many validation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// API key download rate limiter
const apiKeyDownloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: (req) => {
    // Only apply to API key auth, session auth is unlimited
    if (req.authType !== 'api_key') {
      return 0; // 0 = unlimited
    }
    const configModule = require('../modules/configModule');
    return configModule.getConfig().apiKeyRateLimit || 10;
  },
  keyGenerator: (req) => {
    // Rate limit per API key ID - only used for API key auth
    // Session auth is skipped entirely via the skip function
    return `apikey:${req.apiKeyId || 'unknown'}`;
  },
  skip: (req) => req.authType !== 'api_key', // Skip rate limiting for session auth
  message: { success: false, error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, ip: false },
});

/**
 * Creates video routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.videosModule - Videos module
 * @param {Object} deps.downloadModule - Download module
 * @returns {express.Router}
 */
module.exports = function createVideoRoutes({ verifyToken, videosModule, downloadModule }) {
  /**
   * @swagger
   * /getVideos:
   *   get:
   *     summary: Get downloaded videos
   *     description: Retrieve a paginated list of downloaded videos.
   *     tags: [Videos]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 12
   *         description: Number of items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: dateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter videos from this date
   *       - in: query
   *         name: dateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter videos up to this date
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [added, title, date]
   *           default: added
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *       - in: query
   *         name: channelFilter
   *         schema:
   *           type: string
   *         description: Filter by channel
   *     responses:
   *       200:
   *         description: Paginated list of videos
   *       500:
   *         description: Failed to get videos
   */
  router.get('/getVideos', verifyToken, async (req, res) => {
    req.log.info('Getting videos');

    try {
      const { page, limit, search, dateFrom, dateTo, sortBy, sortOrder, channelFilter } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 12,
        search: search || '',
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        sortBy: sortBy || 'added',
        sortOrder: sortOrder || 'desc',
        channelFilter: channelFilter || ''
      };

      const result = await videosModule.getVideosPaginated(options);
      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get videos');
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /api/videos:
   *   delete:
   *     summary: Delete videos
   *     description: Delete downloaded videos by database IDs or YouTube IDs.
   *     tags: [Videos]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               videoIds:
   *                 type: array
   *                 items:
   *                   type: integer
   *                 description: Database video IDs
   *               youtubeIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: YouTube video IDs
   *     responses:
   *       200:
   *         description: Videos deleted successfully
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Failed to delete videos
   */
  router.delete('/api/videos', verifyToken, async (req, res) => {
    try {
      const { videoIds, youtubeIds } = req.body;

      if ((!videoIds && !youtubeIds) ||
          (videoIds && !Array.isArray(videoIds)) ||
          (youtubeIds && !Array.isArray(youtubeIds)) ||
          (videoIds && videoIds.length === 0 && (!youtubeIds || youtubeIds.length === 0)) ||
          (youtubeIds && youtubeIds.length === 0 && (!videoIds || videoIds.length === 0))) {
        return res.status(400).json({
          success: false,
          error: 'videoIds or youtubeIds array is required'
        });
      }

      const videoDeletionModule = require('../modules/videoDeletionModule');
      let result;

      if (youtubeIds && youtubeIds.length > 0) {
        result = await videoDeletionModule.deleteVideosByYoutubeIds(youtubeIds);
      } else {
        result = await videoDeletionModule.deleteVideos(videoIds);
      }

      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to delete videos');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/auto-removal/dry-run:
   *   post:
   *     summary: Auto-removal dry run
   *     description: Preview which videos would be removed by automatic cleanup without actually deleting them.
   *     tags: [Videos]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               autoRemovalEnabled:
   *                 type: boolean
   *               autoRemovalVideoAgeThreshold:
   *                 type: integer
   *                 description: Age threshold in days
   *               autoRemovalFreeSpaceThreshold:
   *                 type: integer
   *                 description: Free space threshold in GB
   *     responses:
   *       200:
   *         description: Dry run results
   *       500:
   *         description: Failed to perform dry run
   */
  router.post('/api/auto-removal/dry-run', verifyToken, async (req, res) => {
    try {
      const {
        autoRemovalEnabled,
        autoRemovalVideoAgeThreshold,
        autoRemovalFreeSpaceThreshold
      } = req.body || {};

      const overrides = {};

      if (autoRemovalEnabled !== undefined) {
        if (typeof autoRemovalEnabled === 'boolean') {
          overrides.autoRemovalEnabled = autoRemovalEnabled;
        } else if (typeof autoRemovalEnabled === 'string') {
          overrides.autoRemovalEnabled = autoRemovalEnabled.toLowerCase() === 'true';
        } else {
          overrides.autoRemovalEnabled = Boolean(autoRemovalEnabled);
        }
      }

      if (autoRemovalVideoAgeThreshold !== undefined) {
        overrides.autoRemovalVideoAgeThreshold = autoRemovalVideoAgeThreshold;
      }

      if (autoRemovalFreeSpaceThreshold !== undefined) {
        overrides.autoRemovalFreeSpaceThreshold = autoRemovalFreeSpaceThreshold;
      }

      const videoDeletionModule = require('../modules/videoDeletionModule');
      const result = await videoDeletionModule.performAutomaticCleanup({
        dryRun: true,
        overrides
      });

      res.json(result);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to perform auto-removal dry run');
      res.status(500).json({ success: false, error: error.message || 'Failed to run auto-removal dry run' });
    }
  });

  /**
   * @swagger
   * /api/checkYoutubeVideoURL:
   *   post:
   *     summary: Validate YouTube video URL
   *     description: Validate a YouTube video URL and fetch its metadata.
   *     tags: [Videos]
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
   *                 description: YouTube video URL
   *     responses:
   *       200:
   *         description: Validation result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 isValidUrl:
   *                   type: boolean
   *                 title:
   *                   type: string
   *                 duration:
   *                   type: integer
   *                 thumbnail:
   *                   type: string
   *       400:
   *         description: URL is required
   *       429:
   *         description: Too many validation requests
   *       500:
   *         description: Internal server error
   */
  router.post('/api/checkYoutubeVideoURL', verifyToken, videoValidationLimiter, async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          isValidUrl: false,
          error: 'URL is required'
        });
      }

      const videoValidationModule = require('../modules/videoValidationModule');
      const validationResult = await videoValidationModule.validateVideo(url);

      res.json(validationResult);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to validate video URL');
      res.status(500).json({
        isValidUrl: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * @swagger
   * /api/videos/download:
   *   options:
   *     summary: CORS preflight for download endpoint
   *     description: Handle CORS preflight requests for the download endpoint.
   *     tags: [Videos]
   *     security: []
   *     responses:
   *       204:
   *         description: CORS preflight successful
   */
  router.options('/api/videos/download', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-access-token');
    res.set('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });

  /**
   * @swagger
   * /api/videos/download:
   *   post:
   *     summary: Download a YouTube video
   *     description: Add a YouTube video URL to the download queue. Designed for external integrations (bookmarklets, shortcuts, automations).
   *     tags: [Videos]
   *     security:
   *       - ApiKeyAuth: []
   *       - BearerAuth: []
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
   *                 description: YouTube video URL
   *                 example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   *               resolution:
   *                 type: string
   *                 enum: ['360', '480', '720', '1080', '1440', '2160']
   *                 description: Preferred resolution (defaults to server config)
   *               subfolder:
   *                 type: string
   *                 description: Override subfolder for download
   *     responses:
   *       200:
   *         description: Video queued for download
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 video:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     thumbnail:
   *                       type: string
   *                     duration:
   *                       type: integer
   *       400:
   *         description: Invalid URL or parameters
   *       401:
   *         description: Invalid or missing authentication
   *       429:
   *         description: Rate limit exceeded
   */
  router.post('/api/videos/download', verifyToken, apiKeyDownloadLimiter, async (req, res) => {
    // Set CORS headers for bookmarklet/external access
    res.set('Access-Control-Allow-Origin', '*');

    const { url, resolution, subfolder } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL length (prevent excessively long URLs)
    const MAX_URL_LENGTH = 2048;
    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `URL too long (max ${MAX_URL_LENGTH} characters)`
      });
    }

    // Validate URL format - single videos only
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
    if (!youtubeRegex.test(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL format'
      });
    }

    // Reject playlists and channels - API keys only support single video downloads
    if (url.includes('list=') || url.includes('/playlist') || url.includes('/channel/') || url.includes('/@')) {
      return res.status(400).json({
        success: false,
        error: 'API keys only support single video downloads. Playlists and channels require the web UI.'
      });
    }

    // Validate resolution if provided
    const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
    if (resolution && !validResolutions.includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
      });
    }

    // Validate subfolder if provided
    if (subfolder) {
      const channelSettingsModule = require('../modules/channelSettingsModule');
      const validation = channelSettingsModule.validateSubFolder(subfolder);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }
    }

    try {
      // Optionally fetch video metadata for response
      const videoValidationModule = require('../modules/videoValidationModule');
      const metadata = await videoValidationModule.validateVideo(url);

      if (!metadata.isValidUrl) {
        return res.status(400).json({
          success: false,
          error: metadata.error || 'Could not validate video URL'
        });
      }

      // Queue the download
      const overrideSettings = {};
      if (resolution) overrideSettings.resolution = resolution;
      if (subfolder) overrideSettings.subfolder = subfolder;

      // Build initiatedBy info for download source indicator
      const initiatedBy = req.authType === 'api_key'
        ? { type: 'api_key', name: req.apiKeyName }
        : { type: 'web_ui' };

      downloadModule.doSpecificDownloads({
        body: {
          urls: [url],
          overrideSettings: Object.keys(overrideSettings).length > 0 ? overrideSettings : undefined,
          initiatedBy
        }
      });

      // Increment usage count for API key statistics
      if (req.authType === 'api_key' && req.apiKeyId) {
        const apiKeyModule = require('../modules/apiKeyModule');
        apiKeyModule.incrementUsageCount(req.apiKeyId).catch(err => {
          req.log.warn({ err, keyId: req.apiKeyId }, 'Failed to increment API key usage count');
        });
      }

      res.json({
        success: true,
        message: 'Video queued for download',
        video: {
          title: metadata.title,
          thumbnail: metadata.thumbnail,
          duration: metadata.duration
        }
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to queue video download');
      res.status(500).json({
        success: false,
        error: 'Failed to queue video for download'
      });
    }
  });

  /**
   * @swagger
   * /triggerspecificdownloads:
   *   post:
   *     summary: Download specific videos
   *     description: Trigger download of specific YouTube video URLs.
   *     tags: [Videos]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - urls
   *             properties:
   *               urls:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of YouTube video URLs to download
   *               overrideSettings:
   *                 type: object
   *                 properties:
   *                   resolution:
   *                     type: string
   *                     enum: ['360', '480', '720', '1080', '1440', '2160']
   *                     description: Override download resolution
   *     responses:
   *       200:
   *         description: Download job started
   *       400:
   *         description: Invalid resolution
   */
  router.post('/triggerspecificdownloads', verifyToken, (req, res) => {
    const { overrideSettings } = req.body;
    if (overrideSettings) {
      if (overrideSettings.resolution) {
        const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
        if (!validResolutions.includes(overrideSettings.resolution)) {
          return res.status(400).json({
            error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
          });
        }
      }
      // Note: video count is not applicable for manual downloads

      // Validate subfolder override if provided
      if (overrideSettings.subfolder !== undefined && overrideSettings.subfolder !== null) {
        const channelSettingsModule = require('../modules/channelSettingsModule');
        const validation = channelSettingsModule.validateSubFolder(overrideSettings.subfolder);
        if (!validation.valid) {
          return res.status(400).json({
            error: validation.error
          });
        }
      }
    }

    downloadModule.doSpecificDownloads(req);
    res.json({ status: 'success' });
  });

  /**
   * @swagger
   * /triggerchanneldownloads:
   *   post:
   *     summary: Trigger channel downloads
   *     description: Manually trigger the download of new videos from all enabled channels.
   *     tags: [Videos]
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
   *                     description: Override download resolution
   *                   videoCount:
   *                     type: integer
   *                     minimum: 1
   *                     maximum: 50
   *                     description: Override number of videos to download per channel
   *     responses:
   *       200:
   *         description: Channel download job started
   *       400:
   *         description: Job already running or invalid settings
   */
  router.post('/triggerchanneldownloads', verifyToken, (req, res) => {
    const jobModule = require('../modules/jobModule');
    const runningJobs = jobModule.getRunningJobs();
    const channelDownloadJob = runningJobs.find(
      (job) =>
        job.jobType.includes('Channel Downloads') && job.status === 'In Progress'
    );
    if (channelDownloadJob) {
      res.status(400).json({ error: 'Job Already Running' });
      return;
    }

    const { overrideSettings } = req.body;
    if (overrideSettings) {
      if (overrideSettings.resolution) {
        const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
        if (!validResolutions.includes(overrideSettings.resolution)) {
          return res.status(400).json({
            error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
          });
        }
      }
      if (overrideSettings.videoCount !== undefined) {
        const count = parseInt(overrideSettings.videoCount);
        if (isNaN(count) || count < 1 || count > 50) {
          return res.status(400).json({
            error: 'Invalid video count. Must be between 1 and 50'
          });
        }
      }
    }

    downloadModule.doChannelDownloads(req.body || {});
    res.json({ status: 'success' });
  });

  return router;
};

