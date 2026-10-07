const { Op } = require('sequelize');
const { MANUAL_DOWNLOAD_LABEL } = require('./download/jobTypes');
const { hasExternalScope } = require('./externalPermissions');
const {
  RequestError, REQUEST_STATUSES, ACTIVE_STATUSES, normalizeStoredKey,
  parseInteger, requestPagination, requestPaginationDto, adminDto,
  sanitizeReason, rethrowWorkLimit,
} = require('./externalRequestPrimitives');

function createExternalRequestReviewService({
  models, sequelize, now, quotas, workLimiter, executor, reconcile,
  validateTarget, provisionChannelRequest, executeDeleteRequest,
}) {
  const { ExternalRequest, ApiKey, Channel, ChannelVideo, Video, Job } = models;
  const adminIncludes = () => [
    {
      model: ApiKey,
      as: 'apiKey',
      attributes: [
        'id', 'name', 'key_prefix', 'role', 'is_active', 'revoked_at',
        'auto_approve_video_requests', 'auto_approve_channel_requests',
        'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated',
        'allowed_media_types',
      ],
      required: false,
    },
    {
      model: Channel,
      as: 'channel',
      attributes: [
        'id', 'channel_id', 'title', 'uploader', 'url', 'default_rating', 'terminated_at',
      ],
      required: false,
    },
    {
      model: Job,
      as: 'job',
      attributes: ['id', 'status', 'jobType', 'timeCreated', 'timeInitiated'],
      required: false,
    },
  ];

  async function catalogMetadata(records) {
    const youtubeIds = [...new Set(records.map((record) => record.youtube_id).filter(Boolean))];
    if (youtubeIds.length === 0) return new Map();
    const rows = await ChannelVideo.findAll({
      where: { youtube_id: youtubeIds },
      attributes: ['youtube_id', 'channel_id', 'title', 'media_type'],
    });
    const videos = await Video.findAll({
      where: { youtubeId: youtubeIds },
      attributes: ['youtubeId', 'normalized_rating'],
    });
    const videoById = new Map(videos.map((row) => {
      const value = row.toJSON ? row.toJSON() : row;
      return [value.youtubeId, value];
    }));
    return new Map(rows.map((row) => {
      const value = row.toJSON ? row.toJSON() : row;
      return [`${value.channel_id}:${value.youtube_id}`, value];
    }).map(([key, value]) => [key, {
      ...value,
      content_rating: videoById.get(value.youtube_id)?.normalized_rating || null,
    }]));
  }

  async function adminDtos(records) {
    const metadata = await catalogMetadata(records);
    return records.map((record) => {
      const value = record.toJSON ? record.toJSON() : record;
      const channel = value.channel;
      return adminDto(
        record,
        metadata.get(`${channel?.channel_id || ''}:${value.youtube_id}`) || null
      );
    });
  }

  async function listAdminRequests(query = {}) {
    const { page, pageSize, offset } = requestPagination(query);
    const status = query.status;
    if (status !== undefined && !REQUEST_STATUSES.includes(status)) {
      throw new RequestError(`status must be one of: ${REQUEST_STATUSES.join(', ')}`);
    }
    const apiKeyId = query.apiKeyId === undefined
      ? null
      : parseInteger(query.apiKeyId, null, 1, Number.MAX_SAFE_INTEGER, 'apiKeyId');
    const requestType = query.requestType;
    if (requestType !== undefined && !['video', 'channel', 'delete_video'].includes(requestType)) {
      throw new RequestError('requestType must be video, channel, or delete_video');
    }
    const where = {
      ...(requestType ? { request_type: requestType } : {}),
      ...(status ? { status } : {}),
      ...(apiKeyId ? { api_key_id: apiKeyId } : {}),
    };
    const result = await ExternalRequest.findAndCountAll({
      where,
      include: adminIncludes(),
      distinct: true,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
    });
    await reconcile(result.rows);
    const reconciledResult = status
      ? await ExternalRequest.findAndCountAll({
        where,
        include: adminIncludes(),
        distinct: true,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset,
      })
      : result;
    const requesters = await ApiKey.findAll({
      attributes: ['id', 'name', 'key_prefix', 'role', 'is_active', 'revoked_at'],
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return {
      data: await adminDtos(reconciledResult.rows),
      pagination: requestPaginationDto(page, pageSize, reconciledResult.count),
      filterOptions: {
        requesters: requesters.map((key) => {
          const value = key.toJSON ? key.toJSON() : key;
          return {
            id: value.id,
            name: value.name,
            keyPrefix: value.key_prefix,
            role: value.role,
            isActive: value.is_active === true,
            revokedAt: value.revoked_at || null,
          };
        }),
      },
    };
  }

  async function getAdminRequest(id) {
    if (typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const record = await ExternalRequest.findOne({
      where: { id },
      include: adminIncludes(),
    });
    if (!record) throw new RequestError('Request not found', 404);
    await reconcile([record]);
    return (await adminDtos([record]))[0];
  }

  async function reviewVideoRequest(id, action, input = {}) {
    if (typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    if (!['approve', 'reject'].includes(action)) {
      throw new RequestError('Unsupported review action');
    }
    const allowedFields = action === 'reject' ? ['reason'] : [];
    if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    const reason = action === 'reject' ? sanitizeReason(input.reason) : null;

    const current = await ExternalRequest.findByPk(id);
    if (!current || current.request_type !== 'video') throw new RequestError('Request not found', 404);
    const review = () => sequelize.transaction(async (transaction) => {
      await ApiKey.findByPk(current.api_key_id, { transaction, lock: transaction.LOCK.UPDATE });
      const record = await ExternalRequest.findOne({
        where: { id, request_type: 'video' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new RequestError('Request not found', 404);

      if (action === 'reject') {
        if (record.status !== 'pending') {
          throw new RequestError('Only pending requests can be rejected', 409);
        }
        const rejectedAt = now();
        await record.update({
          status: 'rejected',
          active_dedupe_key: null,
          message: reason,
          decided_at: rejectedAt,
          updated_at: rejectedAt,
        }, { transaction });
        return;
      }

      if (record.status !== 'pending' &&
          !(record.status === 'approved' && !record.job_id)) {
        throw new RequestError('Only pending requests can be approved', 409);
      }

      const failApproval = async (message) => {
        const failedAt = now();
        await record.update({
          status: 'failed',
          active_dedupe_key: null,
          message,
          decided_at: record.decided_at || failedAt,
          updated_at: failedAt,
        }, { transaction });
      };

      const storedKey = await ApiKey.findByPk(record.api_key_id, {
        attributes: [
          'id', 'name', 'role', 'is_active', 'revoked_at',
          'auto_approve_video_requests', 'auto_approve_channel_requests',
          'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated',
          'allow_video_requests', 'allow_channel_requests', 'allow_delete_video_requests',
          'allowed_media_types',
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const key = normalizeStoredKey(storedKey);
      if (!key || key.isActive !== true || key.revokedAt ||
          !hasExternalScope(key, 'video:request')) {
        await failApproval('Request is no longer eligible');
        return;
      }
      try {
        await quotas.assertExecutionCapacity(
          record.api_key_id,
          'video:request',
          record.id,
          transaction
        );
      } catch (error) {
        if (error.name !== 'QuotaError') throw error;
        await failApproval('Request exceeds the active job limit');
        return;
      }

      let target;
      try {
        target = await validateTarget(key, record.youtube_id, record.channel_id, transaction);
      } catch (error) {
        if (!(error instanceof RequestError) && error.name !== 'CatalogError') throw error;
        await failApproval('Request is no longer eligible');
        return;
      }
      if (target.downloaded) {
        const completedAt = now();
        await record.update({
          status: 'completed',
          active_dedupe_key: null,
          message: 'Video is already downloaded',
          decided_at: record.decided_at || completedAt,
          completed_at: completedAt,
          updated_at: completedAt,
        }, { transaction });
        return;
      }

      const duplicate = await ExternalRequest.findOne({
        where: {
          id: { [Op.ne]: record.id },
          active_dedupe_key: `${record.api_key_id}:video:${record.youtube_id}`,
          status: { [Op.in]: ACTIVE_STATUSES },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (duplicate) {
        await failApproval('Another active request already exists');
        return;
      }

      const approvedAt = now();
      if (record.status === 'pending') {
        await record.update({
          status: 'approved',
          decided_at: approvedAt,
          updated_at: approvedAt,
        }, { transaction });
      }
      let accepted = false;
      try {
        const existingJob = await Job.findByPk(record.id, { transaction });
        const jobId = existingJob?.id || await executor({
          body: {
            urls: [`https://www.youtube.com/watch?v=${record.youtube_id}`],
            channelId: target.channel.channel_id,
            ownerChannelMap: { [record.youtube_id]: target.channel.channel_id },
            initiatedBy: { type: 'api_key', name: key.name },
            jobLabel: `${MANUAL_DOWNLOAD_LABEL} (external request)`,
            externalRequestId: record.id,
          },
        });
        if (jobId && typeof jobId !== 'string') throw new Error('Download was not accepted');
        accepted = true;
        const acceptedAt = now();
        await record.update({
          status: 'processing',
          job_id: jobId || record.id,
          updated_at: acceptedAt,
        }, { transaction });
      } catch (error) {
        if (accepted) throw error;
        await failApproval('Download could not be queued');
      }
    });
    try {
      await (action === 'approve' ? workLimiter.run(review) : review());
    } catch (error) {
      rethrowWorkLimit(error);
      throw error;
    }

    return getAdminRequest(id);
  }

  async function reviewRequest(id, action, input = {}) {
    if (typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const current = await ExternalRequest.findByPk(id);
    if (!current) throw new RequestError('Request not found', 404);
    if (current.request_type === 'video') return reviewVideoRequest(id, action, input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    if (!['approve', 'reject'].includes(action)) {
      throw new RequestError('Unsupported review action');
    }
    const allowedFields = action === 'reject'
      ? ['reason']
      : (current.request_type === 'channel' ? ['grantToRequestingKey'] : []);
    if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    if (current.request_type === 'channel' &&
        input.grantToRequestingKey !== undefined &&
        typeof input.grantToRequestingKey !== 'boolean') {
      throw new RequestError('grantToRequestingKey must be a boolean');
    }
    const reason = action === 'reject' ? sanitizeReason(input.reason) : null;
    let key;
    let claimed;
    await sequelize.transaction(async (transaction) => {
      await ApiKey.findByPk(current.api_key_id, { transaction, lock: transaction.LOCK.UPDATE });
      const record = await ExternalRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new RequestError('Request not found', 404);
      const retryingApproval = action === 'approve' && record.status === 'approved';
      if (record.status !== 'pending' && !retryingApproval) {
        throw new RequestError('Only pending requests can be reviewed', 409);
      }
      if (retryingApproval && input.grantToRequestingKey !== undefined &&
          input.grantToRequestingKey !== record.grant_to_requesting_key) {
        throw new RequestError('The original grant decision cannot be changed on retry', 409);
      }
      const decisionAt = now();
      if (action === 'reject') {
        await record.update({
          status: 'rejected',
          active_dedupe_key: null,
          message: reason,
          decided_at: decisionAt,
          updated_at: decisionAt,
        }, { transaction });
        return;
      }
      const storedKey = await ApiKey.findByPk(record.api_key_id, {
        attributes: [
          'id', 'name', 'role', 'is_active', 'revoked_at',
          'auto_approve_video_requests', 'auto_approve_channel_requests',
          'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated',
          'allow_video_requests', 'allow_channel_requests', 'allow_delete_video_requests',
          'allowed_media_types',
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      key = normalizeStoredKey(storedKey);
      const requiredScope = record.request_type === 'delete_video'
        ? 'video:delete'
        : 'channel:request';
      if (!key || key.isActive !== true || key.revokedAt ||
          !hasExternalScope(key, requiredScope)) {
        await record.update({
          status: 'failed',
          active_dedupe_key: null,
          message: 'Request is no longer eligible',
          decided_at: decisionAt,
          updated_at: decisionAt,
        }, { transaction });
        return;
      }
      try {
        await quotas.assertExecutionCapacity(
          record.api_key_id,
          requiredScope,
          record.id,
          transaction
        );
      } catch (error) {
        if (error.name !== 'QuotaError') throw error;
        await record.update({
          status: 'failed',
          active_dedupe_key: null,
          message: 'Request exceeds the active job limit',
          decided_at: decisionAt,
          updated_at: decisionAt,
        }, { transaction });
        return;
      }
      if (record.request_type === 'delete_video') {
        try {
          const target = await validateTarget(
            key,
            record.youtube_id,
            record.channel_id,
            transaction
          );
          if (!target.downloaded) {
            await record.update({
              status: 'completed',
              active_dedupe_key: null,
              message: 'Video is already deleted',
              decided_at: decisionAt,
              completed_at: decisionAt,
              updated_at: decisionAt,
            }, { transaction });
            return;
          }
        } catch (error) {
          if (!(error instanceof RequestError) && error.name !== 'CatalogError') throw error;
          await record.update({
            status: 'failed',
            active_dedupe_key: null,
            message: 'Request is no longer eligible',
            decided_at: decisionAt,
            updated_at: decisionAt,
          }, { transaction });
          return;
        }
      }
      await record.update({
        status: 'approved',
        ...(record.request_type === 'channel' && !retryingApproval
          ? { grant_to_requesting_key: input.grantToRequestingKey !== false }
          : {}),
        decided_at: record.decided_at || decisionAt,
        updated_at: decisionAt,
      }, { transaction });
      claimed = record;
    });
    if (action === 'approve' && claimed) {
      if (claimed.request_type === 'channel') {
        await provisionChannelRequest(claimed, key, {
          grantToRequestingKey: claimed.grant_to_requesting_key !== false,
        });
      } else if (claimed.request_type === 'delete_video') {
        await executeDeleteRequest(claimed);
      }
    }
    return getAdminRequest(id);
  }

  return { listAdminRequests, getAdminRequest, reviewVideoRequest, reviewRequest };
}

module.exports = { createExternalRequestReviewService };
