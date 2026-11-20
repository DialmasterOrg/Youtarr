const express = require('express');

const UNKNOWN_APP = { error: 'Unknown app' };

// A repeated parameter arrives as an array and reads as not given. The
// bridge service turns the rest into a page, a size and search words.
const textOf = (value) => (typeof value === 'string' ? value : undefined);
const listQueryOf = (query) => ({ page: textOf(query.page), pageSize: textOf(query.pageSize), q: textOf(query.q) });

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
   *     description: Asks the saved Sonarr or Radarr whether it sees the staging folder under the path it is told to import from. When it does not, the app is also asked whether one of its Remote Path Mappings leads to the folder, where it runs, and whether it sees the folder where the host has it. Read-only, and nothing the app lists or names is returned.
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
   *                   description: The path the app is told, which is the one that was asked about
   *                 via:
   *                   type: string
   *                   enum: [mapping]
   *                   description: Set when the app sees the folder through a Remote Path Mapping of its own
   *                 runsIn:
   *                   type: string
   *                   enum: [docker, windows, other]
   *                   description: Where the app says it runs, when it does not see the folder
   *                 suggestedPath:
   *                   type: string
   *                   description: A path the app does see the folder under, built from Youtarr's own settings
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
   *     description: One page of the grabs, newest first, removed ones included, each with a state. "handed-off" means Sonarr or Radarr took the file, by importing it or because it was removed there; the two cannot be told apart.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *       - in: query
   *         name: q
   *         description: Search text, at most 100 characters and 5 words. A grab must have every word in its release name, its video id, or the title or channel of the video Youtarr holds.
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The page of grabs, newest first
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *                   description: How many grabs match, on all pages
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
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
   *                       libraryCopy:
   *                         type: string
   *                         nullable: true
   *                         enum: [checking, removed, kept]
   *                         description: What the "remove after import" setting did with Youtarr's own copy; null when it was never asked.
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
      return res.json(await arrBridge.listRecentGrabs(listQueryOf(req.query)));
    } catch (err) {
      req.log.error({ err }, 'Failed to read the Sonarr/Radarr grabs');
      return res.status(500).json({ error: 'Could not read the grabs' });
    }
  });

  /**
   * @swagger
   * /api/arr-bridge/searches:
   *   get:
   *     summary: List recent Sonarr/Radarr searches
   *     description: One page of the searches Sonarr and Radarr sent, newest first, with the YouTube searches each one ran and what became of every result. Searches are kept for 30 days, and at most the newest 2,000. The list never holds a key or a feed link.
   *     tags: [Sonarr/Radarr bridge]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *       - in: query
   *         name: q
   *         description: Search text, at most 100 characters and 5 words. A search must have every word in what it asked for - the name with its episode (S01E02), season (S01), air date (2024-05-01) or year.
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The page of searches, newest first
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total:
   *                   type: integer
   *                   description: How many searches match, on all pages
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *                 searches:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                       at:
   *                         type: string
   *                         format: date-time
   *                         description: When the request arrived; for a folded row, the latest one
   *                       firstAt:
   *                         type: string
   *                         format: date-time
   *                       count:
   *                         type: integer
   *                         description: Above 1 only for the no-query feed, whose requests share one row per kind
   *                       kind:
   *                         type: string
   *                         nullable: true
   *                         enum: [tv, movie]
   *                       shape:
   *                         type: string
   *                         enum: [episode, season, daily, movie, rss, empty]
   *                       asked:
   *                         type: object
   *                         description: What the request asked for (text, textSource, season, episode, year, month, day, limit)
   *                       outcome:
   *                         type: string
   *                         enum: [offered, nothing, not-searched, failed]
   *                       offered:
   *                         type: integer
   *                       note:
   *                         type: string
   *                         nullable: true
   *                         description: Why nothing was searched, or why the search failed
   *                       titleStageSkipped:
   *                         type: string
   *                         nullable: true
   *                         enum: [no-connection, unknown-series, no-usable-title, no-runtime]
   *                         description: Why an episode was not searched by its title
   *                       stages:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             matcher:
   *                               type: string
   *                               enum: [episode-title, episode-code, season, daily, movie]
   *                             query:
   *                               type: string
   *                               description: What YouTube was searched for
   *                             results:
   *                               type: integer
   *                             candidates:
   *                               type: array
   *                               items:
   *                                 type: object
   *                                 properties:
   *                                   youtubeId:
   *                                     type: string
   *                                   title:
   *                                     type: string
   *                                   channelName:
   *                                     type: string
   *                                     nullable: true
   *                                   duration:
   *                                     type: number
   *                                     nullable: true
   *                                     description: Seconds
   *                                   outcome:
   *                                     type: string
   *                                     enum: [offered, rejected]
   *                                   releaseTitle:
   *                                     type: string
   *                                     nullable: true
   *                                   reason:
   *                                     type: string
   *                                     nullable: true
   *                                     description: A short code for why the video was not offered
   *       500:
   *         description: The searches could not be read
   */
  router.get('/api/arr-bridge/searches', verifyToken, async (req, res) => {
    try {
      return res.json(await arrBridge.listRecentSearches(listQueryOf(req.query)));
    } catch (err) {
      req.log.error({ err }, 'Failed to read the Sonarr/Radarr searches');
      return res.status(500).json({ error: 'Could not read the searches' });
    }
  });

  return router;
}

module.exports = createArrBridgeSettingsRoutes;
