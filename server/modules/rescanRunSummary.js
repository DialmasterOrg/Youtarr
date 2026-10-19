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

// Rows skipped because another writer changed them, rows whose write failed,
// and rows left unmarked because the downloads folder looked unmounted;
// empty when there were none.
function describeRowProblems(result) {
  const parts = [];
  if (count(result.skippedChanged) > 0) parts.push(`${count(result.skippedChanged)} skipped (changed during the scan)`);
  if (count(result.failed) > 0) parts.push(`${count(result.failed)} failed`);
  if (count(result.notMarkedMissing) > 0) {
    // The check's message is a sentence; inside parentheses it drops its period.
    const cause = result.libraryCheckMessage ? ` (${result.libraryCheckMessage.replace(/\.$/, '')})` : '';
    parts.push(`${count(result.notMarkedMissing)} not marked missing${cause}`);
  }
  return parts;
}

function describe(outcome, result) {
  const scanned = count(result.processed).toLocaleString('en-US');
  const problems = describeRowProblems(result);
  // A manual "Rescan anyway" marked videos missing without the unmounted-drive check.
  const skipped = result.libraryCheckSkipped ? ' The downloads folder check was skipped.' : '';
  if (outcome === 'error') return result.errorMessage || 'Unknown error';
  if (outcome === 'timed-out') {
    const suffix = problems.length > 0 ? ` (${problems.join(', ')})` : '';
    return `Reached the time limit after ${scanned} videos${suffix}; continues at the next run.${skipped}`;
  }
  const counts = [`${count(result.updated)} updated`, `${count(result.removed)} marked missing`, ...problems];
  return `Scanned ${scanned} videos: ${counts.join(', ')}.${skipped}`;
}

function toRunRecord(result = {}) {
  if (result.skipped) {
    return { status: 'skipped', outcome: 'skipped', message: 'A rescan was already running.', details: null };
  }
  let outcome = result.status || (result.timedOut ? 'timed-out' : 'completed');
  // A finished scan with failed row writes, or with rows it could not mark
  // missing because the downloads folder looked unmounted, partly failed,
  // like other scheduled tasks. A timed-out scan keeps its outcome so the
  // Maintenance page still offers to continue it; its message carries the count.
  if (outcome === 'completed' && (count(result.failed) > 0 || count(result.notMarkedMissing) > 0)) outcome = 'partial';
  return {
    status: outcome === 'error' || outcome === 'partial' ? 'error' : 'success',
    outcome,
    message: describe(outcome, result),
    details: {
      videosScanned: count(result.processed),
      filesFoundOnDisk: count(result.filesOnDisk),
      // Folders or files the walk could not read; their rows were re-checked by path.
      unreadableOnDisk: count(result.unreadableOnDisk),
      videosUpdated: count(result.updated),
      videosMarkedMissing: count(result.removed),
      // Rows the walk nominated but left as recorded: their files were where
      // the row says (e.g. outside the downloads folder) or couldn't be checked.
      videosKept: count(result.kept),
      // Rows another writer changed after the rescan read them; left for a later run.
      videosSkipped: count(result.skippedChanged),
      videosFailed: count(result.failed),
      // Rows left unmarked because the downloads folder looked unmounted.
      videosNotMarkedMissing: count(result.notMarkedMissing),
      ...(result.libraryCheckSkipped ? { libraryCheckSkipped: true } : {}),
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
    ...(details.libraryCheckSkipped ? { libraryCheckSkipped: true } : {}),
  };
}

module.exports = { TASK_KEY, LAST_RUN_STATUSES, toRunRecord, fromRunRecord };
