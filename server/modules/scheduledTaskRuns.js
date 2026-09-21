const { ScheduledTaskRun } = require('../models');
const logger = require('../logger');

// Bounded history per task: enough to answer "has this been failing all week".
const MAX_RUNS_PER_TASK = 20;
const LATEST_FIRST = [['started_at', 'DESC'], ['id', 'DESC']];

const RUN_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  SKIPPED: 'skipped',
  INTERRUPTED: 'interrupted',
};

// Messages give the reason only; the status column and every display add the
// "skipped" / "interrupted" framing themselves.
const SKIPPED_MESSAGE = 'The previous run was still in progress.';
const INTERRUPTED_MESSAGE = 'The server restarted before it finished.';

function toJson(details) {
  return details == null ? null : JSON.stringify(details);
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function serialize(row) {
  return {
    id: row.id,
    taskKey: row.task_key,
    trigger: row.trigger_type,
    status: row.status,
    outcome: row.outcome ?? null,
    message: row.message ?? null,
    details: parseJson(row.details),
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
  };
}

/**
 * Durable run history for scheduled tasks. Every method is best-effort: a
 * database problem is logged and never propagates into the task itself.
 */
class ScheduledTaskRuns {
  async start({ taskKey, trigger = 'scheduled' }) {
    try {
      return await ScheduledTaskRun.create({
        task_key: taskKey,
        trigger_type: trigger,
        status: RUN_STATUS.RUNNING,
        started_at: new Date(),
      });
    } catch (err) {
      logger.warn({ err, taskKey }, 'Could not record scheduled task start');
      return null;
    }
  }

  async finish(run, { status, outcome = null, message = null, details = null }) {
    if (!run) return;
    try {
      await ScheduledTaskRun.update(
        { status, outcome, message, details: toJson(details), finished_at: new Date() },
        { where: { id: run.id } }
      );
      await this.prune(run.task_key);
    } catch (err) {
      logger.warn({ err, taskKey: run.task_key }, 'Could not record scheduled task result');
    }
  }

  async record({ taskKey, trigger, startedAt, finishedAt, status, outcome = null, message = null, details = null }) {
    try {
      await ScheduledTaskRun.create({
        task_key: taskKey,
        trigger_type: trigger,
        started_at: startedAt,
        finished_at: finishedAt,
        status,
        outcome,
        message,
        details: toJson(details),
      });
      await this.prune(taskKey);
    } catch (err) {
      logger.warn({ err, taskKey }, 'Could not record task run');
    }
  }

  async recordSkipped(taskKey) {
    const now = new Date();
    await this.record({
      taskKey,
      trigger: 'scheduled',
      startedAt: now,
      finishedAt: now,
      status: RUN_STATUS.SKIPPED,
      message: SKIPPED_MESSAGE,
    });
  }

  async markInterruptedRuns() {
    try {
      const [count] = await ScheduledTaskRun.update(
        { status: RUN_STATUS.INTERRUPTED, message: INTERRUPTED_MESSAGE },
        { where: { status: RUN_STATUS.RUNNING } }
      );
      if (count > 0) {
        logger.info({ count }, 'Marked scheduled task runs interrupted by the previous shutdown');
      }
    } catch (err) {
      logger.warn({ err }, 'Could not mark interrupted scheduled task runs');
    }
  }

  async getLatestRuns() {
    try {
      const rows = await ScheduledTaskRun.findAll({ order: LATEST_FIRST });
      const latest = {};
      for (const row of rows) {
        if (!latest[row.task_key]) latest[row.task_key] = serialize(row);
      }
      return latest;
    } catch (err) {
      logger.warn({ err }, 'Could not read scheduled task history');
      return {};
    }
  }

  // Callers say which statuses count: a "last scan" wants runs that executed,
  // while a "last check" may also count a deferred (skipped) attempt.
  async getLatestRun(taskKey, { outcome, statuses } = {}) {
    try {
      const where = { task_key: taskKey };
      if (outcome) where.outcome = outcome;
      if (statuses) where.status = statuses;
      const row = await ScheduledTaskRun.findOne({ where, order: LATEST_FIRST });
      return row ? serialize(row) : null;
    } catch (err) {
      logger.warn({ err, taskKey }, 'Could not read scheduled task history');
      return null;
    }
  }

  // Keeps the newest MAX_RUNS_PER_TASK rows, plus any run still in progress
  // (its finish would otherwise have nothing to update) and the newest row of
  // each outcome, so "last installed" survives however many checks follow it.
  async prune(taskKey) {
    const rows = await ScheduledTaskRun.findAll({
      where: { task_key: taskKey },
      attributes: ['id', 'status', 'outcome'],
      order: LATEST_FIRST,
    });
    const seenOutcomes = new Set();
    const stale = [];
    rows.forEach((row, index) => {
      const newestOfOutcome = Boolean(row.outcome) && !seenOutcomes.has(row.outcome);
      if (newestOfOutcome) seenOutcomes.add(row.outcome);
      if (index < MAX_RUNS_PER_TASK || row.status === RUN_STATUS.RUNNING || newestOfOutcome) return;
      stale.push(row.id);
    });
    if (stale.length > 0) {
      await ScheduledTaskRun.destroy({ where: { id: stale } });
    }
  }
}

const scheduledTaskRuns = new ScheduledTaskRuns();
scheduledTaskRuns.RUN_STATUS = RUN_STATUS;

module.exports = scheduledTaskRuns;
