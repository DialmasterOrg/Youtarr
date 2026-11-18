const { Op } = require('sequelize');
const { Channel, Video } = require('../models');
const jobModule = require('./jobModule');
const videoActivity = require('./download/videoActivity');
const storageGuard = require('./storageGuard');
const storageUsage = require('./storageUsage');
const MessageEmitter = require('./messageEmitter');

// Dashboards poll this, so the database part is shared between callers for a
// short while instead of being queried on every request.
const LIBRARY_CACHE_MS = 30 * 1000;
const RECENT_DOWNLOADS_LIMIT = 10;

// How a finished job's status reads as a run status. Pending and In Progress
// jobs are absent on purpose: they have not finished.
const FINISHED_JOB_RUN_STATUS = {
  'Complete': 'success',
  'Complete with Warnings': 'warning',
  'Terminated': 'warning',
  'Error': 'error',
  'Killed': 'error',
};

// A clean run that found nothing new is not a result; a failed one is.
function hasRunResult(run) {
  return run.downloaded > 0 || run.failed > 0 || run.status === 'error';
}

function toIsoString(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// A read-only snapshot for dashboards. Everything comes from the database or
// from state already held in memory: it never runs yt-dlp, walks the disk or
// calls another service, and it exposes no filesystem paths.
class StatusSummaryModule {
  constructor() {
    this.libraryCache = null;
  }

  async getSummary({ version, ytDlpVersion }) {
    const { library, recentDownloads } = await this.getLibrary();
    return {
      version,
      ytDlp: { version: ytDlpVersion || null },
      library,
      downloads: this.getDownloads(),
      lastRun: this.getLastRun(),
      recentDownloads,
    };
  }

  getLibrary() {
    const now = Date.now();
    if (this.libraryCache && this.libraryCache.expiresAt > now) {
      return this.libraryCache.promise;
    }
    const promise = this.loadLibrary();
    const entry = { expiresAt: now + LIBRARY_CACHE_MS, promise };
    this.libraryCache = entry;
    // A failed load must not be served again for the rest of the cache window.
    promise.catch(() => {
      if (this.libraryCache === entry) this.libraryCache = null;
    });
    return promise;
  }

  async loadLibrary() {
    const [channels, videos, storageBytes, recentRows] = await Promise.all([
      Channel.count({ where: { enabled: true } }),
      Video.count({ where: { removed: false } }),
      storageUsage.getDownloadedBytes(),
      Video.findAll({
        attributes: ['youtubeId', 'youTubeVideoName', 'youTubeChannelName', 'last_downloaded_at'],
        where: { removed: false, last_downloaded_at: { [Op.ne]: null } },
        order: [['last_downloaded_at', 'DESC']],
        limit: RECENT_DOWNLOADS_LIMIT,
      }),
    ]);
    return {
      library: { channels, videos, storageBytes },
      recentDownloads: recentRows.map((row) => ({
        youtubeId: row.youtubeId,
        title: row.youTubeVideoName,
        channel: row.youTubeChannelName,
        downloadedAt: toIsoString(row.last_downloaded_at),
      })),
    };
  }

  getDownloads() {
    const jobs = Object.values(jobModule.getAllJobs() || {});
    const activeJob = jobs.find((job) => job.status === 'In Progress');
    const videoStates = Object.values(videoActivity.snapshot().videos);
    return {
      paused: storageGuard.getStatus()?.paused === true,
      activeJob: activeJob
        ? { type: activeJob.jobType, createdAt: toIsoString(activeJob.timeCreated) }
        : null,
      queuedJobs: jobs.filter((job) => job.status === 'Pending').length,
      videosDownloading: videoStates.filter((entry) => entry.state === 'downloading').length,
      videosQueued: videoStates.filter((entry) => entry.state === 'queued').length,
    };
  }

  // The last run that downloaded or failed something. A run finished by this
  // process is exact. After a restart, or when the only runs since then found
  // nothing new, it is rebuilt from the download history so a restart does
  // not blank it.
  getLastRun() {
    const sinceStartup = this.getLastRunSinceStartup();
    if (sinceStartup && hasRunResult(sinceStartup)) return sinceStartup;
    const fromHistory = this.getLastRunFromJobHistory();
    if (!fromHistory) return sinceStartup;
    // Only a run that finished looking can say when Youtarr last checked.
    return sinceStartup?.status === 'success'
      ? { ...fromHistory, lastCheckedAt: sinceStartup.lastCheckedAt }
      : fromHistory;
  }

  getLastRunSinceStartup() {
    const finishedRun = MessageEmitter.getLastFinishedRun();
    const summary = finishedRun?.finalSummary;
    if (!summary) return null;
    let status = 'success';
    if (finishedRun.error) status = 'error';
    else if (finishedRun.warning) status = 'warning';
    return {
      status,
      finishedAt: summary.completedAt || null,
      lastCheckedAt: summary.lastCheckedAt || summary.completedAt || null,
      downloaded: summary.totalDownloaded || 0,
      failed: summary.totalFailed || 0,
    };
  }

  // The newest finished job that downloaded or failed something. A job
  // records no end time, and a sweep of several jobs is represented by its
  // last one, so this is an approximation used only until a run finishes.
  getLastRunFromJobHistory() {
    let newest = null;
    for (const job of Object.values(jobModule.getAllJobs() || {})) {
      const status = FINISHED_JOB_RUN_STATUS[job.status];
      if (!status) continue;
      const run = {
        status,
        finishedAt: null,
        lastCheckedAt: null,
        downloaded: job.data?.videos?.length || 0,
        failed: job.data?.failedVideos?.length || 0,
      };
      if (!hasRunResult(run)) continue;
      const createdAt = new Date(job.timeCreated).getTime() || 0;
      if (!newest || createdAt > newest.createdAt) newest = { createdAt, run };
    }
    return newest ? newest.run : null;
  }
}

module.exports = new StatusSummaryModule();
