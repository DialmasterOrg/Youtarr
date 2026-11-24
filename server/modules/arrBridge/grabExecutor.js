// Runs grabs in the background, on the pattern of externalRequestExecutor:
// addfile only stores a row; this picks pending rows up, queues an ordinary
// Youtarr download, and when that job ends stages the file for Sonarr or
// Radarr. It wakes on a new grab, on every finished job, and on a one-minute
// sweep that also recovers what a restart interrupted. Nothing here removes
// a video from Youtarr's library; with "remove after import" on, the sweep
// hands that to libraryCopyRemover. A download YouTube blocked does not fail
// its grab: the grab waits and is tried again (see blockWait).
const crypto = require('crypto');
const fs = require('fs');
const { Op } = require('sequelize');
const { ARR_BRIDGE_JOB_LABEL, AUTO_RETRY_LABEL_PREFIX } = require('../download/jobTypes');
const { MAX_AUTO_RETRY_COUNT } = require('../download/transient403RetryPlanner');
const { parseAuxData } = require('../jobAuxData');
const {
  OUTPUT_DIR_UNAVAILABLE, DOWNLOAD_PROCESS_ERROR, JOB_NOT_STARTED,
} = require('../constants/jobOutputPrefixes');
const { isYoutubeBlock } = require('../download/failureAdvisor');
const { createBlockWait, BLOCK_GIVE_UP_MS } = require('./blockWait');
const { LIBRARY_COPY } = require('./libraryCopyRemover');

const SWEEP_INTERVAL_MS = 60 * 1000;
const SWEEP_BATCH_SIZE = 20;
const RESOLVE_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
// A grab that could not run through no fault of its video (the download job
// errored before trying it, or the file could not be staged) is tried again
// this much later, and only fails once that has gone on this long.
const RETRY_HOLD_MS = 15 * 60 * 1000;
const RETRY_GIVE_UP_MS = DAY_MS;
const MAX_FAIL_MESSAGE_LENGTH = 200;
const FINAL_JOB_STATUSES = new Set(['Complete', 'Complete with Warnings', 'Error', 'Failed', 'Terminated', 'Killed']);
const STOPPED_JOB_STATUSES = new Set(['Terminated', 'Killed']);
const WAITING_GRAB_STATUSES = ['pending', 'queued'];
// jobModule terminates running and pending jobs when the server starts and
// says so in their output. Such a job did not fail: the video was never tried.
const RESTART_OUTPUT_PATTERN = /server restart/i;
const UNTRIED_OUTPUT_PREFIXES = [OUTPUT_DIR_UNAVAILABLE, DOWNLOAD_PROCESS_ERROR, JOB_NOT_STARTED];
// A file is only gone when the filesystem says so; any other error (a
// network share hiccup) is no verdict.
const ABSENT_CODES = new Set(['ENOENT', 'ENOTDIR']);
const NO_ENDED_JOBS = new Set();
// Shown in Sonarr and Radarr as the reason a download failed.
const MESSAGES = {
  queueFailed: 'Youtarr could not queue the download',
  notStarted: 'Youtarr could not start the download',
  stagingFailed: 'Youtarr could not stage the file for import',
  audioOnly: 'Youtarr downloaded audio only for this video, so there is no video file to import',
  stopped: 'The download was stopped in Youtarr',
  noFile: 'The download finished without a video file (members-only, filtered or unavailable)',
  stillBlocked: 'YouTube blocked the download, and it was still blocked after a day of retries',
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

// The job errored before yt-dlp ran: the downloads folder was unreachable
// (downloadExecutor's pre-flight check), the process could not start, or the
// job never left the queue (jobModule.failUnstartedJob). Named by their
// output, so any other Error job counts as having tried the video: a
// finalization error comes after yt-dlp ran, and retrying it downloads again.
function endedBeforeTrying({ job, failure }) {
  const output = job.output || '';
  return job.status === 'Error' && !failure && UNTRIED_OUTPUT_PREFIXES.some((prefix) => output.startsWith(prefix));
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
 * @param {Function} [deps.onHandedOff] - (grab) => Promise; a completed grab's staged file expired
 * @param {Function} [deps.settleLibraryCopies] - () => Promise; libraryCopyRemover.run
 * @param {Function} [deps.getCookieKey] - () => what identifies the cookie file in use, or null
 * @param {Function} [deps.isPaused] - () => downloads are paused by the storage guard
 * @param {Function} [deps.fileState] - (path) => Promise<'present'|'missing'|'unknown'>
 * @param {Function} [deps.newId] - Makes the id of each download job
 * @param {Function} [deps.now]
 * @param {Object} deps.logger
 * @param {number} [deps.sweepIntervalMs]
 * @param {Function} [deps.scheduleWake] - How a wake defers its sweep
 */
function createGrabExecutor({
  models, downloader, needsRedownload, jobLookup, storageGuard, staging, getSettings,
  onHandedOff = async () => {}, settleLibraryCopies = async () => {},
  getCookieKey = () => null, isPaused = () => false,
  fileState = statFileState, newId = crypto.randomUUID, now = () => new Date(), logger,
  sweepIntervalMs = SWEEP_INTERVAL_MS, scheduleWake = setImmediate,
}) {
  const { ArrBridgeGrab, Video, Job } = models;
  // Work on one grab runs in sequence: the sweep and the job-ended event can
  // both reach a row, and a sweep must not judge a grab whose download is
  // being queued at that moment.
  const chains = new Map();
  // Grab id -> { until, since }: grabs the sweep leaves alone for now. Kept
  // in memory only, so a restart tries each of them again at once.
  const holds = new Map();
  const block = createBlockWait({ now, getCookieKey });
  // Grabs whose download is being queued at this moment. While YouTube
  // blocks, a sweep that finds one queues no other.
  const admitting = new Set();
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

  const fail = (grab, fromStatus, message) => {
    holds.delete(grab.id);
    block.release(grab.id);
    return transition(grab, fromStatus, { status: 'failed', fail_message: message, completed_at: now() });
  };

  // Holds a grab back from the sweep. False once it has been held again and
  // again for RETRY_GIVE_UP_MS: the caller fails it then.
  function hold(grabId) {
    const time = now().getTime();
    const since = holds.get(grabId)?.since ?? time;
    if (time - since >= RETRY_GIVE_UP_MS) return false;
    holds.set(grabId, { until: time + RETRY_HOLD_MS, since });
    return true;
  }

  // An entry outlives its hold, so the next one knows when the first began.
  function heldGrabIds() {
    const time = now().getTime();
    const held = [];
    for (const [grabId, { until, since }] of holds) {
      if (until > time) held.push(grabId);
      else if (time - since >= RETRY_GIVE_UP_MS + RETRY_HOLD_MS) holds.delete(grabId);
    }
    return held;
  }

  // Back to the sweep, which starts over: stage the file if it is there by
  // then, otherwise queue a new download.
  // The video stops being the grab's own: until it is queued again, another
  // job may be the one that downloads it.
  const requeue = (grab) => transition(grab, 'queued', { status: 'pending', job_id: null, library_copy: null });
  // The grab's own download put the file there; only staging is left to do.
  // That download got through, so the grab no longer waits out a block.
  const requeueForStaging = (grab) => transition(grab, 'queued', { status: 'pending', job_id: null, blocked_at: null });

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
    // A queued grab's file came from a download that just finished. A file
    // that was already in the library says nothing about YouTube.
    if (fromStatus === 'queued') block.recordSuccess();
    let staged;
    try {
      staged = await staging.stage({
        category: grab.category, releaseTitle: grab.release_title, sourcePath, youtubeId: grab.youtube_id,
      });
    } catch (error) {
      logger.warn({ err: error, grabId: grab.id }, 'Could not stage a file for Sonarr/Radarr');
      // The download itself worked, and a full disk or a permission problem
      // can be fixed: the sweep stages the library file again later.
      if (!hold(grab.id)) return fail(grab, fromStatus, MESSAGES.stagingFailed);
      if (fromStatus === 'queued') await requeueForStaging(grab);
      // The video is here, so this grab must not fail later as blocked for a day.
      else if (grab.blocked_at) await transition(grab, 'pending', { blocked_at: null });
      return false;
    }
    const completed = await transition(grab, fromStatus, {
      status: 'completed', staged_path: staged.stagedPath, bytes: staged.bytes, completed_at: now(),
    });
    if (completed) {
      holds.delete(grab.id);
      block.release(grab.id);
      logger.info(
        { grabId: grab.id, youtubeId: grab.youtube_id, method: staged.method, subtitles: staged.subtitles },
        'Sonarr/Radarr grab staged'
      );
      return true;
    }
    // Removed while the file was being staged: nobody will collect it.
    const current = await ArrBridgeGrab.findByPk(grab.id);
    if (!current || current.status === 'removed') await removeStaged(grab);
    return false;
  }

  /**
   * @param {string} grabId
   * @param {Object} [options]
   * @param {boolean} [options.mayDownload] - False while YouTube blocks: a file already there is still staged
   * @param {boolean} [options.quiet] - A block this download runs into was already notified
   * @param {boolean} [options.force] - The user asked for this try, so no hold applies
   * @returns {Promise<'queued'|'paused'|undefined>} 'queued' when a download was queued, 'paused'
   *   when the storage guard refused it; nothing in every other case
   */
  async function executePending(grabId, { mayDownload = true, quiet = false, force = false } = {}) {
    const grab = await ArrBridgeGrab.findByPk(grabId);
    if (!grab || grab.status !== 'pending') return undefined;
    // Held after the sweep that sent this had already read its rows.
    if (!force && holds.get(grabId)?.until > now().getTime()) return undefined;

    const video = await findVideo(grab.youtube_id);
    const state = await videoFileState(video);
    if (state === 'unknown') return undefined;
    if (state === 'present') {
      await stageAndComplete(grab, 'pending', video.filePath);
      return undefined;
    }
    if (!mayDownload) return undefined;

    const settings = getSettings();
    const category = settings.categories.find((entry) => entry.name === grab.category);
    const overrideSettings = {};
    if (category?.subfolder) overrideSettings.subfolder = category.subfolder;
    if (settings.resolution) overrideSettings.resolution = settings.resolution;
    if (await needsRedownload(grab.youtube_id)) overrideSettings.allowRedownload = true;

    // A new job id per attempt, recorded with the claim: a grab queued again
    // after a restart cannot reuse the id of its terminated job.
    const jobId = newId();
    // Only a video with no library row is downloaded for the grab alone;
    // "remove after import" never touches any other.
    const libraryCopy = video ? null : LIBRARY_COPY.OWNED;
    if (!(await transition(grab, 'pending', { status: 'queued', job_id: jobId, library_copy: libraryCopy }))) {
      return undefined;
    }
    let admitted;
    try {
      admitted = await downloader({
        urls: [`https://www.youtube.com/watch?v=${grab.youtube_id}`],
        jobLabel: ARR_BRIDGE_JOB_LABEL,
        overrideSettings,
        // See downloadJobFinalizer: no second notification for the same block.
        ...(quiet || grab.blocked_at ? { quietBlockedFailure: true } : {}),
      }, { jobId });
    } catch (error) {
      if (storageGuard.isPausedError(error)) {
        await requeue(grab);
        return 'paused';
      }
      logger.warn({ err: error, grabId: grab.id }, 'Sonarr/Radarr grab could not be queued');
      await fail(grab, 'queued', MESSAGES.queueFailed);
      return undefined;
    }
    if (typeof admitted === 'string') return 'queued';
    // Another job is downloading this video; the sweep tries again.
    await requeue(grab);
    return undefined;
  }

  /**
   * The sweep's and the user's way to a pending grab. Resolves to what
   * executePending did; an error there is logged and resolves to nothing.
   * @param {string} grabId
   * @param {Object} [options] - executePending's, and:
   * @param {boolean} [options.dueTry] - This grab was given the one try that is due while YouTube blocks
   */
  function runPending(grabId, { dueTry = false, ...options } = {}) {
    if (!options.mayDownload) return exclusive(grabId, () => executePending(grabId, options));
    admitting.add(grabId);
    return exclusive(grabId, () => executePending(grabId, options))
      .then((outcome) => {
        // A try the user asked for stays asked for only while downloads are
        // paused. One that cannot start for another reason must not keep
        // the other grabs from being tried.
        if (options.force && outcome !== 'queued' && outcome !== 'paused') block.release(grabId);
        if (dueTry) settleDueTry(grabId, outcome);
        return outcome;
      })
      .finally(() => admitting.delete(grabId));
  }

  // The grab that was given the due try took it, or passes it on: the next
  // sweep offers it to another grab, and this one again only after that.
  function settleDueTry(grabId, outcome) {
    if (outcome === 'queued') {
      block.resetPassedTries();
      return;
    }
    block.passTry(grabId);
    wake();
  }

  // Grabs queued before the block was known run into it too. Their jobs
  // cannot be taken back, but they need not each notify.
  async function quietQueuedJobs(exceptGrabId) {
    const others = await ArrBridgeGrab.findAll({ where: { status: 'queued', id: { [Op.ne]: exceptGrabId } } });
    for (const other of others) {
      const job = other.job_id ? jobLookup(other.job_id) : null;
      if (job?.data) job.data.quietBlockedFailure = true;
    }
  }

  // YouTube blocked the download, which often passes on its own, so the grab
  // goes back to waiting instead of failing: a failure gets the release
  // blocklisted and the video hidden for days. It fails once it has been
  // blocked for a day.
  async function waitOutBlock(grab) {
    block.recordBlocked();
    block.release(grab.id);
    const blockedAt = grab.blocked_at ?? now();
    if (block.isExpired({ blocked_at: blockedAt })) {
      if (await fail(grab, 'queued', MESSAGES.stillBlocked)) {
        logger.info({ grabId: grab.id, youtubeId: grab.youtube_id }, 'Sonarr/Radarr grab failed: YouTube blocked it for a day');
      }
      return;
    }
    const waiting = await transition(grab, 'queued', {
      status: 'pending', job_id: null, library_copy: null, blocked_at: blockedAt,
    });
    if (!waiting) return;
    block.setActive(true);
    logger.warn(
      { grabId: grab.id, youtubeId: grab.youtube_id, nextTryAt: block.nextTryAt() },
      'Sonarr/Radarr grab will be tried again: YouTube blocked its download'
    );
    await quietQueuedJobs(grab.id);
  }

  async function expireBlocked(grabId) {
    const grab = await ArrBridgeGrab.findByPk(grabId);
    if (!grab || grab.status !== 'pending' || !block.isExpired(grab)) return;
    // Downloads got through since this grab was last tried, so it has been
    // waiting its turn, not blocked: only its own next try can fail it.
    if (block.gotThroughSince(grab.updated_at)) return;
    if (await fail(grab, 'pending', MESSAGES.stillBlocked)) {
      logger.info({ grabId: grab.id, youtubeId: grab.youtube_id }, 'Sonarr/Radarr grab failed: YouTube blocked it for a day');
    }
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
    if (isYoutubeBlock(failure?.diagnosisKey)) {
      await waitOutBlock(grab);
      return;
    }
    const untried = endedBeforeTrying({ job, failure });
    if (untried && hold(grab.id)) {
      if (await requeue(grab)) {
        logger.warn(
          { grabId: grab.id, youtubeId: grab.youtube_id, jobId },
          'Sonarr/Radarr grab will be tried again: its download job ended before trying the video'
        );
      }
      return;
    }
    const message = untried ? MESSAGES.notStarted : failMessage({ video: finalVideo, failure, job });
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
        await onHandedOff(grab);
      }
    }
  }

  // While YouTube blocks, waiting grabs download one at a time and only
  // when a try is due, so a restart, a lifted block or new cookies never
  // send every waiting grab into the block at once. That lasts until a
  // download gets through, also when the blocked grab has left the queue.
  async function readBlockMode() {
    const blocked = await ArrBridgeGrab.findAll({
      where: { status: { [Op.in]: WAITING_GRAB_STATUSES }, blocked_at: { [Op.ne]: null } },
      limit: 1,
    });
    const blockMode = blocked.length > 0 || block.isSuspected();
    block.setActive(blockMode);
    const due = block.isDue();
    // A block found again is no news while a blocked grab waits, or within
    // the hour of the last one. Found later, with nothing waiting on it, it is.
    return { blockMode, due, quiet: blocked.length > 0 || !due };
  }

  // The grab the due try goes to: one that was never blocked before one
  // that was, so that a video YouTube refuses on its own does not keep the
  // others waiting, and never one that just passed the try on.
  function pickDueTry(pending) {
    const able = pending.filter((grab) => !block.hasPassedTry(grab.id));
    if (able.length === 0) {
      // Every waiting grab passed: start over at the next sweep.
      block.resetPassedTries();
      return null;
    }
    return able.find((grab) => !grab.blocked_at) || able[0];
  }

  // In block mode a grab whose video is in the library by now is still
  // staged, a grab the user asked for is tried, and one other grab gets the
  // try when one is due. Nothing here is awaited: a slow disk must not hold
  // up the sweep.
  function runPendingWhileBlocked(pending, { tryDue, quiet }) {
    const forced = pending.filter((grab) => block.isForced(grab.id));
    forced.forEach((grab) => runPending(grab.id, { mayDownload: true, quiet: true, force: true }));
    // Read again at this point: a "Try again" may have come in while the sweep read its rows.
    const tryOpen = tryDue && forced.length === 0 && admitting.size === 0;
    const dueTry = tryOpen ? pickDueTry(pending) : null;
    for (const grab of pending) {
      if (block.isForced(grab.id)) continue;
      if (grab === dueTry) runPending(grab.id, { mayDownload: true, quiet, dueTry: true });
      else runPending(grab.id, { mayDownload: false });
    }
  }

  async function failExpiredBlocks() {
    const expired = await ArrBridgeGrab.findAll({
      where: { status: 'pending', blocked_at: { [Op.lt]: new Date(now().getTime() - BLOCK_GIVE_UP_MS) } },
      limit: SWEEP_BATCH_SIZE,
    });
    expired.forEach((grab) => exclusive(grab.id, () => expireBlocked(grab.id)));
  }

  async function runSweep() {
    // Read before the rows: an admission that ended since shows in them as queued.
    const admissionBusy = admitting.size > 0;
    try {
      await staging.ensureCategoryFolders();
    } catch (error) {
      logger.warn({ err: error }, 'Could not create the Sonarr/Radarr staging folders');
    }
    const queued = await ArrBridgeGrab.findAll({ where: { status: 'queued' }, limit: RESOLVE_BATCH_SIZE });
    queued.forEach((grab) => exclusive(grab.id, () => resolveQueued(grab.id, NO_ENDED_JOBS)));
    const held = heldGrabIds();
    const pending = await ArrBridgeGrab.findAll({
      where: { status: 'pending', ...(held.length > 0 ? { id: { [Op.notIn]: held } } : {}) },
      // A held grab goes to the back so one busy video cannot starve the rest.
      order: [['updated_at', 'ASC'], ['id', 'ASC']],
      limit: SWEEP_BATCH_SIZE,
    });
    const { blockMode, due, quiet } = await readBlockMode();
    if (blockMode) {
      // A grab only gives up while the block is known to hold: a lifted one
      // lets the waiting grabs through one after another, which takes time.
      if (!due) await failExpiredBlocks();
      const tryDue = due && !admissionBusy && queued.length === 0 && !isPaused();
      runPendingWhileBlocked(pending, { tryDue, quiet });
    } else {
      pending.forEach((grab) => runPending(grab.id, { mayDownload: true, force: block.isForced(grab.id) }));
    }
    await removeExpired();
    try {
      await settleLibraryCopies();
    } catch (error) {
      logger.warn({ err: error }, 'Could not settle the library copies of Sonarr/Radarr grabs');
    }
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
      // A grab waiting its turn behind this one follows without waiting for the timer.
      if (grabs.length > 0 && block.isActive()) wake();
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

  /**
   * The Settings page's "Try again": tries a waiting grab now, whatever the
   * block says. While downloads are paused the request is kept, and a later
   * sweep starts the try; a try that cannot start for another reason (the
   * video is busy, its file cannot be checked) is dropped.
   * @param {string} grabId
   * @returns {Promise<'started'|'queued'|'paused'|'ready'|'deferred'|null>} null when the grab is not waiting
   */
  async function retryNow(grabId) {
    const grab = await ArrBridgeGrab.findByPk(grabId);
    if (!grab || grab.status !== 'pending') return null;
    block.force(grabId);
    const outcome = await runPending(grabId, { mayDownload: true, quiet: true, force: true });
    const after = await ArrBridgeGrab.findByPk(grabId);
    if (after?.status === 'completed') return 'ready';
    if (after?.status === 'queued') return jobLookup(after.job_id)?.status === 'In Progress' ? 'started' : 'queued';
    if (after?.status !== 'pending') return null;
    return outcome === 'paused' ? 'paused' : 'deferred';
  }

  /** @returns {{active: boolean, nextTryAt: Date|null}} Whether YouTube is blocking, as of the last sweep */
  const blockStatus = () => ({ active: block.isActive(), nextTryAt: block.nextTryAt() });

  /** Whether the user's "Try again" on this grab is still to be carried out. */
  const isRetryRequested = (grabId) => block.isForced(grabId);

  return { start, stop, wake, handleJobEnded, runOnce, retryNow, blockStatus, isRetryRequested };
}

module.exports = { createGrabExecutor, SWEEP_INTERVAL_MS };
