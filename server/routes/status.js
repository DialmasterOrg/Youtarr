const express = require('express');
const rateLimit = require('express-rate-limit');
const { STATUS_SUMMARY_PATH } = require('../modules/constants/apiKeyRoles');

const STATUS_KEY_REQUESTS_PER_MINUTE = 60;

// Applies to status API keys only; a browser session is not limited.
const statusKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: STATUS_KEY_REQUESTS_PER_MINUTE,
  keyGenerator: (req) => `status-apikey:${req.apiKeyId || 'unknown'}`,
  skip: (req) => req.authType !== 'api_key',
  message: { error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, ip: false },
});

/**
 * Creates the read-only status routes for dashboards and monitors
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.statusSummaryModule - Builds the summary
 * @param {Function} deps.getCachedYtDlpVersion - Installed yt-dlp version
 * @param {string} deps.serverVersion - Running Youtarr version
 * @returns {express.Router}
 */
module.exports = function createStatusRoutes({
  verifyToken, statusSummaryModule, getCachedYtDlpVersion, serverVersion,
}) {
  const router = express.Router();

  /**
   * @swagger
   * /api/status/summary:
   *   get:
   *     summary: Read-only status summary for dashboards
   *     description: >
   *       One snapshot of the library, the download queue, the last finished
   *       run and the most recent downloads. Accepts a session or a status
   *       API key (role status_read); download keys and external keys are
   *       refused. Status keys are limited to 60 requests per minute, and
   *       library figures are cached for up to 30 seconds.
   *     tags: [Health]
   *     security:
   *       - SessionAuth: []
   *       - ApiKeyAuth: []
   *     responses:
   *       200:
   *         description: Status summary
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 version:
   *                   type: string
   *                   description: Running Youtarr version
   *                 ytDlp:
   *                   type: object
   *                   properties:
   *                     version:
   *                       type: string
   *                       nullable: true
   *                       description: Installed yt-dlp version
   *                 library:
   *                   type: object
   *                   properties:
   *                     channels:
   *                       type: integer
   *                       description: Subscribed channels
   *                     videos:
   *                       type: integer
   *                       description: Downloaded videos that are still on disk
   *                     storageBytes:
   *                       type: integer
   *                       description: Size of those videos, from recorded file sizes
   *                 downloads:
   *                   type: object
   *                   properties:
   *                     paused:
   *                       type: boolean
   *                       description: Downloads are paused by a storage limit
   *                     activeJob:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         type:
   *                           type: string
   *                         createdAt:
   *                           type: string
   *                           format: date-time
   *                           nullable: true
   *                     queuedJobs:
   *                       type: integer
   *                     videosDownloading:
   *                       type: integer
   *                     videosQueued:
   *                       type: integer
   *                 lastRun:
   *                   type: object
   *                   nullable: true
   *                   description: >
   *                     The last run that downloaded or failed something. After
   *                     a restart it is rebuilt from the download history
   *                     (finishedAt null) until a run finishes. Null when there
   *                     is no such run.
   *                   properties:
   *                     status:
   *                       type: string
   *                       enum: [success, warning, error]
   *                     finishedAt:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     lastCheckedAt:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     downloaded:
   *                       type: integer
   *                     failed:
   *                       type: integer
   *                 recentDownloads:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       youtubeId:
   *                         type: string
   *                       title:
   *                         type: string
   *                       channel:
   *                         type: string
   *                       downloadedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *       401:
   *         description: Invalid API key or session
   *       403:
   *         description: The API key is not a status key
   *       429:
   *         description: Rate limit exceeded
   *       500:
   *         description: Failed to build the status summary
   */
  router.get(STATUS_SUMMARY_PATH, verifyToken, statusKeyLimiter, async (req, res) => {
    try {
      res.json(await statusSummaryModule.getSummary({
        version: serverVersion,
        ytDlpVersion: getCachedYtDlpVersion(),
      }));
    } catch (error) {
      req.log.error({ err: error }, 'Failed to build status summary');
      res.status(500).json({ error: 'Failed to build status summary' });
    }
  });

  return router;
};
