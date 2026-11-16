const express = require('express');

const UNKNOWN_APP = { error: 'Unknown app' };

/**
 * Creates the Settings endpoints of the Sonarr/Radarr bridge. Unlike the
 * /arr namespace (routes/arrBridge.js), which Sonarr and Radarr call with
 * the bridge key, every route here needs a session.
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Function} deps.arrBridgeConnectionLimiter - Rate limiter for the routes that call Sonarr or Radarr
 * @param {Object} deps.arrBridge - The bridge service (modules/arrBridge)
 * @returns {express.Router}
 */
function createArrBridgeSettingsRoutes({ verifyToken, arrBridgeConnectionLimiter, arrBridge }) {
  const router = express.Router();
  const { settings } = arrBridge;

  const requireApp = (req, res, next) => (settings.isApp(req.params.app) ? next() : res.status(404).json(UNKNOWN_APP));

  /**
   * @swagger
   * /api/arr-bridge/status:
   *   get:
   *     summary: Get the Sonarr/Radarr bridge status
   *     description: Whether the bridge is on, where its staging folder is, and the saved Sonarr and Radarr connections. A connection is shown as its address and whether a key is stored; the key itself is never returned.
   *     tags: [Sonarr/Radarr bridge]
   *     responses:
   *       200:
   *         description: The status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 enabled:
   *                   type: boolean
   *                 stagingRoot:
   *                   type: string
   *                   description: The staging folder inside Youtarr
   *                 stagingClientPath:
   *                   type: string
   *                   description: The same folder as Sonarr and Radarr are told to find it
   *                 connections:
   *                   type: object
   *                   properties:
   *                     sonarr:
   *                       $ref: '#/components/schemas/ArrBridgeConnection'
   *                     radarr:
   *                       $ref: '#/components/schemas/ArrBridgeConnection'
   *       500:
   *         description: The status could not be read
   */
  router.get('/api/arr-bridge/status', verifyToken, (req, res) => {
    try {
      return res.json(settings.getStatus());
    } catch (err) {
      req.log.error({ err }, 'Failed to read the Sonarr/Radarr bridge status');
      return res.status(500).json({ error: 'Could not read the status' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/key:
   *   get:
   *     summary: Get the Sonarr/Radarr bridge key
   *     description: Returns the key Sonarr and Radarr send to the /arr namespace, creating it the first time. /getconfig leaves it out.
   *     tags: [Sonarr/Radarr bridge]
   *     responses:
   *       200:
   *         description: The key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 key:
   *                   type: string
   *       500:
   *         description: The key could not be saved
   */
  router.get('/api/arr-bridge/key', verifyToken, (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      return res.json({ key: settings.getOrCreateKey() });
    } catch (err) {
      req.log.error({ err }, 'Failed to read the Sonarr/Radarr bridge key');
      return res.status(500).json({ error: 'Could not read the key' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/key/regenerate:
   *   post:
   *     summary: Replace the Sonarr/Radarr bridge key
   *     description: Creates a new key. The old one stops working immediately, so the indexer and the download client in Sonarr and Radarr need the new key.
   *     tags: [Sonarr/Radarr bridge]
   *     responses:
   *       200:
   *         description: The new key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 key:
   *                   type: string
   *       500:
   *         description: The key could not be saved
   */
  router.post('/api/arr-bridge/key/regenerate', verifyToken, (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      return res.json({ key: settings.regenerateKey() });
    } catch (err) {
      req.log.error({ err }, 'Failed to replace the Sonarr/Radarr bridge key');
      return res.status(500).json({ error: 'Could not create a new key' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/connections/{app}:
   *   put:
   *     summary: Test and save the connection to Sonarr or Radarr
   *     description: Asks the address who it is with the given key, and stores both only when it answers as the right app. The address and the key always come together; a stored key is never sent to a new address.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: path
   *         name: app
   *         required: true
   *         schema:
   *           type: string
   *           enum: [sonarr, radarr]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, apiKey]
   *             properties:
   *               url:
   *                 type: string
   *                 description: The app's address, with its URL Base if it has one
   *               apiKey:
   *                 type: string
   *     responses:
   *       200:
   *         description: ok true and the saved connection, or ok false with the reason; nothing is saved in that case
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ArrBridgeConnectionResult'
   *       400:
   *         description: The address or the key is missing or malformed
   *       404:
   *         description: Unknown app
   *       429:
   *         description: Too many attempts
   *       500:
   *         description: The connection could not be saved
   *   delete:
   *     summary: Remove the connection to Sonarr or Radarr
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: path
   *         name: app
   *         required: true
   *         schema:
   *           type: string
   *           enum: [sonarr, radarr]
   *     responses:
   *       200:
   *         description: The now empty connection
   *       404:
   *         description: Unknown app
   *       500:
   *         description: The connection could not be removed
   */
  // verifyToken first, then the limiter: a request without a session must
  // not use up the allowance of a signed-in user behind the same address.
  router.put('/api/arr-bridge/connections/:app', verifyToken, requireApp, arrBridgeConnectionLimiter, async (req, res) => {
    const { app } = req.params;
    try {
      // Only these two fields are read, and the body is never logged: it holds the key.
      const result = await settings.saveConnection(app, { url: req.body?.url, apiKey: req.body?.apiKey });
      if (result.error) return res.status(400).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      req.log.error({ err, app }, 'Failed to save a Sonarr/Radarr connection');
      return res.status(500).json({ error: 'Could not save the connection' });
    }
  });

  router.delete('/api/arr-bridge/connections/:app', verifyToken, requireApp, (req, res) => {
    const { app } = req.params;
    try {
      return res.json({ connection: settings.removeConnection(app) });
    } catch (err) {
      req.log.error({ err, app }, 'Failed to remove a Sonarr/Radarr connection');
      return res.status(500).json({ error: 'Could not remove the connection' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/connections/{app}/test:
   *   post:
   *     summary: Test the saved connection to Sonarr or Radarr
   *     description: Tests the stored address with the stored key. It takes no body, so the stored key can only reach the address saved beside it.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: path
   *         name: app
   *         required: true
   *         schema:
   *           type: string
   *           enum: [sonarr, radarr]
   *     responses:
   *       200:
   *         description: ok true with the app's name and version, or ok false with the reason
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ArrBridgeConnectionResult'
   *       404:
   *         description: Unknown app
   *       429:
   *         description: Too many attempts
   *       500:
   *         description: The test could not run
   */
  router.post('/api/arr-bridge/connections/:app/test', verifyToken, requireApp, arrBridgeConnectionLimiter, async (req, res) => {
    const { app } = req.params;
    try {
      return res.json(await settings.testStoredConnection(app));
    } catch (err) {
      req.log.error({ err, app }, 'Failed to test a Sonarr/Radarr connection');
      return res.status(500).json({ error: 'Could not test the connection' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/connections/{app}/shared-folder:
   *   get:
   *     summary: Check that Sonarr or Radarr can see the staging folder
   *     description: Asks the saved Sonarr or Radarr whether it sees the staging folder under the path it is told to import from. Read-only, and nothing of what the app lists is returned.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: path
   *         name: app
   *         required: true
   *         schema:
   *           type: string
   *           enum: [sonarr, radarr]
   *     responses:
   *       200:
   *         description: ok true with visible and the path that was asked about, or ok false with the reason the app could not be asked
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *                 visible:
   *                   type: boolean
   *                 path:
   *                   type: string
   *                 reason:
   *                   type: string
   *                 message:
   *                   type: string
   *       404:
   *         description: Unknown app
   *       429:
   *         description: Too many attempts
   *       500:
   *         description: The check could not run
   */
  router.get('/api/arr-bridge/connections/:app/shared-folder', verifyToken, requireApp, arrBridgeConnectionLimiter, async (req, res) => {
    const { app } = req.params;
    try {
      return res.json(await settings.checkSharedFolder(app));
    } catch (err) {
      req.log.error({ err, app }, 'Failed to check the Sonarr/Radarr shared folder');
      return res.status(500).json({ error: 'Could not check the folder' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/grabs:
   *   get:
   *     summary: List recent Sonarr/Radarr grabs
   *     description: The newest grabs, removed ones included, each with a state. "handed-off" means Sonarr or Radarr took the file, by importing it or because it was removed there; the two cannot be told apart.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *     responses:
   *       200:
   *         description: The grabs, newest first
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 grabs:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       releaseTitle:
   *                         type: string
   *                       youtubeId:
   *                         type: string
   *                       videoTitle:
   *                         type: string
   *                         nullable: true
   *                       channelName:
   *                         type: string
   *                         nullable: true
   *                       kind:
   *                         type: string
   *                         enum: [tv, movie]
   *                       category:
   *                         type: string
   *                       state:
   *                         type: string
   *                         enum: [waiting, downloading, ready, failed, handed-off, cancelled]
   *                       failMessage:
   *                         type: string
   *                         nullable: true
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                       completedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       removedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *       500:
   *         description: The grabs could not be read
   */
  router.get('/api/arr-bridge/grabs', verifyToken, async (req, res) => {
    try {
      const limit = typeof req.query.limit === 'string' ? req.query.limit : undefined;
      return res.json({ grabs: await arrBridge.listRecentGrabs(limit) });
    } catch (err) {
      req.log.error({ err }, 'Failed to read the Sonarr/Radarr grabs');
      return res.status(500).json({ error: 'Could not read the grabs' });
    }
  });

  return router;
}

module.exports = createArrBridgeSettingsRoutes;
