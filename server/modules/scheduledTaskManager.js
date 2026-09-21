const cron = require('node-cron');
const logger = require('../logger');
const { getScheduleError, getNextRun } = require('./scheduleConfig');

const tasks = new Map();
let runRecorder = null;

// The recorder (scheduledTaskRuns) is injected at startup once the database is
// ready; without one, tasks still run but leave no history.
function setRunRecorder(recorder) {
  runRecorder = recorder;
}

async function withRecorder(action) {
  if (!runRecorder) return null;
  try {
    return await action(runRecorder);
  } catch (err) {
    logger.warn({ err }, 'Could not record scheduled task activity');
    return null;
  }
}

const RUN_RESULT_STATUSES = new Set(['success', 'error', 'skipped']);

// Tasks may resolve to { status, outcome, message, details } to describe their
// run; status is success, error, or skipped. Anything else counts as success.
function describeResult(result) {
  const summary = result && typeof result === 'object' ? result : {};
  return {
    status: RUN_RESULT_STATUSES.has(summary.status) ? summary.status : 'success',
    outcome: summary.outcome ?? null,
    message: summary.message ?? null,
    details: summary.details ?? null,
  };
}

// Without a recorder there's no await before run(), so the task still starts
// in the same tick as the cron callback.
async function execute(id, state) {
  if (!state.enabled) return null;
  if (state.running) {
    if (runRecorder) await withRecorder((recorder) => recorder.recordSkipped(id));
    return null;
  }
  state.running = true;
  const handle = runRecorder
    ? await withRecorder((recorder) => recorder.start({ taskKey: id, trigger: 'scheduled' }))
    : null;
  let record;
  try {
    record = describeResult(await state.run());
  } catch (err) {
    logger.error({ err, task: id }, 'Scheduled task failed');
    record = { status: 'error', outcome: null, message: err.message, details: null };
  } finally {
    state.running = false;
  }
  if (handle) await withRecorder((recorder) => recorder.finish(handle, record));
  return record;
}

function updateTask({ id, expression, enabled = true, run }) {
  let state = tasks.get(id);
  if (!state) {
    state = {
      task: null,
      expression: null,
      enabled: false,
      running: false,
      run,
      requestedEnabled: enabled,
      lastError: null,
    };
    tasks.set(id, state);
  }
  state.run = run;
  state.requestedEnabled = enabled;

  // Disabling a feature must work even when its saved expression is invalid.
  if (!enabled) {
    if (state.enabled) {
      state.task.stop();
      state.enabled = false;
      logger.info({ task: id }, 'Scheduled task disabled');
    }
    return;
  }

  const scheduleError = getScheduleError(expression);
  state.lastError = scheduleError;
  if (scheduleError) {
    logger.warn(
      { task: id, expression, reason: scheduleError },
      'Invalid schedule; retaining the previous timer if available'
    );
    return;
  }
  expression = expression.trim();
  if (state.enabled && state.expression === expression) return;

  const previousTask = state.task;
  const wasEnabled = state.enabled;
  const name = `youtarr:${id}`;
  let replacement;
  try {
    replacement = cron.schedule(expression, () => execute(id, state), { scheduled: false, name });

    if (previousTask) previousTask.stop();
    state.enabled = true;
    replacement.start();
    state.task = replacement;
    state.expression = expression;
    logger.info({ task: id, expression }, 'Scheduled task configured');
  } catch (err) {
    if (replacement) replacement.stop();
    state.enabled = wasEnabled;
    // node-cron 3 stores named handles even when they are stopped.
    if (previousTask) cron.getTasks().set(name, previousTask);
    else cron.getTasks().delete(name);
    if (wasEnabled && previousTask) previousTask.start();
    logger.error({ err, task: id }, 'Could not replace scheduled task');
  }
}

function getStatus() {
  return [...tasks.entries()].map(([id, state]) => ({
    id,
    enabled: state.requestedEnabled,
    active: state.enabled,
    expression: state.enabled ? state.expression : null,
    error: state.requestedEnabled ? state.lastError : null,
    running: state.running,
    nextRunAt: state.enabled ? getNextRun(state.expression) : null,
  }));
}

function stopAll() {
  for (const state of tasks.values()) {
    if (state.task) state.task.stop();
    state.enabled = false;
  }
}

module.exports = { updateTask, stopAll, getStatus, setRunRecorder };
