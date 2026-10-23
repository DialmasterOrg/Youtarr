const { Op } = require('sequelize');
const { MANUAL_DOWNLOAD_LABEL } = require('../download/jobTypes');
const { requireCurrentAutoApproval } = require('./externalRequestPrimitives');
const { createExternalRequestReconciliation } = require('./externalRequestReconciliation');

const EXTERNAL_REQUEST_JOB_LABEL = `${MANUAL_DOWNLOAD_LABEL} (external request)`;
// The sweep is the fallback that retries held requests, recovers work a
// restart interrupted, and closes downloads whose job-ended event was missed.
const SWEEP_INTERVAL_MS = 60 * 1000;
const SWEEP_BATCH_SIZE = 20;
// A processing row this process is not running is only presumed interrupted
// once it is this old, in case another process claimed it moments ago.
const INTERRUPTED_RECOVERY_DELAY_MS = 5 * 60 * 1000;
const REQUEST_TYPES = ['video', 'channel', 'delete_video'];
const REQUIRED_SCOPES = {
  video: 'video:request',
  channel: 'channel:request',
  delete_video: 'video:delete',
};
const MESSAGES = {
  ineligible: 'Request is no longer eligible',
  downloadsPaused: 'Waiting for downloads to resume',
  videoBusy: 'Waiting for another download of this video to finish',
  queueFailed: 'Download could not be queued',
  alreadyDownloaded: 'Video is already downloaded',
  alreadyDeleted: 'Video is already deleted',
  channelUnavailable: 'Channel is unavailable',
  channelFailed: 'Channel could not be provisioned',
  deleteFailed: 'Video could not be deleted',
};

function isAuthorityError(error) {
  return [401, 403, 404].includes(error?.status);
}

/**
 * Runs approved external requests in the background. Creating or approving
 * a request only records the decision; this executor picks approved rows up
 * outside any lock, re-checks the key's authority, and does the slow work
 * (queueing a download, provisioning a channel, deleting a video).
 */
function createExternalRequestExecutor({
  models, sequelize, now, quotas, validateTarget, workLimiter, downloader,
  channelProvisioner, videoDeleter, storageGuard, jobLookup = () => null, logger,
  sweepIntervalMs = SWEEP_INTERVAL_MS,
  // How a wake defers its sweep; the database tests pass a no-op so each
  // sweep runs only when the test asks for it.
  scheduleWake = setImmediate,
}) {
  const { ExternalRequest, ApiKeyChannelGrant, Channel, Job } = models;
  const { resolveVideoRequests } = createExternalRequestReconciliation({ models, now, jobLookup });
  const running = new Map();
  let sweeping = null;
  let sweepAgain = false;
  let wakeScheduled = false;
  let timer = null;

  const stamp = () => now();

  async function finish(record, values) {
    const timestamp = stamp();
    await record.update({ ...values, active_dedupe_key: null, updated_at: timestamp });
  }

  const complete = (record, message = null) =>
    finish(record, { status: 'completed', message, completed_at: stamp() });
  const fail = (record, message) => finish(record, { status: 'failed', message });
  // Hand the row back to the sweep, keeping its decision and quota slot.
  const hold = (record, message) =>
    record.update({ status: 'approved', message, updated_at: stamp() });

  async function claim(record) {
    const timestamp = stamp();
    const [claimed] = await ExternalRequest.update(
      { status: 'processing', updated_at: timestamp },
      { where: { id: record.id, status: 'approved' } }
    );
    if (claimed !== 1) return false;
    record.status = 'processing';
    record.updated_at = timestamp;
    return true;
  }

  async function currentKey(record, transaction = null) {
    const key = await quotas.reloadAuthorizedKey(
      record.api_key_id, REQUIRED_SCOPES[record.request_type], transaction
    );
    if (record.approval_source === 'auto') requireCurrentAutoApproval(key, record.request_type);
    return key;
  }

  async function executeVideo(record) {
    const key = await currentKey(record);
    const target = await validateTarget(key, record.youtube_id, record.channel_id);
    if (target.downloaded) return complete(record, MESSAGES.alreadyDownloaded);
    if (!(await claim(record))) return null;
    let jobId;
    try {
      jobId = await downloader({
        urls: [`https://www.youtube.com/watch?v=${record.youtube_id}`],
        channelId: target.channel.channel_id,
        ownerChannelMap: { [record.youtube_id]: target.channel.channel_id },
        initiatedBy: { type: 'api_key', name: key.name },
        jobLabel: EXTERNAL_REQUEST_JOB_LABEL,
      }, { jobId: record.id });
    } catch (error) {
      if (storageGuard.isPausedError(error)) return hold(record, MESSAGES.downloadsPaused);
      logger.warn({ err: error, requestId: record.id }, 'External video request could not be queued');
      return fail(record, MESSAGES.queueFailed);
    }
    if (typeof jobId !== 'string') return hold(record, MESSAGES.videoBusy);
    // The job can end before this write; the job-ended hook matches on the
    // request id, so never overwrite a row it already closed. If the write
    // itself fails, the job is already queued: leave the row processing for
    // recovery to adopt the job rather than failing a running download.
    try {
      await ExternalRequest.update(
        { job_id: jobId, message: null, updated_at: stamp() },
        { where: { id: record.id, status: 'processing' } }
      );
    } catch (error) {
      logger.warn({ err: error, requestId: record.id, jobId }, 'External request job id was not recorded');
    }
    return null;
  }

  async function executeChannel(record) {
    await currentKey(record);
    if (!(await claim(record))) return null;
    // Resolve or create the channel without enabling it, so a terminated or
    // unsubscribed row is never re-enabled for a request that then fails.
    const result = await workLimiter.run(() => channelProvisioner.getChannelInfo(
      record.channel_url, false, false, {}, { skipTabDetection: true }
    ));
    let unavailable = false;
    await sequelize.transaction(async (transaction) => {
      const key = await currentKey(record, transaction);
      const channel = await Channel.findOne({
        where: {
          [Op.or]: [
            { channel_id: result.channel_id || result.id },
            { url: record.channel_url },
          ],
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!channel || channel.terminated_at) {
        unavailable = true;
        return;
      }
      if (channel.enabled !== true) await channel.update({ enabled: true }, { transaction });
      if (record.grant_to_requesting_key !== false) {
        await ApiKeyChannelGrant.findOrCreate({
          where: { api_key_id: key.id, channel_id: channel.id },
          defaults: { api_key_id: key.id, channel_id: channel.id },
          transaction,
        });
      }
      const completedAt = stamp();
      await record.update({
        channel_id: channel.id,
        status: 'completed',
        active_dedupe_key: null,
        message: null,
        completed_at: completedAt,
        updated_at: completedAt,
      }, { transaction });
    });
    if (unavailable) return fail(record, MESSAGES.channelUnavailable);
    return null;
  }

  async function executeDelete(record) {
    const key = await currentKey(record);
    const target = await validateTarget(key, record.youtube_id, record.channel_id);
    if (!target.downloaded) return complete(record, MESSAGES.alreadyDeleted);
    if (!(await claim(record))) return null;
    // deleteVideos also regenerates the channel .m3u, refreshes playlists,
    // and re-evaluates a storage pause, like an in-app deletion.
    const result = await workLimiter.run(() => videoDeleter.deleteVideos([target.downloaded.id]));
    if (result?.deleted?.includes(target.downloaded.id)) return complete(record);
    const reason = result?.failed?.[0]?.error || '';
    if (/not found|already (?:marked as )?removed/i.test(reason)) {
      return complete(record, MESSAGES.alreadyDeleted);
    }
    logger.warn({ requestId: record.id, reason }, 'External delete request failed');
    return fail(record, MESSAGES.deleteFailed);
  }

  const EXECUTORS = { video: executeVideo, channel: executeChannel, delete_video: executeDelete };

  async function execute(record) {
    try {
      await EXECUTORS[record.request_type](record);
    } catch (error) {
      if (error?.name === 'ExternalWorkLimitError') {
        if (record.status === 'processing') await hold(record, null);
        return;
      }
      if (isAuthorityError(error)) {
        await fail(record, MESSAGES.ineligible);
        return;
      }
      logger.warn({ err: error, requestId: record.id }, 'External request execution failed');
      await fail(record, record.request_type === 'channel'
        ? MESSAGES.channelFailed
        : record.request_type === 'delete_video' ? MESSAGES.deleteFailed : MESSAGES.queueFailed);
    }
  }

  function launch(record) {
    if (running.has(record.id)) return;
    const work = execute(record)
      .catch((error) => logger.error({ err: error, requestId: record.id }, 'External request could not be updated'))
      .finally(() => running.delete(record.id));
    running.set(record.id, work);
  }

  async function recoverInterrupted() {
    const cutoff = new Date(stamp().getTime() - INTERRUPTED_RECOVERY_DELAY_MS);
    const stale = await ExternalRequest.findAll({
      where: {
        request_type: { [Op.in]: REQUEST_TYPES },
        status: 'processing',
        updated_at: { [Op.lt]: cutoff },
      },
      limit: SWEEP_BATCH_SIZE,
    });
    for (const record of stale) {
      if (running.has(record.id)) continue;
      if (record.request_type === 'video') {
        if (record.job_id) continue;
        // Interrupted between claiming and recording the job: adopt the job
        // if it was created (its id is the request id), otherwise retry.
        const job = await Job.findByPk(record.id, { attributes: ['id'] });
        if (job) {
          await ExternalRequest.update(
            { job_id: job.id, updated_at: stamp() },
            { where: { id: record.id, status: 'processing', job_id: null } }
          );
          continue;
        }
      }
      // Channel provisioning and deletion are safe to repeat.
      await ExternalRequest.update(
        { status: 'approved', updated_at: stamp() },
        { where: { id: record.id, status: 'processing', updated_at: record.updated_at } }
      );
    }
  }

  async function resolveFinishedDownloads() {
    const processing = await ExternalRequest.findAll({
      where: { request_type: 'video', status: 'processing', job_id: { [Op.ne]: null } },
      limit: SWEEP_BATCH_SIZE * 5,
    });
    await resolveVideoRequests(processing);
  }

  async function runSweep() {
    await recoverInterrupted();
    await resolveFinishedDownloads();
    const approved = await ExternalRequest.findAll({
      where: { request_type: { [Op.in]: REQUEST_TYPES }, status: 'approved' },
      order: [['created_at', 'ASC'], ['id', 'ASC']],
      limit: SWEEP_BATCH_SIZE,
    });
    approved.forEach(launch);
  }

  /** Start one sweep, or queue another behind the one already running. */
  function sweep() {
    if (sweeping) {
      sweepAgain = true;
      return sweeping;
    }
    sweeping = runSweep()
      .catch((error) => logger.error({ err: error }, 'External request sweep failed'))
      .finally(() => {
        sweeping = null;
        if (sweepAgain) {
          sweepAgain = false;
          sweep();
        }
      });
    return sweeping;
  }

  /** Called after a request is approved, so it runs without waiting for the timer. */
  function wake() {
    if (wakeScheduled) return;
    wakeScheduled = true;
    scheduleWake(() => {
      wakeScheduled = false;
      sweep();
    });
  }

  /** jobModule.onJobEnded listener: close the request a finished job served. */
  async function handleJobEnded({ jobId } = {}) {
    // Every download job ends through here; only external ones need a query.
    if (jobLookup(jobId)?.jobType !== EXTERNAL_REQUEST_JOB_LABEL) return;
    try {
      const records = await ExternalRequest.findAll({
        where: {
          request_type: 'video',
          status: 'processing',
          [Op.or]: [{ job_id: jobId }, { id: jobId }],
        },
      });
      await resolveVideoRequests(records, { endedJobIds: [jobId] });
    } catch (error) {
      logger.error({ err: error, jobId }, 'External request could not be closed after its job ended');
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
    while (sweeping || running.size > 0) {
      await Promise.all([sweeping, ...running.values()]);
    }
  }

  return { start, stop, wake, handleJobEnded, runOnce };
}

module.exports = {
  createExternalRequestExecutor,
  EXTERNAL_REQUEST_JOB_LABEL,
  SWEEP_INTERVAL_MS,
};
