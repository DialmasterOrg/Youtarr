const express = require('express');
const logger = require('../logger');
const { sendRunBlocked, toRunNowState } = require('./runNowResponse');

/**
 * Schedule status routes.
 * Reports, for every configurable schedule, whether its timer is armed, when it
 * fires next, whether it is running now, and its most recent recorded run.
 *
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Scheduled task status and manual runs
 */
function createSchedulesRoutes({ verifyToken, scheduledTaskManager, scheduledTaskRuns, scheduleConfig }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/schedules:
   *   get:
   *     summary: Get the live state and last run of every scheduled task
   *     tags: [Schedules]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: One entry per configurable schedule
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 tasks:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key:
   *                         type: string
   *                         description: Config key of the schedule
   *                       label:
   *                         type: string
   *                       enabled:
   *                         type: boolean
   *                         description: Whether the owning feature asked for the task to run
   *                       active:
   *                         type: boolean
   *                         description: Whether a timer is armed
   *                       expression:
   *                         type: string
   *                         nullable: true
   *                         description: The cron expression the armed timer uses
   *                       error:
   *                         type: string
   *                         nullable: true
   *                         description: Why the saved expression could not be scheduled
   *                       running:
   *                         type: boolean
   *                       nextRunAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       lastRun:
   *                         type: object
   *                         nullable: true
   *                         properties:
   *                           trigger:
   *                             type: string
   *                             enum: [scheduled, manual, startup]
   *                           status:
   *                             type: string
   *                             enum: [running, success, error, skipped, interrupted]
   *                           outcome:
   *                             type: string
   *                             nullable: true
   *                           message:
   *                             type: string
   *                             nullable: true
   *                           startedAt:
   *                             type: string
   *                             format: date-time
   *                           finishedAt:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                       lastFinishedRun:
   *                         type: object
   *                         nullable: true
   *                         description: The newest run that ran to an end (success or error), with the same fields as lastRun; skipped and interrupted runs are left out, so this is the run to time
   *                       runNow:
   *                         type: object
   *                         properties:
   *                           available:
   *                             type: boolean
   *                           reason:
   *                             type: string
   *                             nullable: true
   *                           message:
   *                             type: string
   *                             nullable: true
   *                           availableAt:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                 serverTime:
   *                   type: string
   *                   format: date-time
   *                   description: Server clock when the response was built; clients time availableAt against it
   *       500:
   *         description: Status could not be read
   */
  router.get('/api/schedules', verifyToken, async (req, res) => {
    try {
      const [latestRuns, finishedRuns] = await Promise.all([
        scheduledTaskRuns.getLatestRuns(),
        scheduledTaskRuns.getLatestFinishedRuns(),
      ]);
      const tasks = await Promise.all(Object.entries(scheduleConfig.SCHEDULES).map(async ([key, definition]) => {
        const snapshot = await scheduledTaskManager.getTaskSnapshot(key);
        const status = snapshot.status || {};
        const blocker = snapshot.blocker;
        return {
          key,
          label: definition.label,
          enabled: Boolean(status.enabled),
          active: Boolean(status.active),
          expression: status.expression ?? null,
          error: status.error ?? null,
          running: Boolean(status.running),
          nextRunAt: status.nextRunAt ? status.nextRunAt.toISOString() : null,
          lastRun: latestRuns[key] ?? null,
          lastFinishedRun: finishedRuns[key] ?? null,
          runNow: toRunNowState(blocker),
        };
      }));
      return res.json({ tasks, serverTime: new Date().toISOString() });
    } catch (err) {
      logger.error({ err }, 'Failed to read schedule status');
      return res.status(500).json({ error: 'Failed to read schedule status' });
    }
  });

  /**
   * @swagger
   * /api/schedules/{key}/run:
   *   post:
   *     summary: Run a scheduled task now
   *     description: Starts the task in the background with the manual trigger, using the saved settings. The run appears in the task's history.
   *     tags: [Schedules]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *         description: Config key of the schedule, for example videoRescanFrequency
   *     responses:
   *       202:
   *         description: The run started
   *       404:
   *         description: Unknown task
   *       409:
   *         description: The task cannot run now; reason is running, disabled, cooldown, managed, downloads-paused, no-media-server, youtube-throttled or downloads-active, and availableAt says when it can run again when known
   *       503:
   *         description: The task is not registered yet (server still starting or database unavailable)
   */
  router.post('/api/schedules/:key/run', verifyToken, async (req, res) => {
    const { key } = req.params;
    if (!Object.prototype.hasOwnProperty.call(scheduleConfig.SCHEDULES, key)) {
      return res.status(404).json({ error: 'Unknown scheduled task' });
    }
    try {
      const outcome = await scheduledTaskManager.runNow(key, { trigger: 'manual' });
      if (!outcome.started) return sendRunBlocked(res, outcome);
      return res.status(202).json({ started: true });
    } catch (err) {
      logger.error({ err, task: key }, 'Failed to start scheduled task');
      return res.status(500).json({ error: 'Failed to start the task' });
    }
  });

  return router;
}

module.exports = createSchedulesRoutes;
