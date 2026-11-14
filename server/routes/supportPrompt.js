const express = require('express');
const logger = require('../logger');

/**
 * Support prompt routes: the one-time "consider supporting Youtarr" dialog.
 *
 * @swagger
 * tags:
 *   name: Support Prompt
 *   description: One-time donation prompt shown to established installs
 */
function createSupportPromptRoutes({ verifyToken, supportPromptModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/support-prompt:
   *   get:
   *     summary: Whether the one-time support prompt should be shown
   *     description: >
   *       True only once per install: after at least 200 downloaded videos and 14 days of use, when the prompt
   *       has never been shown before, and never on Elfhosted.
   *     tags: [Support Prompt]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Eligibility
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 show:
   *                   type: boolean
   *       500:
   *         description: Eligibility could not be checked
   */
  router.get('/api/support-prompt', verifyToken, async (req, res) => {
    try {
      const show = await supportPromptModule.shouldShow();
      return res.json({ show });
    } catch (err) {
      logger.error({ err }, 'Failed to check support prompt eligibility');
      return res.status(500).json({ error: 'Failed to check support prompt eligibility' });
    }
  });

  /**
   * @swagger
   * /api/support-prompt/shown:
   *   post:
   *     summary: Record that the support prompt was displayed
   *     description: Stamps `supportPromptShownAt` in config.json so the prompt is never shown again. Idempotent.
   *     tags: [Support Prompt]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       204:
   *         description: Recorded
   *       500:
   *         description: The config could not be saved
   */
  router.post('/api/support-prompt/shown', verifyToken, (req, res) => {
    try {
      supportPromptModule.markShown();
      return res.status(204).end();
    } catch (err) {
      logger.error({ err }, 'Failed to record that the support prompt was shown');
      return res.status(500).json({ error: 'Failed to record that the support prompt was shown' });
    }
  });

  return router;
}

module.exports = createSupportPromptRoutes;
