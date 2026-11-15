// Runs grabs in the background, on the pattern of externalRequestExecutor:
// addfile only stores a row; this picks pending rows up, queues an ordinary
// Youtarr download, and when that job ends stages the file for Sonarr or
// Radarr. It wakes on a new grab, on every finished job, and on a one-minute
// sweep that also recovers what a restart interrupted. Nothing here removes
// a video from Youtarr's library.
const crypto = require('crypto');
const fs = require('fs');
const { Op } = require('sequelize');
const { ARR_BRIDGE_JOB_LABEL, AUTO_RETRY_LABEL_PREFIX } = require('../download/jobTypes');
const { MAX_AUTO_RETRY_COUNT } = require('../download/transient403RetryPlanner');
const { parseAuxData } = require('../jobAuxData');

const SWEEP_INTERVAL_MS = 60 * 1000;
const SWEEP_BATCH_SIZE = 20;
const RESOLVE_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FAIL_MESSAGE_LENGTH = 200;
const FINAL_JOB_STATUSES = new Set(['Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed']);
const STOPPED_JOB_STATUSES = new Set(['Terminated', 'Killed']);
// jobModule terminates running and pending jobs when the server starts and
// says so in their output. Such a job did not fail: the video was never tried.
const RESTART_OUTPUT_PATTERN = /server restart/i;
// A file is only gone when the filesystem says so; any other error (a
// network share hiccup) is no verdict.
const ABSENT_CODES = new Set(['ENOENT', 'ENOTDIR']);
const NO_ENDED_JOBS = new Set();
// Shown in Sonarr and Radarr as the reason a download failed.
const MESSAGES = {
  queueFailed: 'Youtarr could not queue the download',
  stagingFailed: 'Youtarr could not stage the file for import',
  audioOnly: 'Youtarr downloaded audio only for this video, so there is no video file to import',
  stopped: 'The download was stopped in Youtarr',
  noFile: 'The download finished without a video file (members-only, filtered or unavailable)',
};

/**
 * @param {string} filePath
 * @returns {Promise<'present'|'missing'|'unknown'>}
 */
async function statFileState(filePath) {
  try {
    return (await fs.promises.stat(filePath)).isFile() ? 'present' : 'missing';
  } catch (error) {
    return ABSENT_CODES.has(error.code) ? 'missing' : 'unknown';
  }
}

function failMessage({ video, failure, job }) {
  if (video && !video.filePath && video.audioFilePath) return MESSAGES.audioOnly;
  if (failure?.diagnosisKey) {
    const diagnosis = job?.data?.diagnoses?.find((entry) => entry.key === failure.diagnosisKey);
    if (diagnosis?.title) return diagnosis.title;
  }
  if (failure?.error) return String(failure.error).slice(0, MAX_FAIL_MESSAGE_LENGTH);
  if (job && STOPPED_JOB_STATUSES.has(job.status)) return MESSAGES.stopped;
  return MESSAGES.noFile;
}

// The job never got to try the video: it does not exist (the process died
// while queueing it), or a restart terminated it before the video failed.
function wasInterrupted({ job, failure }) {
  if (!job) return true;
  return job.status === 'Terminated' && !failure && RESTART_OUTPUT_PATTERN.test(job.output || '');
}

/**
 * @param {Object} deps
 * @param {Object} deps.models - { ArrBridgeGrab, Video, Job }
 * @param {Function} deps.downloader - downloadModule.doSpecificDownloads(jobData, false, { jobId })
 *   as (jobData, { jobId }); resolves to the job id, or to something else when the video is busy
 * @param {Function} deps.needsRedownload - (youtubeId) => Promise<boolean>; the archive would skip it
 * @param {Function} deps.jobLookup - (jobId) => the in-memory job, or null
 * @param {Object} deps.storageGuard - { isPausedError }
 * @param {Object} deps.staging
 * @param {Function} deps.getSettings - () => arrBridgeConfig.readSettings(config)
 * @param {Function} [deps.fileState] - (path) => Promise<'present'|'missing'|'unknown'>
 * @param {Function} [deps.newId] - Makes the id of each download job
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 * @param {number} [deps.sweepIntervalMs]
 * @param {Function} [deps.scheduleWake] - How a wake defers its sweep
 */
function createGrabExecutor({
  models, downloader, needsRedownload, jobLookup, storageGuard, staging, getSettings,
  fileState = statFileState, newId = crypto.randomUUID, now = () => new Date(), logger,
  sweepIntervalMs = SWEEP_INTERVAL_MS, scheduleWake = setImmediate,
}) {
  const { ArrBridgeGrab, Video, Job } = models;
  // Work on one grab runs in sequence: the sweep and the job-ended event can
  // both reach a row, and a sweep must not judge a grab whose download is
  // being queued at that moment.
  const chains = new Map();
  let sweeping = null;
  let sweepAgain = false;
  let wakeScheduled = false;
  let timer = null;

  function exclusive(grabId, work) {
    const previous = chains.get(grabId) || Promise.resolve();
    const next = previous
      .then(work)
      .catch((error) => logger.error({ err: error, grabId }, 'Sonarr/Radarr grab could not be processed'));
    chains.set(grabId, next);
    next.then(() => {
      if (chains.get(grabId) === next) chains.delete(grabId);
    });
    return next;
  }

  // Every write names the status it expects, so a grab the client removed in
  // the meantime is never revived.
  async function transition(grab, fromStatus, values) {
    const [updated] = await ArrBridgeGrab.update(
      { ...values, updated_at: now() },
      { where: { id: grab.id, status: fromStatus } }
    );
    return updated === 1;
  }

  const fail = (grab, fromStatus, message) => transition(grab, fromStatus, {
    status: 'failed', fail_message: message, completed_at: now(),
  });

  // Back to the sweep, which starts over: stage the file if it is there by
  // then, otherwise queue a new download.
  const requeue = (grab) => transition(grab, 'queued', { status: 'pending', job_id: null });

  async function findVideo(youtubeId) {
    return Video.findOne({
      where: { youtubeId, removed: false },
      attributes: ['youtubeId', 'filePath', 'audioFilePath'],
    });
  }

  const videoFileState = async (video) => (video?.filePath ? fileState(video.filePath) : 'missing');

  async function removeStaged(grab) {
    try {
      await staging.remove({ category: grab.category, releaseTitle: grab.release_title });
    } catch (error) {
      logger.warn({ err: error, grabId: grab.id }, 'Could not remove a staged Sonarr/Radarr folder');
    }
  }

  async function stageAndComplete(grab, fromStatus, sourcePath) {
    let staged;
    try {
      staged = await staging.stage({
        category: grab.category, releaseTitle: grab.release_title, sourcePath,
      });
    } catch (error) {
      logger.warn({ err: error, grabId: grab.id }, 'Could not stage a file for Sonarr/Radarr');
      return fail(grab, fromStatus, MESSAGES.stagingFailed);
    }
    const completed = await transition(grab, fromStatus, {
      status: 'completed', staged_path: staged.stagedPath, bytes: staged.bytes, completed_at: now(),
    });
    if (completed) {
      logger.info({ grabId: grab.id, youtubeId: grab.youtube_id, method: staged.method }, 'Sonarr/Radarr grab staged');
      return true;
    }
    // Removed while the file was being staged: nobody will collect it.
    const current = await ArrBridgeGrab.findByPk(grab.id);
    if (!current || current.status === 'removed') await removeStaged(grab);
    return false;
  }

  async function executePending(grabId) {
    const grab = await ArrBridgeGrab.findByPk(grabId);
    if (!grab || grab.status !== 'pending') return;

    const video = await findVideo(grab.youtube_id);
    const state = await videoFileState(video);
    if (state === 'unknown') return;
    if (state === 'present') {
      await stageAndComplete(grab, 'pending', video.filePath);
      return;
    }

    const category = getSettings().categories.find((entry) => entry.name === grab.category);
    const overrideSettings = {};
    if (category?.subfolder) overrideSettings.subfolder = category.subfolder;
    if (await needsRedownload(grab.youtube_id)) overrideSettings.allowRedownload = true;

    // A new job id per attempt, recorded with the claim: a grab queued again
    // after a restart cannot reuse the id of its terminated job.
    const jobId = newId();
    if (!(await transition(grab, 'pending', { status: 'queued', job_id: jobId }))) return;
    let admitted;
    try {
      admitted = await downloader({
        urls: [`https://www.youtube.com/watch?v=${grab.youtube_id}`],
        jobLabel: ARR_BRIDGE_JOB_LABEL,
        overrideSettings,
      }, { jobId });
    } catch (error) {
      if (storageGuard.isPausedError(error)) {
        await requeue(grab);
        return;
      }
      logger.warn({ err: error, grabId: grab.id }, 'Sonarr/Radarr grab could not be queued');
      await fail(grab, 'queued', MESSAGES.queueFailed);
      return;
    }
    // Another job is downloading this video; the sweep tries again.
    if (typeof admitted !== 'string') await requeue(grab);
  }

  async function loadJob(jobId) {
    const live = jobLookup(jobId);
    if (live) return live;
    const stored = await Job.findByPk(jobId, { attributes: ['id', 'status', 'output', 'aux_data'] });
    return stored ? { status: stored.status, output: stored.output, data: parseAuxData(stored.aux_data) } : null;
  }

  // Follows a failed video's hand-offs to its automatic retry jobs. A job
  // that no longer exists counts as ended.
  async function followJob(grab, endedJobIds) {
    let jobId = grab.job_id;
    let job = null;
    let failure = null;
    let ended = false;
    const visited = new Set();
    for (let hop = 0; hop <= MAX_AUTO_RETRY_COUNT; hop += 1) {
      if (visited.has(jobId)) { ended = true; break; }
      visited.add(jobId);
      job = await loadJob(jobId);
      ended = !job || endedJobIds.has(jobId) || FINAL_JOB_STATUSES.has(job.status);
      if (!ended) break;
      failure = job?.data?.failedVideos?.find((entry) => entry.youtubeId === grab.youtube_id) || null;
      if (!failure?.autoRetryQueued || typeof failure.autoRetryJobId !== 'string') break;
      jobId = failure.autoRetryJobId;
    }
    return { jobId, job, failure, ended };
  }

  async function resolveQueued(grabId, endedJobIds) {
    const grab = await ArrBridgeGrab.findByPk(grabId);
    if (!grab || grab.status !== 'queued') return;
    if (!grab.job_id) {
      await requeue(grab);
      return;
    }

    const video = await findVideo(grab.youtube_id);
    if ((await videoFileState(video)) === 'present') {
      await stageAndComplete(grab, 'queued', video.filePath);
      return;
    }
    const { jobId, job, failure, ended } = await followJob(grab, endedJobIds);
    if (!ended) {
      if (jobId !== grab.job_id) await transition(grab, 'queued', { job_id: jobId });
      return;
    }
    // The job can save its video and end between the first look and now.
    const finalVideo = await findVideo(grab.youtube_id);
    const finalState = await videoFileState(finalVideo);
    // Failing a grab is costly (the app blocklists the release and the video
    // is not offered again for days), so an unreadable disk waits instead.
    if (finalState === 'unknown') return;
    if (finalState === 'present') {
      await stageAndComplete(grab, 'queued', finalVideo.filePath);
      return;
    }
    if (wasInterrupted({ job, failure })) {
      if (await requeue(grab)) {
        logger.info({ grabId: grab.id, youtubeId: grab.youtube_id }, 'Sonarr/Radarr grab queued again after an interrupted download');
      }
      return;
    }
    const message = failMessage({ video: finalVideo, failure, job });
    if (await fail(grab, 'queued', message)) {
      logger.info({ grabId: grab.id, youtubeId: grab.youtube_id, message }, 'Sonarr/Radarr grab failed');
    }
  }

  async function removeExpired() {
    const cutoff = new Date(now().getTime() - getSettings().retentionDays * DAY_MS);
    const expired = await ArrBridgeGrab.findAll({
      where: { status: 'completed', completed_at: { [Op.lt]: cutoff } },
      limit: SWEEP_BATCH_SIZE,
    });
    for (const grab of expired) {
      if (await transition(grab, 'completed', { status: 'removed', removed_at: now() })) {
        await removeStaged(grab);
      }
    }
  }

  async function runSweep() {
    try {
      await staging.ensureCategoryFolders();
    } catch (error) {
      logger.warn({ err: error }, 'Could not create the Sonarr/Radarr staging folders');
    }
    const queued = await ArrBridgeGrab.findAll({ where: { status: 'queued' }, limit: RESOLVE_BATCH_SIZE });
    queued.forEach((grab) => exclusive(grab.id, () => resolveQueued(grab.id, NO_ENDED_JOBS)));
    const pending = await ArrBridgeGrab.findAll({
      where: { status: 'pending' },
      // A held grab goes to the back so one busy video cannot starve the rest.
      order: [['updated_at', 'ASC'], ['id', 'ASC']],
      limit: SWEEP_BATCH_SIZE,
    });
    pending.forEach((grab) => exclusive(grab.id, () => executePending(grab.id)));
    await removeExpired();
  }

  /** Start one sweep, or queue another behind the one already running. */
  function sweep() {
    if (sweeping) {
      sweepAgain = true;
      return sweeping;
    }
    sweeping = runSweep()
      .catch((error) => logger.error({ err: error }, 'Sonarr/Radarr grab sweep failed'))
      .finally(() => {
        sweeping = null;
        if (sweepAgain) {
          sweepAgain = false;
          sweep();
        }
      });
    return sweeping;
  }

  /** Called after a grab is added, so it runs without waiting for the timer. */
  function wake() {
    if (wakeScheduled) return;
    wakeScheduled = true;
    scheduleWake(() => {
      wakeScheduled = false;
      sweep();
    });
  }

  /** jobModule.onJobEnded listener: close the grab a finished job served. */
  async function handleJobEnded({ jobId } = {}) {
    // Every download job ends through here; only grabs need a query.
    const jobType = jobLookup(jobId)?.jobType;
    if (jobType !== ARR_BRIDGE_JOB_LABEL && !jobType?.startsWith(AUTO_RETRY_LABEL_PREFIX)) return;
    try {
      const grabs = await ArrBridgeGrab.findAll({ where: { status: 'queued', job_id: jobId } });
      const ended = new Set([jobId]);
      await Promise.all(grabs.map((grab) => exclusive(grab.id, () => resolveQueued(grab.id, ended))));
    } catch (error) {
      logger.error({ err: error, jobId }, 'Sonarr/Radarr grab could not be closed after its job ended');
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(sweep, sweepIntervalMs);
    timer.unref?.();
    sweep();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  /** Run one sweep and wait for the work it started (tests and shutdown). */
  async function runOnce() {
    await sweep();
    while (sweeping || chains.size > 0) {
      await Promise.all([sweeping, ...chains.values()]);
    }
  }

  return { start, stop, wake, handleJobEnded, runOnce };
}

module.exports = { createGrabExecutor, SWEEP_INTERVAL_MS };
