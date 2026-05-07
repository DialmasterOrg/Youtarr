const express = require('express');
const multer = require('multer');
const customArgsParser = require('../modules/download/customArgsParser');

// Mirror of the frontend RATE_LIMIT_REGEX. Matches yt-dlp's --limit-rate
// format: digits with optional decimal, optional K/M/G suffix.
const RATE_LIMIT_REGEX = /^\d+(\.\d+)?[KkMmGg]?$/;

// Configure multer for cookie file upload
const cookieUpload = multer({
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only text files are allowed'), false);
    }
  }
});

/**
 * Creates configuration routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.configModule - Config module
 * @param {Function} deps.validateEnvAuthCredentials - Function to validate ENV auth credentials
 * @param {boolean} deps.isWslEnvironment - Whether running in WSL
 * @returns {express.Router}
 */
module.exports = function createConfigRoutes({ verifyToken, configModule, validateEnvAuthCredentials, isWslEnvironment }) {
  const router = express.Router();

  /**
   * @swagger
   * /getconfig:
   *   get:
   *     summary: Get application configuration
   *     description: Retrieve the current application configuration (sensitive fields are filtered out).
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Application configuration
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 plexIP:
   *                   type: string
   *                 plexPort:
   *                   type: string
   *                 plexApiKey:
   *                   type: string
   *                 plexLibraryId:
   *                   type: string
   *                 downloadResolution:
   *                   type: string
   *                 videosToDownload:
   *                   type: integer
   *                 cronSchedule:
   *                   type: string
   */
  router.get('/getconfig', verifyToken, (req, res) => {
    const config = configModule.getConfig();
    const safeConfig = { ...config };

    delete safeConfig.passwordHash;
    delete safeConfig.username;

    safeConfig.isPlatformManaged = {
      youtubeOutputDirectory: !!process.env.DATA_PATH,
      plexUrl: !!process.env.PLEX_URL,
      authEnabled: process.env.AUTH_ENABLED === 'false' ? false : true,
      useTmpForDownloads: configModule.isElfhostedPlatform(),
      ytdlpUpdates: configModule.isElfhostedPlatform()
    };

    safeConfig.deploymentEnvironment = {
      platform: process.env.PLATFORM || null,
      isWsl: isWslEnvironment
    };

    safeConfig.envAuthApplied = validateEnvAuthCredentials();
    safeConfig.youtubeOutputDirectory = process.env.YOUTUBE_OUTPUT_DIR || process.env.DATA_PATH || null;

    res.json(safeConfig);
  });

  /**
   * @swagger
   * /updateconfig:
   *   post:
   *     summary: Update application configuration
   *     description: Update the application configuration. Sensitive fields (passwordHash, username) are protected.
   *     tags: [Configuration]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               plexIP:
   *                 type: string
   *               plexPort:
   *                 type: string
   *               plexApiKey:
   *                 type: string
   *               plexLibraryId:
   *                 type: string
   *               downloadResolution:
   *                 type: string
   *               videosToDownload:
   *                 type: integer
   *               cronSchedule:
   *                 type: string
   *     responses:
   *       200:
   *         description: Configuration updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   */
  router.post('/updateconfig', verifyToken, (req, res) => {
    req.log.info('Updating application configuration');
    const currentConfig = configModule.getConfig();
    const updateData = { ...req.body };

    // Custom args denylist gate (defense-in-depth; buildCustomArgs also re-validates)
    if (typeof updateData.ytdlpCustomArgs === 'string' && updateData.ytdlpCustomArgs.trim()) {
      if (updateData.ytdlpCustomArgs.length > customArgsParser.MAX_CUSTOM_ARGS_LENGTH) {
        return res.status(400).json({
          error: `Custom args exceed ${customArgsParser.MAX_CUSTOM_ARGS_LENGTH} character limit`,
        });
      }
      let tokens;
      try {
        tokens = customArgsParser.tokenize(updateData.ytdlpCustomArgs);
      } catch (err) {
        return res.status(400).json({ error: `Custom args parse error: ${err.message}` });
      }
      const validation = customArgsParser.validate(tokens);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
    }

    // Rate-limit format gate. yt-dlp rejects malformed values at runtime,
    // which would break every download until config is hand-fixed.
    if (typeof updateData.ytdlpDownloadRateLimit === 'string' && updateData.ytdlpDownloadRateLimit.trim()) {
      if (!RATE_LIMIT_REGEX.test(updateData.ytdlpDownloadRateLimit.trim())) {
        return res.status(400).json({
          error: 'Invalid download rate limit format. Use e.g. 5M, 500K, 1.5G',
        });
      }
    }

    delete updateData.passwordHash;
    delete updateData.username;

    updateData.passwordHash = currentConfig.passwordHash;
    updateData.username = currentConfig.username;
    updateData.ytdlpLastChecked = currentConfig.ytdlpLastChecked;
    updateData.ytdlpLastUpdated = currentConfig.ytdlpLastUpdated;
    updateData.ytdlpLastResult = currentConfig.ytdlpLastResult;
    updateData.rescanLastRun = currentConfig.rescanLastRun ?? null;

    configModule.updateConfig(updateData);

    res.json({ status: 'success' });
  });

  /**
   * @swagger
   * /api/cookies/status:
   *   get:
   *     summary: Get cookie file status
   *     description: Check if a custom YouTube cookie file is configured.
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Cookie status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 hasCustomCookies:
   *                   type: boolean
   *                 lastModified:
   *                   type: string
   *                   format: date-time
   *       500:
   *         description: Failed to get cookie status
   */
  router.get('/api/cookies/status', verifyToken, (req, res) => {
    try {
      const status = configModule.getCookiesStatus();
      res.json(status);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get cookie status');
      res.status(500).json({ error: 'Failed to get cookie status' });
    }
  });

  /**
   * @swagger
   * /api/cookies/upload:
   *   post:
   *     summary: Upload cookie file
   *     description: Upload a Netscape format cookie file for YouTube authentication.
   *     tags: [Configuration]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               cookieFile:
   *                 type: string
   *                 format: binary
   *                 description: Netscape format cookie file
   *     responses:
   *       200:
   *         description: Cookie file uploaded successfully
   *       400:
   *         description: Invalid file or format
   *       500:
   *         description: Failed to upload cookie file
   */
  router.post('/api/cookies/upload', verifyToken, cookieUpload.single('cookieFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileContent = req.file.buffer.toString('utf8');

      if (!fileContent.includes('# Netscape HTTP Cookie File') &&
          !fileContent.includes('# This file is generated by yt-dlp')) {
        return res.status(400).json({
          error: 'Invalid cookie file format. Please upload a valid Netscape format cookie file.'
        });
      }

      configModule.writeCustomCookiesFile(Buffer.from(fileContent));

      const status = configModule.getCookiesStatus();
      res.json({
        status: 'success',
        message: 'Cookie file uploaded successfully',
        cookieStatus: status
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to upload cookie file');
      res.status(500).json({ error: 'Failed to upload cookie file' });
    }
  });

  /**
   * @swagger
   * /api/cookies:
   *   delete:
   *     summary: Delete cookie file
   *     description: Remove the custom YouTube cookie file.
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Cookie file deleted successfully
   *       500:
   *         description: Failed to delete cookie file
   */
  router.delete('/api/cookies', verifyToken, (req, res) => {
    try {
      configModule.deleteCustomCookiesFile();
      const status = configModule.getCookiesStatus();
      res.json({
        status: 'success',
        message: 'Custom cookie file deleted',
        cookieStatus: status
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to delete cookie file');
      res.status(500).json({ error: 'Failed to delete cookie file' });
    }
  });

  /**
   * @swagger
   * /api/notifications/test:
   *   post:
   *     summary: Send test notification
   *     description: Send a test notification to verify notification settings.
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Test notification sent successfully
   *       500:
   *         description: Failed to send test notification
   */
  router.post('/api/notifications/test', verifyToken, async (req, res) => {
    try {
      const notificationModule = require('../modules/notificationModule');
      await notificationModule.sendTestNotification();
      res.json({
        status: 'success',
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to send test notification');
      res.status(500).json({
        error: 'Failed to send test notification',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/notifications/test-single:
   *   post:
   *     summary: Send test notification to a single webhook
   *     description: Send a test notification to a specific webhook URL to verify it works.
   *     tags: [Configuration]
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
   *                 description: The notification URL to test
   *               name:
   *                 type: string
   *                 description: The name of the notification service
   *               richFormatting:
   *                 type: boolean
   *                 description: Whether to use rich formatting
   *     responses:
   *       200:
   *         description: Test notification sent successfully
   *       400:
   *         description: Invalid request (missing URL)
   *       500:
   *         description: Failed to send test notification
   */
  router.post('/api/notifications/test-single', verifyToken, async (req, res) => {
    try {
      const { url, name, richFormatting } = req.body;

      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Notification URL is required'
        });
      }

      const notificationModule = require('../modules/notificationModule');
      await notificationModule.sendTestNotificationToSingle({
        url: url.trim(),
        name: name || 'Test Notification',
        richFormatting: richFormatting !== false
      });

      res.json({
        status: 'success',
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to send test notification to single URL');
      res.status(500).json({
        error: 'Failed to send test notification',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /storage-status:
   *   get:
   *     summary: Get storage status
   *     description: Retrieve storage usage information for the downloads directory.
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Storage status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *                   description: Total space in bytes
   *                 used:
   *                   type: integer
   *                   description: Used space in bytes
   *                 free:
   *                   type: integer
   *                   description: Free space in bytes
   *       500:
   *         description: Failed to retrieve storage status
   */
  router.get('/storage-status', verifyToken, async (req, res) => {
    try {
      const status = await configModule.getStorageStatus();
      if (status) {
        res.json(status);
      } else {
        res.status(500).json({ error: 'Could not retrieve storage status' });
      }
    } catch (error) {
      req.log.error({ err: error }, 'Failed to retrieve storage status');
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
