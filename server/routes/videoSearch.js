const express = require('express');
const rateLimit = require('express-rate-limit');

const MAX_QUERY_LENGTH = 200;
const DEFAULT_COUNT = 25;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many search requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

function validate(body, ALLOWED_COUNTS) {
  if (!body || typeof body.query !== 'string') {
    return { error: 'query is required' };
  }
  const query = body.query.trim();
  if (query.length === 0) return { error: 'query must not be empty' };
  if (query.length > MAX_QUERY_LENGTH) return { error: `query must be at most ${MAX_QUERY_LENGTH} characters` };
  if (CONTROL_CHAR_REGEX.test(query)) return { error: 'query contains invalid characters' };

  const count = body.count === undefined ? DEFAULT_COUNT : body.count;
  if (!ALLOWED_COUNTS.includes(count)) {
    return { error: `count must be one of ${ALLOWED_COUNTS.join(', ')}` };
  }
  return { query, count };
}

function createVideoSearchRoutes({ verifyToken, videoSearchModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/videos/search:
   *   post:
   *     summary: Search YouTube by free text
   *     description: Search YouTube via yt-dlp and return a list of matching videos, sorted newest-to-oldest by publishedAt (entries without a timestamp sort last). Results are ephemeral; nothing is persisted. Each result includes a `status` field (`downloaded`, `missing`, or `never_downloaded`) describing the video's state in the local Video table.
   *     tags: [Videos]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - query
   *             properties:
   *               query:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 200
   *                 description: Search text. Trimmed; control characters rejected.
   *                 example: "Minecraft"
   *               count:
   *                 type: integer
   *                 enum: [10, 25, 50]
   *                 default: 25
   *                 description: Number of results to fetch from YouTube.
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 results:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       youtubeId: { type: string }
   *                       title: { type: string }
   *                       channelName: { type: string }
   *                       channelId: { type: string, nullable: true }
   *                       duration: { type: integer, nullable: true }
   *                       thumbnailUrl: { type: string, nullable: true }
   *                       publishedAt: { type: string, nullable: true, format: date-time }
   *                       viewCount: { type: integer, nullable: true }
   *                       status:
   *                         type: string
   *                         enum: [downloaded, missing, never_downloaded]
   *                       databaseId: { type: integer, nullable: true, description: "Video row id when status is downloaded or missing." }
   *                       filePath: { type: string, nullable: true }
   *                       fileSize: { type: integer, nullable: true }
   *                       audioFilePath: { type: string, nullable: true }
   *                       audioFileSize: { type: integer, nullable: true }
   *                       addedAt: { type: string, nullable: true, format: date-time }
   *                       isProtected: { type: boolean, nullable: true }
   *                       normalizedRating: { type: string, nullable: true }
   *                       ratingSource: { type: string, nullable: true }
   *       400:
   *         description: Invalid query or count
   *       429:
   *         description: Rate limit exceeded (max 10 requests per minute)
   *       499:
   *         description: Client closed the request before search completed
   *       502:
   *         description: Search failed (yt-dlp error)
   *       504:
   *         description: Search timed out (60s server-side limit)
   */
  router.post('/api/videos/search', verifyToken, searchLimiter, async (req, res) => {
    const validation = validate(req.body, videoSearchModule.ALLOWED_COUNTS);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const controller = new AbortController();
    req.on('close', () => {
      if (!res.headersSent) controller.abort();
    });

    try {
      const results = await videoSearchModule.searchVideos(
        validation.query,
        validation.count,
        { signal: controller.signal }
      );
      if (res.headersSent) return;
      res.json({ results });
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof videoSearchModule.SearchCanceledError) {
        return res.status(499).json({ error: 'Search canceled' });
      }
      if (err instanceof videoSearchModule.SearchTimeoutError) {
        return res.status(504).json({ error: 'Search timed out' });
      }
      req.log.error({ err, query: validation.query }, 'video search failed');
      return res.status(502).json({ error: 'Search failed' });
    }
  });

  return router;
}

module.exports = createVideoSearchRoutes;
