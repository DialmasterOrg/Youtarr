const express = require('express');
const customArgsParser = require('../modules/download/customArgsParser');
const ytdlpValidator = require('../modules/download/ytdlpValidator');

/**
 * @swagger
 * /api/ytdlp/validate-args:
 *   post:
 *     summary: Validate custom yt-dlp arguments
 *     description: Resolve each arg to its canonical yt-dlp option, check it against the allowlist policy, then dry-run the accepted args via `yt-dlp ... --help`. Blocked or malformed input returns 400 before any process starts; argparse runs first on the dry-run, help text is discarded, and no network calls are made.
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
 *         description: Input failed local checks (not a string, too long, unreadable, or an option the allowlist blocks). Allowlist failures include a `customArgsCheck` object listing the blocked options and parse errors.
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

      const check = customArgsParser.checkCustomArgs(args);
      if (!check.ok) {
        return res.status(400).json({
          error: customArgsParser.describeCheckFailure(check),
          customArgsCheck: customArgsParser.summarize(check),
        });
      }

      const result = await ytdlpValidator.dryRun(check.args);
      if (result.ok) {
        return res.json({
          ok: true,
          message: 'Arguments parsed successfully',
          warnings: check.warnings,
        });
      }
      return res.json({ ok: false, stderr: result.stderr, warnings: check.warnings });
    }
  );

  return router;
}

module.exports = createYtdlpOptionsRoutes;
