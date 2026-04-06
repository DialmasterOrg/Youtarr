'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { ParseError } = require('../modules/subscriptionImport/takeoutParser');
const { FetchError } = require('../modules/subscriptionImport/cookiesFetcher');
const { ImportInProgressError } = require('../modules/subscriptionImport');
const {
  COOKIES_FILE_MAX_BYTES,
  TAKEOUT_FILE_MAX_BYTES,
  COOKIES_RATE_LIMIT_WINDOW_MS,
  COOKIES_RATE_LIMIT_MAX,
} = require('../modules/subscriptionImport/constants');

// Multer instances -- memory storage so cookies never touch disk
const takeoutUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAKEOUT_FILE_MAX_BYTES },
});

const cookiesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COOKIES_FILE_MAX_BYTES },
});

// Rate limiter for the cookies preview endpoint (expensive yt-dlp call)
const cookiesLimiter = rateLimit({
  windowMs: COOKIES_RATE_LIMIT_WINDOW_MS,
  max: COOKIES_RATE_LIMIT_MAX,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * Map FetchError codes to HTTP status codes.
 */
const FETCH_ERROR_STATUS_MAP = {
  INVALID_FORMAT: 400,
  NO_CHANNELS_FOUND: 422,
  TIMEOUT: 504,
};
const FETCH_ERROR_DEFAULT_STATUS = 502;

/**
 * Creates subscription import routes.
 *
 * @param {Object} deps
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.subscriptionImportModule - SubscriptionImportModule instance
 * @returns {express.Router}
 */
function createSubscriptionRoutes({ verifyToken, subscriptionImportModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/subscriptions/preview/takeout:
   *   post:
   *     summary: Preview channels from a Google Takeout CSV
   *     description: Upload a Google Takeout subscriptions.csv file and receive a preview of channels found, with subscription status.
   *     tags: [Subscriptions]
   *     consumes:
   *       - multipart/form-data
   *     parameters:
   *       - in: formData
   *         name: file
   *         type: file
   *         required: true
   *         description: Google Takeout subscriptions.csv file
   *     responses:
   *       200:
   *         description: Preview of channels found in the CSV
   *       400:
   *         description: Missing file or invalid CSV format
   *       413:
   *         description: File too large
   *       500:
   *         description: Server error (e.g. database failure during cross-reference)
   */
  router.post(
    '/api/subscriptions/preview/takeout',
    verifyToken,
    takeoutUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const preview = await subscriptionImportModule.parseTakeout(req.file.buffer);
        return res.status(200).json(preview);
      } catch (err) {
        if (err instanceof ParseError) {
          return res.status(400).json({ error: err.message });
        }

        // Multer file-size errors surface as MulterError
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File exceeds maximum allowed size' });
        }

        req.log.error({ err }, 'Takeout preview failed');
        return res.status(500).json({ error: 'Failed to process takeout file' });
      }
    }
  );

  /**
   * @swagger
   * /api/subscriptions/preview/cookies:
   *   post:
   *     summary: Preview channels by fetching subscriptions with cookies
   *     description: Upload a Netscape cookies.txt file. The server uses yt-dlp to fetch your YouTube subscriptions and returns a preview.
   *     tags: [Subscriptions]
   *     consumes:
   *       - multipart/form-data
   *     parameters:
   *       - in: formData
   *         name: file
   *         type: file
   *         required: true
   *         description: Netscape-format cookies.txt file
   *     responses:
   *       200:
   *         description: Preview of channels fetched from YouTube
   *       400:
   *         description: Missing file or invalid cookies format
   *       422:
   *         description: No channels found for this account
   *       429:
   *         description: Rate limited
   *       502:
   *         description: yt-dlp error (expired cookies, bot check, network)
   *       504:
   *         description: yt-dlp timed out
   *       500:
   *         description: Server error
   */
  router.post(
    '/api/subscriptions/preview/cookies',
    verifyToken,
    cookiesLimiter,
    cookiesUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const preview = await subscriptionImportModule.fetchWithCookiesPreview(req.file.buffer);
        return res.status(200).json(preview);
      } catch (err) {
        if (err instanceof FetchError) {
          const status = FETCH_ERROR_STATUS_MAP[err.code] || FETCH_ERROR_DEFAULT_STATUS;
          return res.status(status).json({
            error: err.userMessage || err.message,
            details: err.details || '',
          });
        }

        // Multer file-size errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File exceeds maximum allowed size' });
        }

        req.log.error({ err }, 'Cookies preview failed');
        return res.status(500).json({ error: 'Failed to fetch subscriptions' });
      }
    }
  );

  /**
   * @swagger
   * /api/subscriptions/imports:
   *   post:
   *     summary: Start importing selected channels
   *     description: Accepts a list of channels to import. Returns immediately with a job ID; the import runs in the background.
   *     tags: [Subscriptions]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               channels:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       202:
   *         description: Import started
   *       400:
   *         description: Missing or empty channels array
   *       409:
   *         description: An import is already in progress
   *       500:
   *         description: Server error
   */
  router.post(
    '/api/subscriptions/imports',
    verifyToken,
    async (req, res) => {
      try {
        const { channels } = req.body;

        if (!Array.isArray(channels) || channels.length === 0) {
          return res.status(400).json({ error: 'channels array is required and must not be empty' });
        }

        const initiatedBy = req.username || 'unknown';
        const result = await subscriptionImportModule.startImport(channels, initiatedBy);
        return res.status(202).json(result);
      } catch (err) {
        if (err instanceof ImportInProgressError) {
          return res.status(409).json({ error: err.message });
        }

        req.log.error({ err }, 'Failed to start subscription import');
        return res.status(500).json({ error: 'Failed to start import' });
      }
    }
  );

  /**
   * @swagger
   * /api/subscriptions/imports/active:
   *   get:
   *     summary: Get the currently active import
   *     description: Returns a summary of the active import job, or 204 if no import is running.
   *     tags: [Subscriptions]
   *     responses:
   *       200:
   *         description: Active import summary
   *       204:
   *         description: No active import
   */
  router.get(
    '/api/subscriptions/imports/active',
    verifyToken,
    async (req, res) => {
      const active = subscriptionImportModule.getActiveImport();
      if (!active) {
        return res.status(204).end();
      }
      return res.status(200).json(active);
    }
  );

  /**
   * @swagger
   * /api/subscriptions/imports/{jobId}:
   *   get:
   *     summary: Get details of a specific import job
   *     description: Returns detailed state for an import job (active or historical).
   *     tags: [Subscriptions]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Import job details
   *       404:
   *         description: Import job not found
   *       500:
   *         description: Server error
   */
  router.get(
    '/api/subscriptions/imports/:jobId',
    verifyToken,
    async (req, res) => {
      try {
        const importData = await subscriptionImportModule.getImport(req.params.jobId);
        if (!importData) {
          return res.status(404).json({ error: 'Import not found' });
        }
        return res.status(200).json(importData);
      } catch (err) {
        req.log.error({ err, jobId: req.params.jobId }, 'Failed to get import details');
        return res.status(500).json({ error: 'Failed to get import details' });
      }
    }
  );

  /**
   * @swagger
   * /api/subscriptions/imports:
   *   get:
   *     summary: List recent import jobs
   *     description: Returns a list of recent import job summaries, sorted by most recent first.
   *     tags: [Subscriptions]
   *     responses:
   *       200:
   *         description: List of import job summaries
   *       500:
   *         description: Server error
   */
  router.get(
    '/api/subscriptions/imports',
    verifyToken,
    async (req, res) => {
      try {
        const imports = await subscriptionImportModule.listImports(10);
        return res.status(200).json({ imports });
      } catch (err) {
        req.log.error({ err }, 'Failed to list imports');
        return res.status(500).json({ error: 'Failed to list imports' });
      }
    }
  );

  /**
   * @swagger
   * /api/subscriptions/imports/{jobId}/cancel:
   *   post:
   *     summary: Cancel an active import
   *     description: Requests cancellation of the active import. The import will stop after the current channel finishes processing.
   *     tags: [Subscriptions]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Cancellation requested
   *       404:
   *         description: No active import with this job ID
   *       500:
   *         description: Server error
   */
  router.post(
    '/api/subscriptions/imports/:jobId/cancel',
    verifyToken,
    async (req, res) => {
      try {
        subscriptionImportModule.cancelImport(req.params.jobId);
        return res.status(200).json({ status: 'Cancelling' });
      } catch (err) {
        // cancelImport throws a generic Error when no active import matches
        if (err.message && err.message.includes('No active import')) {
          return res.status(404).json({ error: err.message });
        }

        req.log.error({ err, jobId: req.params.jobId }, 'Failed to cancel import');
        return res.status(500).json({ error: 'Failed to cancel import' });
      }
    }
  );

  return router;
}

module.exports = createSubscriptionRoutes;
