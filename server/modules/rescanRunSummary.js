// Translates a filesystem rescan result into the scheduled task run record and
// back into the shape the Maintenance page displays.

const TASK_KEY = 'videoRescanFrequency';
const OUTCOMES = ['completed', 'timed-out', 'error'];
// Runs that actually scanned something. A skipped occurrence never touched
// the disk, so it isn't the "last rescan" the Maintenance page reports.
const LAST_RUN_STATUSES = ['success', 'error', 'interrupted'];

function count(value) {
  return Number(value) || 0;
}

function describe(outcome, result) {
  const scanned = count(result.processed).toLocaleString('en-US');
  if (outcome === 'error') return result.errorMessage || 'Unknown error';
  if (outcome === 'timed-out') {
    return `Reached the time limit after ${scanned} videos; continues at the next run.`;
  }
  return `Scanned ${scanned} videos: ${count(result.updated)} updated, ${count(result.removed)} marked missing.`;
}

function toRunRecord(result = {}) {
  if (result.skipped) {
    return { status: 'skipped', outcome: 'skipped', message: 'A rescan was already running.', details: null };
  }
  const outcome = result.status || (result.timedOut ? 'timed-out' : 'completed');
  return {
    status: outcome === 'error' ? 'error' : 'success',
    outcome,
    message: describe(outcome, result),
    details: {
      videosScanned: count(result.processed),
      filesFoundOnDisk: count(result.filesOnDisk),
      videosUpdated: count(result.updated),
      videosMarkedMissing: count(result.removed),
    },
  };
}

function fromRunRecord(run) {
  if (!run) return null;
  const details = run.details || {};
  const status = OUTCOMES.includes(run.outcome)
    ? run.outcome
    : (run.status === 'success' ? 'completed' : 'error');
  return {
    startedAt: run.startedAt,
    completedAt: run.finishedAt,
    trigger: run.trigger,
    status,
    videosUpdated: count(details.videosUpdated),
    videosMarkedMissing: count(details.videosMarkedMissing),
    videosScanned: count(details.videosScanned),
    filesFoundOnDisk: count(details.filesFoundOnDisk),
    errorMessage: status === 'error' ? (run.message || null) : null,
  };
}

module.exports = { TASK_KEY, LAST_RUN_STATUSES, toRunRecord, fromRunRecord };
