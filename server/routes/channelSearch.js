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

function createChannelSearchRoutes({ verifyToken, channelSearchModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/channels/search:
   *   post:
   *     summary: Search YouTube for channels by free text
   *     description: Search YouTube for channels via the YouTube Data API (when a key is configured) with a yt-dlp fallback. Results keep YouTube's relevance order and are ephemeral; nothing is persisted. Each result includes a `subscribed` flag reflecting whether an enabled Channel row with that channel_id exists locally. `videoCount` is only populated on the YouTube API path; the yt-dlp fallback returns null for it.
   *     tags: [Channels]
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
   *                 enum: [10, 25, 50, 100]
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
   *                       channelId: { type: string }
   *                       name: { type: string }
   *                       handle: { type: string, nullable: true, example: "@minecraft" }
   *                       url: { type: string, example: "https://www.youtube.com/channel/UC1sELGmy5jp5fQUugmuYlXQ" }
   *                       thumbnailUrl: { type: string, nullable: true }
   *                       subscriberCount: { type: integer, nullable: true }
   *                       videoCount: { type: integer, nullable: true }
   *                       description: { type: string, nullable: true }
   *                       subscribed: { type: boolean }
   *       400:
   *         description: Invalid query or count
   *       429:
   *         description: Rate limit exceeded (max 10 requests per minute)
   *       499:
   *         description: Client closed the request before search completed
   *       502:
   *         description: Search failed (yt-dlp or API error)
   *       504:
   *         description: Search timed out (60s server-side limit)
   */
  router.post('/api/channels/search', verifyToken, searchLimiter, async (req, res) => {
    const validation = validate(req.body, channelSearchModule.ALLOWED_COUNTS);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const controller = new AbortController();
    // res 'close' with writableEnded=false is the only reliable disconnect signal;
    // req 'close' also fires on normal completion once the body is consumed (Node >= 16).
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const results = await channelSearchModule.searchChannels(
        validation.query,
        validation.count,
        { signal: controller.signal }
      );
      if (res.headersSent) return;
      res.json({ results });
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof channelSearchModule.SearchCanceledError) {
        return res.status(499).json({ error: 'Search canceled' });
      }
      if (err instanceof channelSearchModule.SearchTimeoutError) {
        return res.status(504).json({ error: 'Search timed out' });
      }
      req.log.error({ err, query: validation.query }, 'channel search failed');
      return res.status(502).json({ error: 'Search failed' });
    }
  });

  return router;
}

module.exports = createChannelSearchRoutes;
