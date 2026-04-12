const express = require('express');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// Metadata endpoint rate limiter. The endpoint may spawn yt-dlp on cache miss
// (up to 60s per call), so we cap concurrent abuse. The limit is generous
// enough for a user rapidly clicking through a video list.
const metadataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: { error: 'Too many metadata requests, please try again shortly' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * Creates video detail routes for metadata and streaming
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Object} deps.videoMetadataModule - Video metadata module
 * @returns {express.Router}
 */
function createVideoDetailRoutes({ verifyToken, videoMetadataModule }) {
  const router = express.Router();

  /**
   * Middleware to support token via query parameter.
   * HTML <video> elements cannot set custom headers, so the frontend
   * passes the auth token as ?token=... in the src URL.
   * This copies it to the x-access-token header before verifyToken runs.
   */
  const queryTokenToHeader = (req, res, next) => {
    if (req.query.token && !req.headers['x-access-token']) {
      req.headers['x-access-token'] = req.query.token;
    }
    next();
  };

  /**
   * @swagger
   * /api/videos/{youtubeId}/metadata:
   *   get:
   *     summary: Get extended video metadata
   *     description: Returns curated metadata from the cached .info.json file, or fetches it via yt-dlp if not cached.
   *     tags: [Videos]
   *     parameters:
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube video ID
   *     responses:
   *       200:
   *         description: Video metadata
   *       400:
   *         description: Invalid YouTube ID
   *       500:
   *         description: Internal server error
   */
  router.get('/api/videos/:youtubeId/metadata', metadataLimiter, verifyToken, async (req, res) => {
    const { youtubeId } = req.params;

    if (!youtubeId || !/^[A-Za-z0-9_-]{6,20}$/.test(youtubeId)) {
      return res.status(400).json({ error: 'Invalid YouTube ID' });
    }

    try {
      const metadata = await videoMetadataModule.getVideoMetadata(youtubeId);
      res.json(metadata);
    } catch (err) {
      req.log.error({ err, youtubeId }, 'Failed to get video metadata');
      res.status(500).json({ error: 'Failed to retrieve video metadata' });
    }
  });

  /**
   * @swagger
   * /api/videos/{youtubeId}/stream:
   *   get:
   *     summary: Stream a downloaded video file
   *     description: Serves the downloaded video or audio file with HTTP Range support for seeking. Auth token must be passed as a query parameter since <video> elements cannot set custom headers.
   *     tags: [Videos]
   *     parameters:
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube video ID
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [video, audio]
   *           default: video
   *         description: Whether to stream the video or audio file
   *       - in: query
   *         name: token
   *         schema:
   *           type: string
   *         description: Authentication token (required for video element src)
   *     responses:
   *       200:
   *         description: Full file response
   *       206:
   *         description: Partial content (range request)
   *       400:
   *         description: Invalid YouTube ID
   *       404:
   *         description: Video or file not found
   *       416:
   *         description: Range not satisfiable
   *       500:
   *         description: Internal server error
   */
  router.get('/api/videos/:youtubeId/stream', queryTokenToHeader, verifyToken, async (req, res) => {
    const { youtubeId } = req.params;
    const type = req.query.type || 'video';

    if (!youtubeId || !/^[A-Za-z0-9_-]{6,20}$/.test(youtubeId)) {
      return res.status(400).json({ error: 'Invalid YouTube ID' });
    }

    if (type !== 'video' && type !== 'audio') {
      return res.status(400).json({ error: 'Invalid type parameter. Must be "video" or "audio"' });
    }

    try {
      const streamInfo = await videoMetadataModule.getVideoStreamInfo(youtubeId, type);

      if (streamInfo.error === 'not_found') {
        return res.status(404).json({ error: streamInfo.message });
      }
      if (streamInfo.error === 'no_file') {
        return res.status(404).json({ error: streamInfo.message });
      }
      if (streamInfo.error === 'file_missing') {
        return res.status(404).json({ error: streamInfo.message });
      }

      const { filePath, contentType, fileSize } = streamInfo;
      const range = req.headers.range;

      // Prevent caching of token-bearing stream URLs
      const cacheHeaders = {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      };

      if (range) {
        // Parse Range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || isNaN(end) || start < 0) {
          res.status(416).set('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        if (start >= fileSize || end >= fileSize || start > end) {
          res.status(416).set('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        const chunkSize = end - start + 1;

        res.status(206).set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          ...cacheHeaders,
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.on('error', (err) => {
          req.log.error({ err, youtubeId }, 'Stream read error');
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error reading file' });
          } else {
            res.destroy();
          }
        });
        stream.pipe(res);
      } else {
        // No range - serve entire file
        res.set({
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          ...cacheHeaders,
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
          req.log.error({ err, youtubeId }, 'Stream read error');
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error reading file' });
          } else {
            res.destroy();
          }
        });
        stream.pipe(res);
      }
    } catch (err) {
      req.log.error({ err, youtubeId }, 'Failed to stream video');
      res.status(500).json({ error: 'Failed to stream video' });
    }
  });

  return router;
}

module.exports = createVideoDetailRoutes;
