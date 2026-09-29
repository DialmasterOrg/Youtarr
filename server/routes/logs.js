const express = require('express');
const { pipeline } = require('stream');

function buildDownloadName(date) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `youtarr-logs-${stamp}.log`;
}

/**
 * Creates log file routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.logFilesModule - Log file listing and streaming
 * @param {Object} deps.configModule - Supplies the secrets hidden from the download
 * @returns {express.Router}
 */
module.exports = function createLogRoutes({ verifyToken, logFilesModule, configModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/logs/download:
   *   get:
   *     summary: Download the log files
   *     description: Returns every rolling log file in config/logs, oldest first, combined into one plain-text attachment. Configured API keys and tokens, token query parameters, and proxy credentials are replaced with [REDACTED].
   *     tags: [Configuration]
   *     responses:
   *       200:
   *         description: Combined log files
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *       401:
   *         description: Missing or invalid auth token
   *       404:
   *         description: No log files have been written yet
   *       500:
   *         description: The log folder could not be read
   */
  router.get('/api/logs/download', verifyToken, async (req, res) => {
    let files;
    try {
      files = await logFilesModule.listLogFiles();
    } catch (err) {
      req.log.error({ err }, 'Failed to list log files');
      return res.status(500).json({ error: 'Could not read the log folder' });
    }

    if (files.length === 0) {
      return res.status(404).json({ error: 'No log files found' });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${buildDownloadName(new Date())}"`);
    pipeline(logFilesModule.createCombinedStream(files, configModule.getConfig()), res, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        req.log.error({ err }, 'Failed to stream log files');
      }
    });
  });

  return router;
};
