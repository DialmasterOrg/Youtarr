const cron = require('node-cron');
const logger = require('../logger');
const { getScheduleError, getNextRun } = require('./scheduleConfig');
const messageEmitter = require('./messageEmitter');

const STATUS_MESSAGE_TYPE = 'scheduledTaskStatus';

// Why a manual run cannot start now. Tasks add their own reasons through
// getRunBlocker (for example 'downloads-paused').
const RUN_BLOCK_REASONS = Object.freeze({
  NOT_REGISTERED: 'not-registered',
  RUNNING: 'running',
  DISABLED: 'disabled',
  COOLDOWN: 'cooldown',
});

const BLOCK_MESSAGES = {
  [RUN_BLOCK_REASONS.NOT_REGISTERED]: 'This task is not available until the server has finished starting.',
  [RUN_BLOCK_REASONS.RUNNING]: 'This task is already running.',
  [RUN_BLOCK_REASONS.DISABLED]: 'This task is turned off.',
  [RUN_BLOCK_REASONS.COOLDOWN]: 'This task ran recently.',
};

function block(reason, availableAt = null) {
  return { reason, message: BLOCK_MESSAGES[reason], availableAt };
}

// Tells open Scheduling pages to refetch. Without a WebSocket server (early
// startup, scripts) the page still polls, so a failure only costs latency.
// Never throws: callers use it around run bookkeeping.
function notifyStatusChanged(id) {
  try {
    messageEmitter.emitMessage('broadcast', null, 'schedules', STATUS_MESSAGE_TYPE, { key: id });
  } catch (err) {
    logger.debug({ err, task: id }, 'Could not broadcast scheduled task status');
  }
}

// state.running covers runs this manager started; isRunning() is the
// feature's own lock, covering runs started at startup or by older paths.
function isTaskRunning(id, state) {
  if (state.running) return true;
  if (!state.isRunning) return false;
  try {
    return Boolean(state.isRunning());
  } catch (err) {
    logger.warn({ err, task: id }, 'Could not check whether a scheduled task is running');
    return false;
  }
}

const tasks = new Map();
let runRecorder = null;
// One blocker that applies across tasks (a reorganize moving files), checked
// for scheduled occurrences as well as manual runs: (id) => block | null.
let exclusiveBlocker = null;

function setExclusiveBlocker(blocker) {
  exclusiveBlocker = typeof blocker === 'function' ? blocker : null;
}

function exclusiveBlockFor(id) {
  if (!exclusiveBlocker) return null;
  try {
    return exclusiveBlocker(id) || null;
  } catch (err) {
    logger.warn({ err, task: id }, 'Could not check the cross-task run blocker');
    return null;
  }
}

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
// A task whose work carries on after it returns (automatic downloads queue a
// sweep that runs for hours) adds finalRecord, a promise of the record to
// write when that work ends; see finishWhenSettled.
function describeResult(result) {
  const summary = result && typeof result === 'object' ? result : {};
  const record = {
    status: RUN_RESULT_STATUSES.has(summary.status) ? summary.status : 'success',
    outcome: summary.outcome ?? null,
    message: summary.message ?? null,
    details: summary.details ?? null,
  };
  // A task that knows when its work really ended (a finalRecord that noticed
  // the end late) says so; otherwise the recorder stamps the current time.
  if (summary.finishedAt instanceof Date && !Number.isNaN(summary.finishedAt.getTime())) {
    record.finishedAt = summary.finishedAt;
  }
  return record;
}

function deferredRecordOf(result) {
  const finalRecord = result && typeof result === 'object' ? result.finalRecord : null;
  return finalRecord && typeof finalRecord.then === 'function' ? finalRecord : null;
}

// Closes a history row whose task handed back a finalRecord. The task's lock
// is already released by then: this only decides what the row says and when
// it closes, so however long the work runs, or if finalRecord never settles,
// nothing here can keep the task "running" or refuse a run. A row still open
// at shutdown is marked interrupted at the next startup.
function finishWhenSettled(id, handle, finalRecord) {
  Promise.resolve(finalRecord)
    .then(describeResult, (err) => {
      logger.error({ err, task: id }, 'Scheduled task failed after it started its work');
      return { status: 'error', outcome: null, message: err && err.message ? err.message : 'Unknown error', details: null };
    })
    .then((record) => (handle ? withRecorder((recorder) => recorder.finish(handle, record)) : null))
    .catch((err) => logger.warn({ err, task: id }, 'Could not record the end of a scheduled task'))
    .finally(() => notifyStatusChanged(id));
}

// run() always starts in this same tick, alongside the history insert, so the
// task's own lock (if it has one) is set before the caller (a route's 202)
// returns. The running flag above is set before the first await, which is
// what makes runNow's final check race-free. Everything after it sits inside
// the try, so nothing can leave the flag set.
async function execute(id, state, { trigger = 'scheduled', args = {}, force = false } = {}) {
  if (!force && !state.enabled) return null;
  if (state.running) {
    if (runRecorder) await withRecorder((recorder) => recorder.recordSkipped(id));
    return null;
  }
  const exclusive = exclusiveBlockFor(id);
  if (exclusive) {
    const skipped = { status: 'skipped', outcome: 'skipped', message: exclusive.message, details: null };
    const now = new Date();
    await withRecorder((recorder) => recorder.record({ taskKey: id, trigger, startedAt: now, finishedAt: now, ...skipped }));
    notifyStatusChanged(id);
    return skipped;
  }
  state.running = true;
  // Remembered so a skipped run (the task did nothing) can leave the
  // manual-run cooldown where it was instead of restarting it.
  const previousStartedAt = state.lastStartedAt;
  state.lastStartedAt = Date.now();
  let handle = null;
  let recording = null;
  let record;
  let finalRecord = null;
  try {
    notifyStatusChanged(id);
    recording = runRecorder
      ? withRecorder((recorder) => recorder.start({ taskKey: id, trigger }))
      : Promise.resolve(null);
    const work = state.run({ trigger, ...args });
    const [started, outcome] = await Promise.allSettled([recording, Promise.resolve(work)]);
    handle = started.status === 'fulfilled' ? started.value : null;
    if (outcome.status === 'rejected') throw outcome.reason;
    record = describeResult(outcome.value);
    finalRecord = deferredRecordOf(outcome.value);
  } catch (err) {
    logger.error({ err, task: id, trigger }, 'Scheduled task failed');
    record = { status: 'error', outcome: null, message: err.message, details: null };
    // A synchronous throw from state.run() (bad arguments, a broken task)
    // skips Promise.allSettled entirely, leaving the history insert
    // unawaited; wait for it here so the row still gets a handle to finish.
    // withRecorder never rejects.
    if (handle === null && recording) handle = await recording;
  } finally {
    state.running = false;
    if (record.status === 'skipped') state.lastStartedAt = previousStartedAt;
  }
  if (finalRecord) {
    finishWhenSettled(id, handle, finalRecord);
  } else if (handle) {
    await withRecorder((recorder) => recorder.finish(handle, record));
  }
  notifyStatusChanged(id);
  return record;
}

function updateTask({
  id, expression, enabled = true, run, isRunning = null, getRunBlocker = null,
  manualCooldownMs = 0, manualRunRequiresEnabled = true,
}) {
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
      lastStartedAt: null,
    };
    tasks.set(id, state);
  }
  state.run = run;
  state.isRunning = isRunning;
  state.getRunBlocker = getRunBlocker;
  state.manualCooldownMs = manualCooldownMs;
  state.manualRunRequiresEnabled = manualRunRequiresEnabled;
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

function describeTask(id, state) {
  return {
    id,
    enabled: state.requestedEnabled,
    active: state.enabled,
    expression: state.enabled ? state.expression : null,
    error: state.requestedEnabled ? state.lastError : null,
    running: isTaskRunning(id, state),
    nextRunAt: state.enabled ? getNextRun(state.expression) : null,
  };
}

// Whether a registered task is running now (by the manager or its own lock).
function isTaskRunningById(id) {
  const state = tasks.get(id);
  return state ? isTaskRunning(id, state) : false;
}

function getStatus() {
  return [...tasks.entries()].map(([id, state]) => describeTask(id, state));
}

function stopAll() {
  for (const state of tasks.values()) {
    if (state.task) state.task.stop();
    state.enabled = false;
  }
}

// Checked in this order so the most actionable reason wins: already running,
// a feature-specific blocker, turned off, then the manual-run cooldown.
async function getRunBlocker(id, { enforceEnabled = true, enforceCooldown = true, fresh = false, now = Date.now() } = {}) {
  const state = tasks.get(id);
  if (!state) return block(RUN_BLOCK_REASONS.NOT_REGISTERED);
  if (isTaskRunning(id, state)) return block(RUN_BLOCK_REASONS.RUNNING);
  const exclusive = exclusiveBlockFor(id);
  if (exclusive) return { availableAt: null, ...exclusive };
  if (state.getRunBlocker) {
    let taskBlock = null;
    try {
      taskBlock = await state.getRunBlocker({ fresh });
    } catch (err) {
      // Fail open, like the tasks' own pre-run checks.
      logger.warn({ err, task: id }, 'Could not check whether a scheduled task may run');
    }
    if (taskBlock) return { availableAt: null, ...taskBlock };
  }
  if (enforceEnabled && state.manualRunRequiresEnabled && !state.requestedEnabled) {
    return block(RUN_BLOCK_REASONS.DISABLED);
  }
  if (enforceCooldown && state.manualCooldownMs > 0 && state.lastStartedAt !== null) {
    const availableAt = state.lastStartedAt + state.manualCooldownMs;
    if (availableAt > now) return block(RUN_BLOCK_REASONS.COOLDOWN, new Date(availableAt));
  }
  return null;
}

async function runNow(id, { trigger = 'manual', args = {}, enforceEnabled = true, enforceCooldown = true } = {}) {
  const blocker = await getRunBlocker(id, { enforceEnabled, enforceCooldown, fresh: true });
  if (blocker) return { started: false, ...blocker };
  const state = tasks.get(id);
  // getRunBlocker awaited, so another caller may have started the task since.
  if (isTaskRunning(id, state)) return { started: false, ...block(RUN_BLOCK_REASONS.RUNNING) };
  const completion = execute(id, state, { trigger, args, force: true });
  return { started: true, completion };
}

// Availability first, then status, so both describe the same moment. A task
// that finished while its blocker was being read is read once more; any
// disagreement left after that resolves to "running", the safe side.
async function getTaskSnapshot(id) {
  let blocker = await getRunBlocker(id);
  const state = tasks.get(id);
  if (!state) return { status: null, blocker };
  let status = describeTask(id, state);
  if (!status.running && blocker && blocker.reason === RUN_BLOCK_REASONS.RUNNING) {
    blocker = await getRunBlocker(id);
    status = describeTask(id, state);
  }
  const running = status.running || Boolean(blocker && blocker.reason === RUN_BLOCK_REASONS.RUNNING);
  return {
    status: { ...status, running },
    blocker: running ? block(RUN_BLOCK_REASONS.RUNNING) : blocker,
  };
}

// For work that runs outside the manager (startup passes). Call it right
// after starting the work, so the feature's lock is already set when an open
// page refetches.
function announceRun(id, promise) {
  notifyStatusChanged(id);
  return Promise.resolve(promise).finally(() => notifyStatusChanged(id));
}

module.exports = {
  updateTask, stopAll, getStatus, getTaskSnapshot, setRunRecorder, setExclusiveBlocker, runNow, getRunBlocker,
  notifyStatusChanged, announceRun, isTaskRunningById, RUN_BLOCK_REASONS,
};
