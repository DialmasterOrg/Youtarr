// Maps the end of a channel-and-playlist download sweep to its scheduled-task
// run record: what it downloaded, what went wrong, and whether it ran to the
// end. Pure, so every wording is testable without a sweep.

const { MAX_WAIT_MS } = require('./sweepCompletion');

const MS_PER_HOUR = 60 * 60 * 1000;
const EMPTY_TOTALS = {
  totalDownloaded: 0,
  totalSkipped: 0,
  totalFailed: 0,
  totalMembersOnly: 0,
  jobCount: 0,
  stoppedGroups: [],
  jobIssues: [],
};

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// "3 videos downloaded, 2 failed, 6 skipped (already downloaded or filtered)."
function describeCounts(totals) {
  const parts = [];
  if (totals.totalDownloaded > 0) parts.push(`${plural(totals.totalDownloaded, 'video')} downloaded`);
  if (totals.totalFailed > 0) {
    parts.push(parts.length > 0 ? `${totals.totalFailed} failed` : `${plural(totals.totalFailed, 'video')} failed`);
  }
  if (totals.totalMembersOnly > 0) parts.push(`${totals.totalMembersOnly} members-only skipped`);
  if (totals.totalSkipped > 0) parts.push(`${totals.totalSkipped} skipped (already downloaded or filtered)`);
  return parts.length > 0 ? `${parts.join(', ')}.` : 'No new videos.';
}

// Problems that make the sweep partly failed, one sentence each.
function describeProblems(totals, queueResult) {
  const problems = [];
  for (const { status, reason } of totals.jobIssues) {
    const what = status === 'Terminated' || status === 'Killed' ? 'A download job was terminated' : 'A download job failed';
    problems.push(reason ? `${what}: ${reason}` : what);
  }
  for (const { group, reason, terminated } of totals.stoppedGroups) {
    const where = terminated ? `Terminated in ${group}` : `Stopped early at ${group}`;
    problems.push(`${where}${reason ? ` (${reason})` : ''}; later groups were skipped.`);
  }
  if (queueResult.playlistError) {
    problems.push(`The playlist check failed: ${queueResult.playlistError}`);
  } else if (queueResult.playlistsFailed > 0) {
    problems.push(`${queueResult.playlistsFailed} of ${plural(queueResult.playlistsChecked, 'playlist')} could not be checked.`);
  }
  return problems;
}

function withPeriod(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * @param {Object} input
 * @param {Object} input.sweep - waitForSweepEnd's result
 * @param {Object} [input.queueResult] - doChannelAndPlaylistDownloads's result
 * @param {string|null} [input.pauseMessage] - why downloads are paused, when they are
 * @returns {{ status: string, outcome: string, message: string, details: Object, finishedAt?: Date }}
 */
function toRunRecord({ sweep, queueResult = {}, pauseMessage = null }) {
  const totals = { ...EMPTY_TOTALS, ...(sweep.totals || {}) };
  const remaining = sweep.remainingJobs || 0;
  const sentences = [];

  if (sweep.endedBy === 'paused') {
    sentences.push(withPeriod(`Stopped when downloads were paused: ${pauseMessage || 'Downloads are paused.'}`));
    sentences.push(`${plural(remaining, 'queued job')} will run when downloads resume.`);
  } else if (sweep.endedBy === 'timeout') {
    sentences.push(`Stopped tracking after ${MAX_WAIT_MS / MS_PER_HOUR} hours; ${plural(remaining, 'job')} still queued or running.`);
  } else if (sweep.endedBy === 'error') {
    sentences.push(withPeriod(`Could not tell when the downloads finished: ${sweep.error || 'unknown error'}`));
  }
  sentences.push(describeCounts(totals));

  const problems = describeProblems(totals, queueResult).map(withPeriod);
  sentences.push(...problems);
  if (queueResult.playlistsPausedReason && sweep.endedBy !== 'paused') {
    sentences.push(withPeriod(`Playlist downloads were skipped: ${queueResult.playlistsPausedReason}`));
  }

  const partlyFailed = totals.totalFailed > 0 || problems.length > 0;
  let status = 'success';
  let outcome = 'completed';
  if (sweep.endedBy === 'timeout' || sweep.endedBy === 'error') {
    status = 'error';
    outcome = sweep.endedBy === 'timeout' ? 'timed-out' : 'error';
  } else if (partlyFailed) {
    status = 'error';
    outcome = 'partial';
  } else if (sweep.endedBy === 'paused') {
    outcome = 'paused';
  }

  return {
    status,
    outcome,
    message: sentences.join(' '),
    // When the sweep's downloads ended, which the wait may notice a few
    // seconds (or a reporting grace period) later.
    ...(sweep.finishedAt instanceof Date ? { finishedAt: sweep.finishedAt } : {}),
    details: {
      endedBy: sweep.endedBy,
      downloaded: totals.totalDownloaded,
      skipped: totals.totalSkipped,
      failed: totals.totalFailed,
      membersOnly: totals.totalMembersOnly,
      jobs: totals.jobCount,
      ...(remaining > 0 ? { remainingJobs: remaining } : {}),
      ...(queueResult.playlistsChecked ? { playlistsChecked: queueResult.playlistsChecked } : {}),
      ...(queueResult.playlistsFailed ? { playlistsFailed: queueResult.playlistsFailed } : {}),
    },
  };
}

module.exports = { toRunRecord };
