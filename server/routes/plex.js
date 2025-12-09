const express = require('express');
const router = express.Router();
const logger = require('../logger');

/**
 * Creates Plex routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.plexModule - Plex module
 * @param {Object} deps.configModule - Config module
 * @returns {express.Router}
 */
module.exports = function createPlexRoutes({ verifyToken, plexModule, configModule }) {
  /**
   * @swagger
   * /getplexlibraries:
   *   get:
   *     summary: Get Plex libraries
   *     description: Retrieve available Plex libraries. Can test with provided credentials or use saved config.
   *     tags: [Plex]
   *     parameters:
   *       - in: query
   *         name: testIP
   *         schema:
   *           type: string
   *         description: Test Plex server IP
   *       - in: query
   *         name: testApiKey
   *         schema:
   *           type: string
   *         description: Test Plex API key
   *       - in: query
   *         name: testPort
   *         schema:
   *           type: string
   *         description: Test Plex server port
   *       - in: query
   *         name: testUseHttps
   *         schema:
   *           type: boolean
   *         description: Use HTTPS for test connection
   *     responses:
   *       200:
   *         description: List of Plex libraries
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   key:
   *                     type: string
   *                   title:
   *                     type: string
   *                   type:
   *                     type: string
   */
  router.get('/getplexlibraries', verifyToken, async (req, res) => {
    try {
      const testIP = req.query.testIP;
      const testApiKey = req.query.testApiKey;
      const testPortRaw = req.query.testPort;
      const testUseHttps = req.query.testUseHttps === 'true';
      const hasTestCredentials = typeof testApiKey === 'string' && testApiKey.length > 0;
      let testPort;
      if (typeof testPortRaw === 'string' && testPortRaw.trim().length > 0) {
        const numericPort = testPortRaw.trim().replace(/[^0-9]/g, '');
        testPort = numericPort.length > 0 ? numericPort : undefined;
      }

      let libraries;
      if (hasTestCredentials || typeof testIP === 'string') {
        libraries = await plexModule.getLibrariesWithParams(testIP, testApiKey, testPort, testUseHttps);

        if (libraries && libraries.length > 0 && hasTestCredentials) {
          const currentConfig = configModule.getConfig();
          if (testIP) {
            currentConfig.plexIP = testIP;
          }
          if (testPort) {
            currentConfig.plexPort = testPort;
          }
          if (req.query.testUseHttps !== undefined) {
            currentConfig.plexViaHttps = testUseHttps;
          }
          currentConfig.plexApiKey = testApiKey;
          configModule.updateConfig(currentConfig);
          req.log.info('Plex credentials auto-saved after successful test');
        }
      } else {
        libraries = await plexModule.getLibraries();
      }

      res.json(libraries || []);
    } catch (error) {
      req.log.error({ err: error }, 'Failed to get Plex libraries');
      res.json([]);
    }
  });

  /**
   * @swagger
   * /refreshlibrary:
   *   get:
   *     summary: Refresh Plex library
   *     description: Trigger a refresh of the configured Plex library.
   *     tags: [Plex]
   *     responses:
   *       200:
   *         description: Library refresh initiated
   *       500:
   *         description: Failed to refresh library
   */
  router.get('/refreshlibrary', verifyToken, async (req, res) => {
    try {
      await plexModule.refreshLibrary();
      res.json({ success: true, message: 'Library refresh initiated' });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to refresh Plex library');
      res.status(500).json({ success: false, message: 'Failed to refresh library' });
    }
  });

  /**
   * @swagger
   * /plex/auth-url:
   *   get:
   *     summary: Get Plex auth URL
   *     description: Get the Plex OAuth authentication URL for linking a Plex account.
   *     tags: [Plex]
   *     security: []
   *     responses:
   *       200:
   *         description: Plex auth URL
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 authUrl:
   *                   type: string
   *                 pinId:
   *                   type: string
   *       500:
   *         description: Failed to get auth URL
   *       503:
   *         description: Authentication not configured
   */
  router.get('/plex/auth-url', async (req, res) => {
    const config = configModule.getConfig();

    if (process.env.AUTH_ENABLED !== 'false' && !config.passwordHash) {
      return res.status(503).json({
        error: 'Authentication not configured',
        requiresSetup: true,
        message: 'Please complete initial setup first'
      });
    }

    try {
      const result = await plexModule.getAuthUrl();
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get Plex auth URL');
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @swagger
   * /plex/check-pin/{pinId}:
   *   get:
   *     summary: Check Plex PIN status
   *     description: Check if a Plex OAuth PIN has been authorized.
   *     tags: [Plex]
   *     security: []
   *     parameters:
   *       - in: path
   *         name: pinId
   *         required: true
   *         schema:
   *           type: string
   *         description: Plex PIN ID
   *     responses:
   *       200:
   *         description: PIN status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 authorized:
   *                   type: boolean
   *                 authToken:
   *                   type: string
   *       500:
   *         description: Failed to check PIN
   *       503:
   *         description: Authentication not configured
   */
  router.get('/plex/check-pin/:pinId', async (req, res) => {
    const config = configModule.getConfig();

    if (process.env.AUTH_ENABLED !== 'false' && !config.passwordHash) {
      return res.status(503).json({
        error: 'Authentication not configured',
        requiresSetup: true,
        message: 'Please complete initial setup first'
      });
    }

    try {
      const { pinId } = req.params;
      const result = await plexModule.checkPin(pinId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

