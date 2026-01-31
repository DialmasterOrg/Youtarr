const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../logger');
const databaseHealth = require('../modules/databaseHealthModule');
const ytdlpModule = require('../modules/ytdlpModule');

/**
 * Creates health routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.getCachedYtDlpVersion - Function to get cached yt-dlp version
 * @param {Function} deps.refreshYtDlpVersionCache - Function to refresh yt-dlp version cache
 * @param {Function} deps.verifyToken - Authentication middleware
 * @returns {express.Router}
 */
module.exports = function createHealthRoutes({ getCachedYtDlpVersion, refreshYtDlpVersionCache, verifyToken }) {
  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the server. Unauthenticated for Docker health checks.
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Server is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: healthy
   */
  router.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  /**
   * @swagger
   * /api/db-status:
   *   get:
   *     summary: Database status endpoint
   *     description: Returns the database health status including connection and schema validity.
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Database is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: healthy
   *                 database:
   *                   type: object
   *                   properties:
   *                     connected:
   *                       type: boolean
   *                     schemaValid:
   *                       type: boolean
   *       503:
   *         description: Database is unhealthy
   */
  router.get('/api/db-status', (req, res) => {
    const health = databaseHealth.getStartupHealth();
    const isHealthy = health.database.connected && health.database.schemaValid;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'error',
      database: health.database
    });
  });

  /**
   * @swagger
   * /getCurrentReleaseVersion:
   *   get:
   *     summary: Get current release version
   *     description: Fetches the latest Youtarr version from Docker Hub and the installed yt-dlp version.
   *     tags: [Health]
   *     security: []
   *     responses:
   *       200:
   *         description: Version information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 version:
   *                   type: string
   *                   description: Latest Youtarr version from Docker Hub
   *                 ytDlpVersion:
   *                   type: string
   *                   description: Installed yt-dlp version
   *       500:
   *         description: Failed to fetch version
   */
  router.get('/getCurrentReleaseVersion', async (req, res) => {
    try {
      const ytDlpVersion = getCachedYtDlpVersion();

      https
        .get(
          'https://registry.hub.docker.com/v2/repositories/dialmaster/youtarr/tags',
          (resp) => {
            let data = '';

            resp.on('data', (chunk) => {
              data += chunk;
            });

            resp.on('end', () => {
              const dockerData = JSON.parse(data);
              // Filter out 'latest' and dev tags (dev-latest, dev-rc.*)
              // Only consider stable version tags (e.g., v1.55.0)
              const stableTags = dockerData.results.filter(
                (tag) => tag.name !== 'latest' && !tag.name.startsWith('dev')
              );
              const latestVersion = stableTags.length > 0 ? stableTags[0].name : null;

              const response = { version: latestVersion };
              if (ytDlpVersion) {
                response.ytDlpVersion = ytDlpVersion;
              }
              res.json(response);
            });
          }
        )
        .on('error', (err) => {
          logger.error({ err }, 'Failed to fetch Docker Hub version');
          res.status(500).json({ error: err.message });
        });
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch version from Docker Hub');
      res.status(500).json({ error: 'Failed to fetch version from Docker Hub' });
    }
  });

  /**
   * @swagger
   * /api/ytdlp/latest-version:
   *   get:
   *     summary: Get yt-dlp version information
   *     description: Returns the current installed yt-dlp version and the latest available version from GitHub.
   *     tags: [Health]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Version information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 currentVersion:
   *                   type: string
   *                   description: Currently installed yt-dlp version
   *                 latestVersion:
   *                   type: string
   *                   description: Latest yt-dlp version from GitHub
   *                 updateAvailable:
   *                   type: boolean
   *                   description: Whether an update is available
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Failed to fetch version information
   */
  router.get('/api/ytdlp/latest-version', verifyToken, async (req, res) => {
    try {
      const currentVersion = getCachedYtDlpVersion();
      const latestVersion = await ytdlpModule.getLatestVersion();
      const updateAvailable = ytdlpModule.isUpdateAvailable(currentVersion, latestVersion);

      res.json({
        currentVersion,
        latestVersion,
        updateAvailable,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get yt-dlp version information');
      res.status(500).json({ error: 'Failed to get version information' });
    }
  });

  /**
   * @swagger
   * /api/ytdlp/update:
   *   post:
   *     summary: Update yt-dlp
   *     description: Performs a yt-dlp self-update to the latest version.
   *     tags: [Health]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Update result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Whether the update succeeded
   *                 message:
   *                   type: string
   *                   description: Status message
   *                 newVersion:
   *                   type: string
   *                   description: New version after update (if applicable)
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Update failed
   */
  router.post('/api/ytdlp/update', verifyToken, async (req, res) => {
    try {
      const result = await ytdlpModule.performUpdate();

      // Refresh the cached version after update
      if (result.success) {
        refreshYtDlpVersionCache();
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to update yt-dlp');
      res.status(500).json({
        success: false,
        message: 'Update failed due to an unexpected error',
      });
    }
  });

  return router;
};

