const express = require('express');

const REASON_BY_CODE = {
  KEY_INVALID: 'The API key is invalid. Check that you copied it correctly.',
  KEY_RESTRICTED:
    'The API key has restrictions blocking this host. Remove the application restrictions in Google Cloud Console or allow the Youtarr server host.',
  API_NOT_ENABLED:
    'The API key is valid, but YouTube Data API v3 is not enabled on its project. Enable it in Google Cloud Console under APIs & Services > Library.',
  QUOTA_EXCEEDED:
    'The key is valid but today\'s quota is exhausted. It will reset at midnight Pacific time.',
  RATE_LIMITED: 'The API rate-limited the request. Try again in a few seconds.',
  NETWORK_ERROR:
    'Could not reach the YouTube API. Check your server\'s internet connection.',
  SERVER_ERROR: 'YouTube\'s API returned a server error. Try again later.',
  UNKNOWN:
    'The key failed validation for an unknown reason. See the Youtarr server logs for details.',
};

/**
 * Creates YouTube API key test routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.youtubeApi - youtubeApi aggregator module
 * @param {Object} deps.configModule - Config module
 * @returns {express.Router}
 */
module.exports = function createYoutubeApiKeyRoutes({ verifyToken, youtubeApi, configModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /testYoutubeApiKey:
   *   post:
   *     summary: Validate a YouTube Data API v3 key
   *     tags: [Configuration]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [apiKey]
   *             properties:
   *               apiKey:
   *                 type: string
   *     responses:
   *       200:
   *         description: Validation result (ok=true or ok=false with code+reason)
   *       400:
   *         description: apiKey missing or empty
   */
  router.post('/testYoutubeApiKey', verifyToken, async (req, res) => {
    try {
      const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (apiKey.length === 0) {
        return res.status(400).json({ error: 'apiKey is required' });
      }

      const result = await youtubeApi.client.testKey(apiKey);

      if (result.ok) {
        // Auto-save the key on successful validation (matches Plex's test-and-save pattern).
        // Without this, the key would stay in the frontend's optimistic state only and
        // the backend would never use the API.
        const currentConfig = configModule.getConfig();
        currentConfig.youtubeApiKey = apiKey;
        configModule.updateConfig(currentConfig);
        req.log?.info('YouTube API key saved after successful validation');
        return res.json({ ok: true });
      }

      return res.json({
        ok: false,
        code: result.code,
        reason: REASON_BY_CODE[result.code] || REASON_BY_CODE.UNKNOWN,
      });
    } catch (error) {
      req.log?.error({ err: error }, 'testYoutubeApiKey failed unexpectedly');
      return res.status(500).json({ error: 'Failed to test YouTube API key' });
    }
  });

  return router;
};
