const { v4: uuidv4 } = require('uuid');
const jobModule = require('../jobModule');
const MessageEmitter = require('../messageEmitter');
const logger = require('../../logger');
const { mergeDiagnoses } = require('./failureAdvisor');

// A "run" groups the multiple download jobs produced by a single
// channel-and-playlist sweep (one channel job plus one job per playlist
// settings-group) so the user sees a single aggregated summary for the whole
// sweep instead of the summary for whichever job happened to finish last.
const RUN_LABEL_BOTH = 'Channel & playlist update';
// Value must stay 'Channel Downloads' so the client renders it as "Channel update".
const RUN_LABEL_CHANNEL = 'Channel Downloads';
const RUN_LABEL_PLAYLIST = 'Playlist downloads';
const PLAYLIST_LABEL_PREFIX = 'Playlist: ';

const TERMINAL_STATUSES = new Set([
  'Complete',
  'Complete with Warnings',
  'Error',
  'Terminated',
  'Killed',
]);

function deriveLabel(jobTypes) {
  const types = jobTypes.filter((t) => typeof t === 'string');
  const hasChannel = types.some((t) => t.includes('Channel Downloads'));
  const playlistTypes = types.filter((t) => t.startsWith(PLAYLIST_LABEL_PREFIX));
  const hasPlaylist = playlistTypes.length > 0;

  if (hasChannel && hasPlaylist) return RUN_LABEL_BOTH;
  if (hasChannel) return RUN_LABEL_CHANNEL;
  if (hasPlaylist) return playlistTypes.length === 1 ? playlistTypes[0] : RUN_LABEL_PLAYLIST;
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
  if (parts.length === 0) return 'Download completed: No new videos to download';
  return `Download completed: ${parts.join(', ')}`;
}

class DownloadRunTracker {
  constructor() {
    this.runs = new Map();
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

  maybeFinalize(runId) {
    const run = this.runs.get(runId);
    if (!run || run.finalized || !run.sealed) return;

    const allDone = [...run.jobIds].every((id) => {
      if (run.reported.has(id)) return true;
      const job = jobModule.getJob(id);
      return !job || TERMINAL_STATUSES.has(job.status);
    });
    if (!allDone) return;

    run.finalized = true;
    this.runs.delete(runId);

    // Nothing actually ran (e.g. no new videos on any source): stay silent, nothing to summarize.
    if (run.jobIds.size === 0) return;

    this.emitFinalSummary(run);
  }

  emitFinalSummary(run) {
    const acc = run.acc;
    const terminatedChannels = dedupeTerminatedChannels(acc.terminatedChannels);
    const terminationFailures = [...new Set(acc.terminationFailures)];
    const hasIssue =
      acc.totalFailed > 0 ||
      acc.totalMembersOnly > 0 ||
      terminatedChannels.length > 0 ||
      terminationFailures.length > 0;

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

    // Diagnosed failures notify even when nothing downloaded: automated users
    // otherwise never learn about a persistent, fixable failure.
    if (acc.totalDownloaded > 0 || terminatedChannels.length > 0 || terminationFailures.length > 0 || acc.diagnoses.length > 0) {
      const notificationModule = require('../notificationModule');
      notificationModule
        .sendDownloadNotification({ finalSummary, videoData: acc.videoData })
        .catch((err) => logger.error({ err }, 'Failed to send aggregated run download notification'));
    }
  }
}

module.exports = new DownloadRunTracker();
