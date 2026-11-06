const express = require('express');

const RSS_CONTENT_TYPE = 'application/rss+xml; charset=utf-8';

/**
 * Creates the RSS feed routes and their Settings endpoints
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware (Settings endpoints only)
 * @param {Function} deps.feedLimiter - Rate limiter for the /feeds namespace
 * @param {Object} deps.downloadsFeed - Download feed module
 * @returns {express.Router}
 */
function createFeedRoutes({ verifyToken, feedLimiter, downloadsFeed }) {
  const router = express.Router();

  router.use('/feeds', feedLimiter);

  /**
   * @swagger
   * /feeds/downloads.xml:
   *   get:
   *     summary: RSS feed of downloaded videos
   *     description: Lists downloaded videos, newest first, for RSS readers. RSS readers cannot log in, so this route takes no session or API key. The token in the URL is the only protection, and it is required even with AUTH_ENABLED=false.
   *     tags: [Feeds]
   *     security: []
   *     parameters:
   *       - in: query
   *         name: token
   *         required: true
   *         schema:
   *           type: string
   *         description: The token from Settings -> RSS Feeds
   *     responses:
   *       200:
   *         description: The RSS document
   *         content:
   *           application/rss+xml:
   *             schema:
   *               type: string
   *       304:
   *         description: The reader already has this version
   *       404:
   *         description: The token is wrong or the feed is turned off
   *       429:
   *         description: Too many requests
   *       500:
   *         description: The feed could not be built
   */
  router.get('/feeds/downloads.xml', async (req, res) => {
    try {
      if (!downloadsFeed.isAuthorized(req.query.token)) {
        return res.status(404).json({ error: 'Feed not found' });
      }
      const xml = await downloadsFeed.renderFeed(`${req.protocol}://${req.get('host')}`);
      res.set({ 'Content-Type': RSS_CONTENT_TYPE, 'Cache-Control': 'private, no-cache' });
      return res.send(xml);
    } catch (err) {
      req.log.error({ err }, 'Failed to build the downloads feed');
      return res.status(500).json({ error: 'Failed to build the feed' });
    }
  });

  // Keep an unknown feed from falling through to the SPA.
  router.use('/feeds', (_req, res) => res.status(404).json({ error: 'Feed not found' }));

  /**
   * @swagger
   * /api/feeds/downloads/token:
   *   get:
   *     summary: Get the download feed token
   *     description: Returns the token Settings needs to show the feed URL, creating it the first time. /getconfig leaves it out.
   *     tags: [Feeds]
   *     responses:
   *       200:
   *         description: The token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *       500:
   *         description: The token could not be saved
   */
  router.get('/api/feeds/downloads/token', verifyToken, (req, res) => {
    try {
      return res.json({ token: downloadsFeed.getOrCreateToken() });
    } catch (err) {
      req.log.error({ err }, 'Failed to read the downloads feed token');
      return res.status(500).json({ error: 'Failed to read the feed token' });
    }
  });

  /**
   * @swagger
   * /api/feeds/downloads/regenerate-token:
   *   post:
   *     summary: Replace the download feed token
   *     description: Creates a new token. The old feed URL stops working immediately.
   *     tags: [Feeds]
   *     responses:
   *       200:
   *         description: The new token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *       500:
   *         description: The token could not be saved
   */
  router.post('/api/feeds/downloads/regenerate-token', verifyToken, (req, res) => {
    try {
      return res.json({ token: downloadsFeed.regenerateToken() });
    } catch (err) {
      req.log.error({ err }, 'Failed to regenerate the downloads feed token');
      return res.status(500).json({ error: 'Failed to create a new feed URL' });
    }
  });

  return router;
}

module.exports = createFeedRoutes;
