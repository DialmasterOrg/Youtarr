const express = require('express');
const logger = require('../logger');
const { sendRunBlocked } = require('./runNowResponse');

/**
 * Maintenance routes.
 * Hosts the manual "rescan files on disk" trigger and a status endpoint.
 *
 * @swagger
 * tags:
 *   name: Maintenance
 *   description: Filesystem reconciliation actions
 */
function createMaintenanceRoutes({
  verifyToken, videosModule, configModule, scheduledTaskRuns, rescanRunSummary, scheduledTaskManager,
}) {
  const router = express.Router();

  /**
   * @swagger
   * /api/maintenance/rescan-files:
   *   post:
   *     summary: Kick off a manual filesystem rescan
   *     tags: [Maintenance]
   *     responses:
   *       202:
   *         description: Rescan started
   *       409:
   *         description: A rescan is already in progress, or the task cannot start (reason in the body)
   *       503:
   *         description: The task is not registered yet (server still starting or database unavailable)
   */
  router.post('/api/maintenance/rescan-files', verifyToken, async (req, res) => {
    try {
      const outcome = await scheduledTaskManager.runNow('videoRescanFrequency', {
        trigger: 'manual',
        enforceCooldown: false,
      });
      if (!outcome.started) {
        return sendRunBlocked(res, outcome, { running: 'Rescan already in progress' });
      }
      return res.status(202).json({ status: 'started', trigger: 'manual' });
    } catch (err) {
      logger.error({ err }, 'Failed to start manual rescan');
      return res.status(500).json({ error: 'Failed to start rescan' });
    }
  });

  /**
   * @swagger
   * /api/maintenance/rescan-status:
   *   get:
   *     summary: Get current rescan running state and last-run summary
   *     tags: [Maintenance]
   *     responses:
   *       200:
   *         description: Status object
   */
  router.get('/api/maintenance/rescan-status', verifyToken, async (req, res) => {
    try {
      const running = videosModule.isBackfillRunning();
      const run = await scheduledTaskRuns.getLatestRun(rescanRunSummary.TASK_KEY, { statuses: rescanRunSummary.LAST_RUN_STATUSES });
      // Legacy fallback: releases before the run history stored the summary in config.json.
      const lastRun = run
        ? rescanRunSummary.fromRunRecord(run)
        : (configModule.getConfig().rescanLastRun ?? null);
      return res.status(200).json({ running, lastRun });
    } catch (err) {
      logger.error({ err }, 'Failed to read rescan status');
      return res.status(500).json({ error: 'Failed to read rescan status' });
    }
  });

  return router;
}

module.exports = createMaintenanceRoutes;
