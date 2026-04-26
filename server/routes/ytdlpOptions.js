const express = require('express');
const customArgsParser = require('../modules/download/customArgsParser');
const ytdlpValidator = require('../modules/download/ytdlpValidator');

/**
 * @swagger
 * /api/ytdlp/validate-args:
 *   post:
 *     summary: Validate custom yt-dlp arguments
 *     description: Tokenize, denylist-check, and dry-run user-supplied yt-dlp args via `yt-dlp ... --help`. Argparse runs first; help text is discarded and no network calls are made.
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [args]
 *             properties:
 *               args:
 *                 type: string
 *                 description: Raw command-line args, max 2000 characters
 *     responses:
 *       200:
 *         description: Validation result. `ok=true` means args parsed cleanly; `ok=false` means yt-dlp rejected them and `stderr` contains the message.
 *       400:
 *         description: Input failed local checks (not a string, too long, parse error, or denylisted flag).
 *       401:
 *         description: Missing or invalid auth token.
 *       429:
 *         description: Rate limit exceeded.
 */
function createYtdlpOptionsRoutes({ verifyToken, ytdlpValidationRateLimiter }) {
  const router = express.Router();

  router.post(
    '/api/ytdlp/validate-args',
    verifyToken,
    ytdlpValidationRateLimiter,
    async (req, res) => {
      const { args } = req.body || {};
      if (typeof args !== 'string') {
        return res.status(400).json({ error: 'args must be a string' });
      }
      if (args.length > customArgsParser.MAX_CUSTOM_ARGS_LENGTH) {
        return res.status(400).json({
          error: `args exceed ${customArgsParser.MAX_CUSTOM_ARGS_LENGTH} character limit`,
        });
      }

      let tokens;
      try {
        tokens = customArgsParser.tokenize(args);
      } catch (err) {
        return res.status(400).json({ error: `Parse error: ${err.message}` });
      }

      const validation = customArgsParser.validate(tokens);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await ytdlpValidator.dryRun(tokens);
      if (result.ok) {
        return res.json({ ok: true, message: 'Arguments parsed successfully' });
      }
      return res.json({ ok: false, stderr: result.stderr });
    }
  );

  return router;
}

module.exports = createYtdlpOptionsRoutes;
