const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../logger');
const databaseHealth = require('../modules/databaseHealthModule');

/**
 * Creates health routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.getCachedYtDlpVersion - Function to get cached yt-dlp version
 * @returns {express.Router}
 */
module.exports = function createHealthRoutes({ getCachedYtDlpVersion }) {
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
              const latestVersion = dockerData.results.filter(
                (tag) => tag.name !== 'latest'
              )[0].name;

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

  return router;
};

