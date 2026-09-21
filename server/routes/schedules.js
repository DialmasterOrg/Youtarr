const express = require('express');
const logger = require('../logger');

/**
 * Schedule status routes.
 * Reports, for every configurable schedule, whether its timer is armed, when it
 * fires next, whether it is running now, and its most recent recorded run.
 *
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Scheduled task status
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
   *       500:
   *         description: Status could not be read
   */
  router.get('/api/schedules', verifyToken, async (req, res) => {
    try {
      const statuses = new Map(scheduledTaskManager.getStatus().map((status) => [status.id, status]));
      const latestRuns = await scheduledTaskRuns.getLatestRuns();
      const tasks = Object.entries(scheduleConfig.SCHEDULES).map(([key, definition]) => {
        const status = statuses.get(key) || {};
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
        };
      });
      return res.json({ tasks });
    } catch (err) {
      logger.error({ err }, 'Failed to read schedule status');
      return res.status(500).json({ error: 'Failed to read schedule status' });
    }
  });

  return router;
}

module.exports = createSchedulesRoutes;
