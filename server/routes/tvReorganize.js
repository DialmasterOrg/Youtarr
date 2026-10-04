const express = require('express');
const logger = require('../logger');

const MAX_REVISION_LENGTH = 128;
const HOLD_STATES = new Set(['pending', 'failed', 'restored', 'dismissed']);
const DEFAULT_HOLD_STATES = ['pending', 'failed'];

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Reorganize routes: preview and apply a move of downloaded files between the
 * Videos and TV layouts, follow its progress, retry failed videos, and manage
 * the watch-state restores it leaves for the media servers.
 *
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.reorganize - modules/reorganize
 * @param {Object} deps.watchStatusHolds - modules/mediaServers/watchStatusHolds
 * @param {Object} deps.watchStatusPushBack - modules/mediaServers/watchStatusPushBack
 * @returns {express.Router}
 */
function createTvReorganizeRoutes({ verifyToken, reorganize, watchStatusHolds, watchStatusPushBack }) {
  const router = express.Router();

  // Refusals carry .status (400/404/409); anything else is unexpected.
  const sendError = (res, error, failure, context) => {
    if (error.status) {
      const body = { error: error.message };
      if (error.code) body.code = error.code;
      return res.status(error.status).json(body);
    }
    logger.error({ err: error, ...context }, failure);
    return res.status(500).json({ error: failure });
  };

  const changeOf = (req) => {
    const change = req.body && req.body.change;
    return change && typeof change === 'object' && !Array.isArray(change) ? change : null;
  };

  /**
   * @swagger
   * components:
   *   schemas:
   *     ReorganizeChange:
   *       type: object
   *       description: |
   *         A settings change that moves downloaded files. One of:
   *         { type: channelLayout, channelId, layout (videos|tv), folder? } (the Channel Settings toggle),
   *         { type: channel, channelId, subFolder } (a channel's sub_folder value),
   *         { type: folderLayout, folder ("" = main folder), layout },
   *         { type: defaultSubfolder, value ("" = main folder)}.
   *       required: [type]
   *       properties:
   *         type: { type: string, enum: [channelLayout, channel, folderLayout, defaultSubfolder] }
   *         channelId: { type: string }
   *         layout: { type: string, enum: [videos, tv] }
   *         folder: { type: string }
   *         subFolder: { type: string, nullable: true }
   *         value: { type: string }
   */

  /**
   * @swagger
   * /api/tv/reorganize/preview:
   *   post:
   *     summary: Preview a reorganize (dry run)
   *     description: Every downloaded video the change would move, with old and new paths and episode numbers (the first 200), what can't move (missing files, a destination held by another file), the shows it creates or moves, how many videos have watch state a media server would lose, and complete totals. Nothing is written. The revision token must be passed to apply. blocked says why apply would be refused right now (a download or a file task running).
   *     tags: [TV Shows]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [change]
   *             properties:
   *               change: { $ref: '#/components/schemas/ReorganizeChange' }
   *     responses:
   *       200: { description: The preview, with revision, needed, totals, shows, items, problems, watchState and blocked }
   *       400: { description: Invalid change, or a change that doesn't need a reorganize }
   *       404: { description: Channel or subfolder not found }
   *       409: { description: The change is refused (an MP3 download type for a TV folder) }
   *       500: { description: Failed to preview the reorganize }
   */
  router.post('/api/tv/reorganize/preview', verifyToken, async (req, res) => {
    const change = changeOf(req);
    if (!change) return res.status(400).json({ error: 'change is required' });
    try {
      return res.json(await reorganize.preview(change));
    } catch (error) {
      return sendError(res, error, 'Failed to preview the reorganize', { changeType: change.type });
    }
  });

  /**
   * @swagger
   * /api/tv/reorganize:
   *   post:
   *     summary: Apply a previewed reorganize
   *     description: Applies the settings change and moves the files in the background, holding download jobs until it ends. Progress is broadcast as tvReorganizeProgress WebSocket messages. When nothing has to move the change is applied directly (200, applied true).
   *     tags: [TV Shows]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [change, revision]
   *             properties:
   *               change: { $ref: '#/components/schemas/ReorganizeChange' }
   *               revision: { type: string, description: The preview's revision token }
   *     responses:
   *       200: { description: Nothing had to move; the change was applied }
   *       202: { description: Started; operationId identifies the operation }
   *       400: { description: Invalid change or missing revision }
   *       404: { description: Channel or subfolder not found }
   *       409: { description: A download, a file task or another reorganize is running, or files or settings changed since the preview (code STALE_PREVIEW) }
   *       500: { description: Failed to start the reorganize }
   */
  router.post('/api/tv/reorganize', verifyToken, async (req, res) => {
    const change = changeOf(req);
    const { revision } = req.body || {};
    if (!change) return res.status(400).json({ error: 'change is required' });
    if (typeof revision !== 'string' || !revision || revision.length > MAX_REVISION_LENGTH) {
      return res.status(400).json({ error: 'revision is required' });
    }
    try {
      const result = await reorganize.start(change, revision);
      return res.status(result.operationId ? 202 : 200).json(result);
    } catch (error) {
      return sendError(res, error, 'Failed to start the reorganize', { changeType: change.type });
    }
  });

  /**
   * @swagger
   * /api/tv/operations/active:
   *   get:
   *     summary: Get the running reorganize
   *     tags: [TV Shows]
   *     responses:
   *       200: { description: "{ operation } with the running operation, or null" }
   *       500: { description: Failed to load the running reorganize }
   */
  router.get('/api/tv/operations/active', verifyToken, async (req, res) => {
    try {
      return res.json({ operation: await reorganize.getActive() });
    } catch (error) {
      return sendError(res, error, 'Failed to load the running reorganize');
    }
  });

  /**
   * @swagger
   * /api/tv/operations/{operationId}:
   *   get:
   *     summary: Get a reorganize
   *     description: Its status (running, completed, partial, failed), counts, and the videos that could not be moved with why.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: operationId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The operation }
   *       400: { description: Invalid id }
   *       404: { description: Reorganize not found }
   *       500: { description: Failed to load the reorganize }
   */
  router.get('/api/tv/operations/:operationId', verifyToken, async (req, res) => {
    const operationId = positiveInt(req.params.operationId);
    if (!operationId) return res.status(400).json({ error: 'Invalid operation id' });
    try {
      const operation = await reorganize.getOperation(operationId);
      if (!operation) return res.status(404).json({ error: 'Reorganize not found' });
      return res.json(operation);
    } catch (error) {
      return sendError(res, error, 'Failed to load the reorganize', { operationId });
    }
  });

  /**
   * @swagger
   * /api/tv/operations/{operationId}/retry:
   *   post:
   *     summary: Retry a reorganize's failed videos
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: operationId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       202: { description: Retry started }
   *       400: { description: Invalid id, or nothing failed }
   *       404: { description: Reorganize not found }
   *       409: { description: It is still running, something that blocks a reorganize is running, or a newer reorganize changed the same channels }
   *       500: { description: Failed to retry the reorganize }
   */
  router.post('/api/tv/operations/:operationId/retry', verifyToken, async (req, res) => {
    const operationId = positiveInt(req.params.operationId);
    if (!operationId) return res.status(400).json({ error: 'Invalid operation id' });
    try {
      return res.status(202).json(await reorganize.retry(operationId));
    } catch (error) {
      return sendError(res, error, 'Failed to retry the reorganize', { operationId });
    }
  });

  /**
   * @swagger
   * /api/tv/holds:
   *   get:
   *     summary: List watch-state restores
   *     description: Watch state Youtarr keeps for videos a reorganize moved until the media servers show it again. Pending restores are still being pushed; failed ones were not restored within 14 days and keep protecting Youtarr's state until dismissed.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: query
   *         name: state
   *         schema: { type: string, description: 'Comma-separated: pending, failed, restored, dismissed (default pending,failed)' }
   *     responses:
   *       200: { description: "{ holds, counts }" }
   *       400: { description: Unknown state }
   *       500: { description: Failed to list watch-state restores }
   */
  router.get('/api/tv/holds', verifyToken, async (req, res) => {
    const states = typeof req.query.state === 'string' && req.query.state
      ? req.query.state.split(',').map((state) => state.trim())
      : DEFAULT_HOLD_STATES;
    if (states.some((state) => !HOLD_STATES.has(state))) {
      return res.status(400).json({ error: 'Unknown restore state' });
    }
    try {
      const [holds, counts] = await Promise.all([
        watchStatusHolds.describeHolds({ states }),
        watchStatusHolds.countHolds(),
      ]);
      return res.json({ holds, counts });
    } catch (error) {
      return sendError(res, error, 'Failed to list watch-state restores');
    }
  });

  /**
   * @swagger
   * /api/tv/holds/{holdId}/retry:
   *   post:
   *     summary: Retry a watch-state restore
   *     description: Pushes the held state to the media server now and gives the restore another 14 days.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: holdId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The push result }
   *       400: { description: Invalid id }
   *       404: { description: Restore not found }
   *       500: { description: Failed to retry the restore }
   */
  router.post('/api/tv/holds/:holdId/retry', verifyToken, async (req, res) => {
    const holdId = positiveInt(req.params.holdId);
    if (!holdId) return res.status(400).json({ error: 'Invalid restore id' });
    try {
      const hold = await watchStatusHolds.reopenHold(holdId);
      if (!hold) return res.status(404).json({ error: 'Restore not found' });
      return res.json(await watchStatusPushBack.pushPendingHolds({ holdIds: [holdId] }));
    } catch (error) {
      return sendError(res, error, 'Failed to retry the restore', { holdId });
    }
  });

  /**
   * @swagger
   * /api/tv/holds/{holdId}/dismiss:
   *   post:
   *     summary: Dismiss a watch-state restore
   *     description: Stops protecting Youtarr's stored watch state for this video and user; the next sync takes the server's state.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: holdId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       204: { description: Dismissed }
   *       400: { description: Invalid id }
   *       404: { description: Restore not found }
   *       500: { description: Failed to dismiss the restore }
   */
  router.post('/api/tv/holds/:holdId/dismiss', verifyToken, async (req, res) => {
    const holdId = positiveInt(req.params.holdId);
    if (!holdId) return res.status(400).json({ error: 'Invalid restore id' });
    try {
      const dismissed = await watchStatusHolds.dismissHold(holdId);
      if (!dismissed) return res.status(404).json({ error: 'Restore not found' });
      return res.status(204).end();
    } catch (error) {
      return sendError(res, error, 'Failed to dismiss the restore', { holdId });
    }
  });

  return router;
}

module.exports = createTvReorganizeRoutes;
