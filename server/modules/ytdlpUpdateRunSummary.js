// Translates a yt-dlp update result into the scheduled task run record, and
// derives the "last checked / last updated / last result" state the YT-DLP
// settings page shows from the recorded history.

const TASK_KEY = 'ytdlpUpdateFrequency';
// Every attempt counts as a check, including one deferred because an update
// was already running, so "Last checked" can say it was skipped and why.
const LAST_CHECK_STATUSES = ['success', 'error', 'interrupted', 'skipped'];

// ytdlpModule's failure messages restate that the update failed, which every
// display already says from the record's status. Keep only the reason.
const FAILED_PREFIX = /^Update failed:\s*/;
const EXIT_CODE_MESSAGE = /^Update failed with exit code (\d+)$/;

function describeFailure(message) {
  if (!message) return 'Unknown error';
  const exit = EXIT_CODE_MESSAGE.exec(message);
  if (exit) return `yt-dlp exited with code ${exit[1]}`;
  return message.replace(FAILED_PREFIX, '');
}

function toRunRecord(result = {}) {
  const outcome = result.reason || (result.success ? (result.newVersion ? 'updated' : 'up-to-date') : 'error');
  if (outcome === 'updated') {
    return {
      status: 'success',
      outcome,
      message: result.newVersion ? `Updated to ${result.newVersion}` : 'Update completed.',
      details: result.newVersion ? { version: result.newVersion } : null,
    };
  }
  if (outcome === 'up-to-date') {
    return { status: 'success', outcome, message: 'Already up to date.', details: null };
  }
  if (outcome === 'skipped') {
    return { status: 'skipped', outcome, message: result.message || 'Update deferred.', details: null };
  }
  return { status: 'error', outcome: 'error', message: describeFailure(result.message), details: null };
}

function resultStatus(run) {
  if (run.status === 'success') return run.outcome || 'up-to-date';
  if (run.status === 'skipped') return 'skipped';
  return 'error';
}

// Legacy fallback: releases before the run history stored these three fields in config.json.
function toUpdateState({ lastRun, lastUpdate, config = {} }) {
  if (!lastRun) {
    return {
      lastChecked: config.ytdlpLastChecked ?? null,
      lastUpdated: config.ytdlpLastUpdated ?? null,
      lastResult: config.ytdlpLastResult ?? null,
    };
  }
  const lastResult = { status: resultStatus(lastRun) };
  if (lastRun.message) lastResult.message = lastRun.message;
  if (lastRun.details && lastRun.details.version) lastResult.version = lastRun.details.version;
  return {
    lastChecked: lastRun.startedAt,
    lastUpdated: lastUpdate ? lastUpdate.startedAt : (config.ytdlpLastUpdated ?? null),
    lastResult,
  };
}

module.exports = { TASK_KEY, LAST_CHECK_STATUSES, toRunRecord, toUpdateState };
