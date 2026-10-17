const { Op } = require('sequelize');
const { MANUAL_DOWNLOAD_LABEL } = require('./download/jobTypes');
const {
  AUXILIARY_RECOVERY_DELAY_MS, requireCurrentAutoApproval, rethrowWorkLimit,
} = require('./externalRequestPrimitives');

function createExternalRequestExecution({
  models, sequelize, now, quotas, workLimiter, executor, channelProvisioner,
  videoDeleter, validateTarget,
}) {
  const { ExternalRequest, ApiKeyChannelGrant, Channel, Job } = models;
  async function claimAuxiliaryRequest(record) {
    const timestamp = now();
    let whereStatus;
    if (['pending', 'approved'].includes(record.status)) {
      whereStatus = record.status;
    } else if (record.status === 'processing') {
      const updatedAt = new Date(record.updated_at).getTime();
      if (!Number.isFinite(updatedAt) ||
          timestamp.getTime() - updatedAt < AUXILIARY_RECOVERY_DELAY_MS) {
        return false;
      }
      whereStatus = 'processing';
    } else {
      return false;
    }
    const [claimed] = await ExternalRequest.update(
      { status: 'processing', updated_at: timestamp },
      { where: { id: record.id, status: whereStatus, updated_at: record.updated_at } }
    );
    if (claimed !== 1) return false;
    record.status = 'processing';
    record.updated_at = timestamp;
    return true;
  }

  async function dispatchAutoApproved(record, key) {
    let accepted = false;
    try {
      await workLimiter.run(() =>
        sequelize.transaction(async (transaction) => {
          const currentKey = await quotas.assertExecutionCapacity(
            key.id,
            'video:request',
            record.id,
            transaction
          );
          const locked = await ExternalRequest.findByPk(record.id, { transaction, lock: transaction.LOCK.UPDATE });
          if (!locked || locked.status !== 'pending' || locked.job_id) return;
          requireCurrentAutoApproval(currentKey, 'video');
          const target = await validateTarget(
            currentKey,
            record.youtube_id,
            record.channel_id,
            transaction
          );
          const existingJob = await Job.findByPk(record.id, { transaction });
          const jobId = existingJob?.id || await executor({
            body: {
              urls: [`https://www.youtube.com/watch?v=${record.youtube_id}`],
              channelId: target.channel.channel_id,
              ownerChannelMap: { [record.youtube_id]: target.channel.channel_id },
              initiatedBy: { type: 'api_key', name: currentKey.name },
              jobLabel: `${MANUAL_DOWNLOAD_LABEL} (external request)`,
              // The downloader uses this UUID as the job identity. A retry after a
              // crash can therefore observe/reuse the accepted job instead of
              // starting the same download twice.
              externalRequestId: record.id,
            },
          });
          if (jobId && typeof jobId !== 'string') throw new Error('Download was not accepted');
          accepted = true;
          await record.update({
            status: 'processing', job_id: jobId || record.id, updated_at: now(),
          }, { transaction });
        })
      );
    } catch (error) {
      // The downloader persists separately. Leave the request retryable if the
      // process loses its database connection after enqueueing the stable job.
      if (accepted) throw error;
      if (error?.name === 'ExternalWorkLimitError') {
        await record.update({ status: 'pending', updated_at: now() });
        rethrowWorkLimit(error);
      }
      const failedAt = now();
      await record.update({
        status: 'failed',
        active_dedupe_key: null,
        message: 'Download could not be queued',
        updated_at: failedAt,
      });
      rethrowWorkLimit(error);
    }
    return record;
  }

  async function provisionChannelRequest(
    record,
    key,
    { grantToRequestingKey, requireAutoApproval = false } = {}
  ) {
    const retryStatus = record.status === 'processing' ? 'approved' : record.status;
    if (!(await claimAuxiliaryRequest(record))) return record;
    const shouldGrant = grantToRequestingKey ??
      (record.grant_to_requesting_key !== false);
    try {
      await workLimiter.run(() => sequelize.transaction(async (transaction) => {
        const currentKey = await quotas.assertExecutionCapacity(
          key.id,
          'channel:request',
          record.id,
          transaction
        );
        if (requireAutoApproval) {
          requireCurrentAutoApproval(currentKey, 'channel');
        }
        const provisioner = channelProvisioner || require('./channel/channelProvisioning');
        const result = await provisioner.getChannelInfo(
          record.channel_url,
          false,
          true,
          {},
          { skipTabDetection: true }
        );
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
        if (!channel || channel.enabled !== true || channel.terminated_at) {
          throw new Error('Provisioned channel is unavailable');
        }
        if (shouldGrant) {
          await ApiKeyChannelGrant.findOrCreate({
            where: { api_key_id: currentKey.id, channel_id: channel.id },
            defaults: { api_key_id: currentKey.id, channel_id: channel.id },
            transaction,
          });
        }
        const completedAt = now();
        await record.update({
          channel_id: channel.id,
          status: 'completed',
          active_dedupe_key: null,
          completed_at: completedAt,
          updated_at: completedAt,
        }, { transaction });
      }));
    } catch (error) {
      if (error?.name === 'ExternalWorkLimitError') {
        await record.update({ status: retryStatus, updated_at: now() });
        rethrowWorkLimit(error);
      }
      const failedAt = now();
      await record.update({
        status: 'failed',
        active_dedupe_key: null,
        message: 'Channel could not be provisioned',
        updated_at: failedAt,
      });
      rethrowWorkLimit(error);
    }
    return record;
  }

  async function executeDeleteRequest(record, { requireAutoApproval = false } = {}) {
    const retryStatus = record.status === 'processing' ? 'approved' : record.status;
    if (!(await claimAuxiliaryRequest(record))) return record;
    try {
      await workLimiter.run(() => sequelize.transaction(async (transaction) => {
        const currentKey = await quotas.assertExecutionCapacity(
          record.api_key_id,
          'video:delete',
          record.id,
          transaction
        );
        if (requireAutoApproval) {
          requireCurrentAutoApproval(currentKey, 'delete_video');
        }
        const target = await validateTarget(
          currentKey,
          record.youtube_id,
          record.channel_id,
          transaction
        );
        const result = target.downloaded
          ? await videoDeleter.deleteVideoById(
            target.downloaded.id,
            { transaction, video: target.downloaded }
          )
          : { success: false, error: 'Video is already removed' };
        const alreadyAbsent = result?.success === false &&
          /not found|already (?:marked as )?removed/i.test(result?.error || '');
        if (result?.success === false && !alreadyAbsent) {
          throw new Error('Deletion failed');
        }
        const completedAt = now();
        await record.update({
          status: 'completed',
          active_dedupe_key: null,
          ...(alreadyAbsent ? { message: 'Video is already deleted' } : {}),
          completed_at: completedAt,
          updated_at: completedAt,
        }, { transaction });
      }));
    } catch (error) {
      if (error?.name === 'ExternalWorkLimitError') {
        await record.update({ status: retryStatus, updated_at: now() });
        rethrowWorkLimit(error);
      }
      const failedAt = now();
      await record.update({
        status: 'failed',
        active_dedupe_key: null,
        message: 'Video could not be deleted',
        updated_at: failedAt,
      });
      rethrowWorkLimit(error);
    }
    return record;
  }

  return { dispatchAutoApproved, provisionChannelRequest, executeDeleteRequest };
}

module.exports = { createExternalRequestExecution };
