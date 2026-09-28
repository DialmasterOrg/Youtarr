const { v4: uuidv4 } = require('uuid');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const logger = require('../../logger');
const { mergeDiagnoses } = require('./failureAdvisor');
const { MANUAL_DOWNLOAD_LABEL, PLAYLIST_DOWNLOAD_LABEL_PREFIX, PLAYLIST_RETRY_LABEL_PREFIX } = require('./jobTypes');

// A "run" groups the multiple download jobs produced by a single
// channel-and-playlist sweep (one channel job plus one job per playlist
// settings-group) so the user sees a single aggregated summary for the whole
// sweep instead of the summary for whichever job happened to finish last.
const RUN_LABEL_BOTH = 'Channel & playlist update';
// Value must stay 'Channel Downloads' so the client renders it as "Channel update".
const RUN_LABEL_CHANNEL = 'Channel Downloads';
const RUN_LABEL_PLAYLIST = 'Playlist downloads';
const RUN_LABEL_MANUAL = 'Manual downloads';

const TERMINAL_STATUSES = new Set([
  'Complete',
  'Complete with Warnings',
  'Error',
  'Failed',
  'Terminated',
  'Killed',
]);

// Finished runs remembered for callers that ask after the fact: a sweep that
// queues nothing, or whose jobs all finish while it is still being queued,
// finalizes before its caller can listen for the end.
const FINISHED_RUNS_KEPT = 20;
const UNREPORTED_JOB_REASON = 'A download job ended without reporting its results.';
// How long a job with a final status may take to report its results (its
// videos are reloaded from the database first) before the run gives up on it.
const REPORT_GRACE_MS = 5 * 60 * 1000;

function deriveLabel(jobTypes) {
  const types = jobTypes.filter((t) => typeof t === 'string');
  const hasChannel = types.some((t) => t.includes('Channel Downloads'));
  const playlistTypes = types.filter((t) => t.startsWith(PLAYLIST_DOWNLOAD_LABEL_PREFIX) || t.startsWith(PLAYLIST_RETRY_LABEL_PREFIX));
  const hasPlaylist = playlistTypes.length > 0;
  const hasManual = types.some((t) => t.includes(MANUAL_DOWNLOAD_LABEL));

  if (hasChannel && hasPlaylist) return RUN_LABEL_BOTH;
  if (hasChannel) return RUN_LABEL_CHANNEL;
  if (hasPlaylist) return playlistTypes.length === 1 ? playlistTypes[0] : RUN_LABEL_PLAYLIST;
  if (hasManual) return RUN_LABEL_MANUAL;
  return RUN_LABEL_CHANNEL;
}

function dedupeTerminatedChannels(channels) {
  const seen = new Set();
  const result = [];
  for (const channel of channels) {
    const key = channel && channel.channelId ? channel.channelId : null;
    if (key === null) {
      result.push(channel);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(channel);
  }
  return result;
}

// "a download job failed (reason)" / "a download job was terminated (reason)".
function describeJobIssue({ status, reason }) {
  const what = status === 'Terminated' || status === 'Killed' ? 'a download job was terminated' : 'a download job failed';
  const why = typeof reason === 'string' ? reason.replace(/\.$/, '') : '';
  return why ? `${what} (${why})` : what;
}

function buildSummaryText(summary) {
  const parts = [];
  if (summary.totalDownloaded > 0) {
    parts.push(`${summary.totalDownloaded} video${summary.totalDownloaded !== 1 ? 's' : ''} downloaded`);
  }
  if (summary.totalFailed > 0) parts.push(`${summary.totalFailed} failed`);
  if (summary.totalSkipped > 0) parts.push(`${summary.totalSkipped} skipped`);
  if (summary.totalMembersOnly > 0) {
    parts.push(`${summary.totalMembersOnly} members-only skipped`);
  }
  if (summary.totalTerminatedChannels > 0) {
    parts.push(`${summary.totalTerminatedChannels} channel${summary.totalTerminatedChannels !== 1 ? 's' : ''} marked terminated`);
  }
  const stoppedGroups = summary.stoppedGroups || [];
  for (const { group, reason, terminated } of stoppedGroups) {
    const where = terminated ? `terminated in ${group}` : `stopped at ${group}`;
    parts.push(`${where}${reason ? ` (${reason})` : ''}, later groups skipped`);
  }
  const jobIssues = summary.jobIssues || [];
  for (const issue of jobIssues) parts.push(describeJobIssue(issue));
  let prefix = 'Download completed';
  if (stoppedGroups.length > 0) prefix = 'Download stopped early';
  else if (jobIssues.length > 0) prefix = 'Download finished with problems';
  if (parts.length === 0) return `${prefix}: No new videos to download`;
  return `${prefix}: ${parts.join(', ')}`;
}

// The counts a run's caller needs to describe it, without the per-video data.
function totalsOf(run) {
  const acc = run.acc;
  return {
    totalDownloaded: acc.totalDownloaded,
    totalSkipped: acc.totalSkipped,
    totalFailed: acc.totalFailed,
    totalMembersOnly: acc.totalMembersOnly,
    jobCount: run.jobIds.size,
    stoppedGroups: [...acc.stoppedGroups],
    jobIssues: [...acc.jobIssues],
  };
}

class DownloadRunTracker {
  constructor() {
    this.runs = new Map();
    // runId -> { finishedAt: Date, totals }, oldest first.
    this.finished = new Map();
    // runId -> Set of listeners waiting for that run to finish.
    this.finishListeners = new Map();
  }

  /**
   * Begin tracking a new download run.
   * @returns {string} the run id to thread through the run's jobs
   */
  startRun() {
    const runId = `run-${uuidv4()}`;
    this.runs.set(runId, {
      sealed: false,
      finalized: false,
      jobIds: new Set(),
      reported: new Set(),
      // jobId -> when an unreported job was first seen with a final status.
      reportingSince: new Map(),
      // When a job of this run last ended, for dating a run closed on a job
      // that never reported.
      lastEndedAt: null,
      graceTimer: null,
      jobTypes: [],
      acc: {
        totalDownloaded: 0,
        totalSkipped: 0,
        totalFailed: 0,
        totalMembersOnly: 0,
        failedVideos: [],
        diagnoses: [],
        terminatedChannels: [],
        terminationFailures: [],
        videoData: [],
        // Grouped channel jobs stopped partway: { group, reason, terminated }.
        stoppedGroups: [],
        // Jobs that ended in Error or were terminated: { status, reason, byUser }.
        jobIssues: [],
      },
    });
    return runId;
  }

  /**
   * True while a run with this id is still being tracked (not yet finalized).
   * @param {string|null|undefined} runId
   * @returns {boolean}
   */
  isActive(runId) {
    return !!runId && this.runs.has(runId);
  }

  /**
   * Jobs of an active run that have not reported and are not in a terminal
   * state, with their live status. Empty for an unknown or finalized run.
   * @param {string} runId
   * @returns {Array<{ id: string, status: string }>}
   */
  getUnfinishedJobs(runId) {
    const run = this.runs.get(runId);
    if (!run) return [];
    const unfinished = [];
    for (const id of run.jobIds) {
      if (run.reported.has(id)) continue;
      const job = jobModule.getJob(id);
      if (job && !TERMINAL_STATUSES.has(job.status)) unfinished.push({ id, status: job.status });
    }
    return unfinished;
  }

  /**
   * Record that a job belongs to a run so the run knows when every job is done.
   * @param {string} runId
   * @param {string} jobId
   */
  registerJob(runId, jobId) {
    const run = this.runs.get(runId);
    if (!run || !jobId) return;
    run.jobIds.add(jobId);
  }

  /**
   * Fold a completed job's per-job summary into the run total. The run owns the
   * summary, so the caller must not emit its own finalSummary or notification.
   * @returns {boolean} true if the run owns this job (caller should suppress its
   *   own emit), false if no such run exists
   */
  recordJobResult(runId, jobId, summary = {}) {
    const run = this.runs.get(runId);
    if (!run) return false;

    run.jobIds.add(jobId);
    run.reported.add(jobId);
    if (summary.jobType) run.jobTypes.push(summary.jobType);

    const acc = run.acc;
    acc.totalDownloaded += summary.totalDownloaded || 0;
    acc.totalSkipped += summary.totalSkipped || 0;
    acc.totalFailed += summary.totalFailed || 0;
    acc.totalMembersOnly += summary.totalMembersOnly || 0;
    if (Array.isArray(summary.failedVideos)) acc.failedVideos.push(...summary.failedVideos);
    if (Array.isArray(summary.diagnoses)) acc.diagnoses = mergeDiagnoses(acc.diagnoses, summary.diagnoses);
    if (Array.isArray(summary.videoData)) acc.videoData.push(...summary.videoData);
    if (Array.isArray(summary.terminatedChannels)) acc.terminatedChannels.push(...summary.terminatedChannels);
    if (Array.isArray(summary.terminationFailures)) acc.terminationFailures.push(...summary.terminationFailures);
    if (summary.stoppedGroup) acc.stoppedGroups.push(summary.stoppedGroup);
    if (summary.jobIssue) acc.jobIssues.push(summary.jobIssue);

    this.maybeFinalize(runId);
    return true;
  }

  /**
   * Mark a run as fully enqueued. After this, the run finalizes once every
   * registered job has reached a terminal state.
   * @param {string} runId
   */
  seal(runId) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.sealed = true;
    this.maybeFinalize(runId);
  }

  /**
   * Finish the run once it is sealed and every job has reported its results.
   * A job with a final status that has not reported is still reporting
   * (jobModule.updateJob sets the status before the finalizer reports the
   * totals), so it holds the run for REPORT_GRACE_MS; after that it is given
   * up on and counted as an issue, since some paths end a job without
   * reporting. A job no longer in jobModule can never report, so it is given
   * up on at once.
   * @param {string} runId
   */
  maybeFinalize(runId) {
    const run = this.runs.get(runId);
    if (!run || run.finalized || !run.sealed) return;

    const now = Date.now();
    const givenUp = [];
    let nextDeadline = null;
    for (const id of run.jobIds) {
      if (run.reported.has(id)) continue;
      const job = jobModule.getJob(id);
      if (job && !TERMINAL_STATUSES.has(job.status)) {
        // Queued or running: the job's own end will check again.
        this.clearGraceTimer(run);
        return;
      }
      if (!job) {
        givenUp.push({ id, job });
        continue;
      }
      if (!run.reportingSince.has(id)) {
        run.reportingSince.set(id, now);
        run.lastEndedAt = Math.max(run.lastEndedAt ?? 0, now);
      }
      const deadline = run.reportingSince.get(id) + REPORT_GRACE_MS;
      if (deadline > now) nextDeadline = nextDeadline === null ? deadline : Math.min(nextDeadline, deadline);
      else givenUp.push({ id, job });
    }

    if (nextDeadline !== null) {
      this.scheduleGraceCheck(runId, run, nextDeadline - now);
      return;
    }

    for (const { id, job } of givenUp) {
      run.reported.add(id);
      run.acc.jobIssues.push({
        status: (job && job.status) || 'Error',
        reason: (job && job.output) || UNREPORTED_JOB_REASON,
        byUser: false,
      });
    }
    // A run closed on a job that never reported ends when that job ended, not
    // when its grace ran out.
    const finishedAt = givenUp.length > 0 && run.lastEndedAt !== null ? new Date(run.lastEndedAt) : new Date(now);
    this.finalize(runId, run, finishedAt);
  }

  scheduleGraceCheck(runId, run, delayMs) {
    this.clearGraceTimer(run);
    run.graceTimer = setTimeout(() => {
      run.graceTimer = null;
      this.maybeFinalize(runId);
    }, delayMs);
    if (typeof run.graceTimer.unref === 'function') run.graceTimer.unref();
  }

  clearGraceTimer(run) {
    if (run.graceTimer) clearTimeout(run.graceTimer);
    run.graceTimer = null;
  }

  finalize(runId, run, finishedAt) {
    this.clearGraceTimer(run);
    run.finalized = true;
    this.runs.delete(runId);
    this.rememberFinished(runId, run, finishedAt);

    // Nothing actually ran (e.g. no new videos on any source): stay silent, nothing to summarize.
    if (run.jobIds.size === 0) return;

    this.emitFinalSummary(run);
  }

  /**
   * Jobs of an active run that have not reported, with their live status and
   * whether they are still reporting (a final status, results not in yet) as
   * opposed to queued or running.
   * @param {string} runId
   * @returns {Array<{ id: string, status: string|null, reporting: boolean }>}
   */
  getUnreportedJobs(runId) {
    const run = this.runs.get(runId);
    if (!run) return [];
    const unreported = [];
    for (const id of run.jobIds) {
      if (run.reported.has(id)) continue;
      const job = jobModule.getJob(id);
      const status = job ? job.status : null;
      unreported.push({ id, status, reporting: !job || TERMINAL_STATUSES.has(status) });
    }
    return unreported;
  }

  /**
   * A job was given a final status by any path (jobModule.onJobEnded). The
   * job may still report; if it does not, the run's grace timer closes it.
   * @param {{ jobId: string }} event
   */
  handleJobEnded({ jobId }) {
    for (const [runId, run] of this.runs) {
      if (!run.jobIds.has(jobId)) continue;
      run.lastEndedAt = Date.now();
      if (!run.reported.has(jobId) && !run.reportingSince.has(jobId)) run.reportingSince.set(jobId, run.lastEndedAt);
      this.maybeFinalize(runId);
      return;
    }
  }

  /**
   * A queued job abandoned before it started (jobModule.onJobAbandoned).
   * @param {{ jobId: string, runId: string|null, reason: string }} event
   */
  handleAbandonedJob({ jobId, runId, reason }) {
    if (!this.isActive(runId)) return;
    this.recordJobResult(runId, jobId, { jobIssue: { status: 'Error', reason, byUser: false } });
  }

  rememberFinished(runId, run, finishedAt = new Date()) {
    const entry = { finishedAt, totals: totalsOf(run) };
    this.finished.set(runId, entry);
    while (this.finished.size > FINISHED_RUNS_KEPT) {
      this.finished.delete(this.finished.keys().next().value);
    }
    const listeners = this.finishListeners.get(runId);
    this.finishListeners.delete(runId);
    for (const listener of listeners || []) {
      try {
        listener(entry);
      } catch (err) {
        logger.warn({ err, runId }, 'Download run finish listener failed');
      }
    }
  }

  /**
   * Call listener({ finishedAt, totals }) once the run finishes; right away
   * (asynchronously) if it already has. Never called for an unknown run.
   * @param {string} runId
   * @param {Function} listener
   * @returns {Function} unsubscribe
   */
  onRunFinished(runId, listener) {
    const finished = this.finished.get(runId);
    if (finished) {
      Promise.resolve().then(() => listener(finished));
      return () => {};
    }
    if (!this.runs.has(runId)) return () => {};
    if (!this.finishListeners.has(runId)) this.finishListeners.set(runId, new Set());
    const listeners = this.finishListeners.get(runId);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && this.finishListeners.get(runId) === listeners) {
        this.finishListeners.delete(runId);
      }
    };
  }

  /**
   * The end of a remembered finished run, or null.
   * @param {string} runId
   * @returns {{ finishedAt: Date, totals: Object }|null}
   */
  getFinishedRun(runId) {
    return this.finished.get(runId) || null;
  }

  /**
   * Counts so far for an active run, or the final counts of a remembered one.
   * @param {string} runId
   * @returns {Object|null}
   */
  getTotals(runId) {
    const run = this.runs.get(runId);
    if (run) return totalsOf(run);
    const finished = this.finished.get(runId);
    return finished ? finished.totals : null;
  }

  emitFinalSummary(run) {
    const acc = run.acc;
    const terminatedChannels = dedupeTerminatedChannels(acc.terminatedChannels);
    const terminationFailures = [...new Set(acc.terminationFailures)];
    const hasIssue =
      acc.totalFailed > 0 ||
      acc.totalMembersOnly > 0 ||
      terminatedChannels.length > 0 ||
      terminationFailures.length > 0 ||
      acc.stoppedGroups.length > 0 ||
      acc.jobIssues.length > 0;

    const finalSummary = {
      totalDownloaded: acc.totalDownloaded,
      totalSkipped: acc.totalSkipped,
      totalFailed: acc.totalFailed,
      totalMembersOnly: acc.totalMembersOnly,
      totalTerminatedChannels: terminatedChannels.length,
      totalTerminationFailures: terminationFailures.length,
      failedVideos: acc.failedVideos,
      diagnoses: acc.diagnoses,
      terminatedChannels,
      terminationFailures,
      jobType: deriveLabel(run.jobTypes),
      completedAt: new Date().toISOString(),
      ...(acc.stoppedGroups.length > 0 ? { stoppedGroups: acc.stoppedGroups } : {}),
      ...(acc.jobIssues.length > 0 ? { jobIssues: acc.jobIssues } : {}),
    };

    const payload = {
      text: buildSummaryText(finalSummary),
      progress: {
        jobId: null,
        state: hasIssue ? 'warning' : 'complete',
        videoCount: {
          completed: acc.totalDownloaded,
          total: acc.totalDownloaded,
          skipped: acc.totalSkipped,
        },
      },
      finalSummary,
    };
    if (hasIssue) payload.warning = true;

    MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', payload);

    logger.info(
      {
        totalDownloaded: acc.totalDownloaded,
        totalFailed: acc.totalFailed,
        totalSkipped: acc.totalSkipped,
        jobCount: run.jobIds.size,
      },
      'Emitted aggregated final summary for download run'
    );

    // Diagnosed failures and a group that failed partway notify even when
    // nothing downloaded: automated users otherwise never learn about a
    // persistent, fixable failure. A user termination alone does not notify.
    const stoppedByFailure = acc.stoppedGroups.some((g) => !g.terminated) || acc.jobIssues.some((issue) => !issue.byUser);
    if (acc.totalDownloaded > 0 || terminatedChannels.length > 0 || terminationFailures.length > 0 || acc.diagnoses.length > 0 || stoppedByFailure) {
      const notificationModule = require('../notificationModule');
      notificationModule
        .sendDownloadNotification({ finalSummary, videoData: acc.videoData })
        .catch((err) => logger.error({ err }, 'Failed to send aggregated run download notification'));
    }
  }
}

const downloadRunTracker = new DownloadRunTracker();
downloadRunTracker.REPORT_GRACE_MS = REPORT_GRACE_MS;

module.exports = downloadRunTracker;
