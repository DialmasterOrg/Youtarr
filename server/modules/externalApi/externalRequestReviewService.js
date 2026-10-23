const { hasExternalScope } = require('./externalPermissions');
const {
  RequestError, REQUEST_STATUSES, normalizeStoredKey,
  parseInteger, requestPagination, requestPaginationDto, adminDto,
  sanitizeReason,
} = require('./externalRequestPrimitives');

const REQUIRED_SCOPES = {
  video: 'video:request',
  channel: 'channel:request',
  delete_video: 'video:delete',
};
const KEY_ATTRIBUTES = [
  'id', 'name', 'role', 'is_active', 'revoked_at',
  'auto_approve_video_requests', 'auto_approve_channel_requests',
  'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated',
  'allow_video_requests', 'allow_channel_requests', 'allow_delete_video_requests',
  'allowed_media_types',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Administrator review. Approving only records the decision; the request
 * executor does the work in the background, so an approve call never waits
 * on yt-dlp, a download queue, or the filesystem.
 */
function createExternalRequestReviewService({
  models, sequelize, now, quotas, validateTarget, onApproved = () => {},
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
    const requesters = await ApiKey.findAll({
      attributes: ['id', 'name', 'key_prefix', 'role', 'is_active', 'revoked_at'],
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return {
      data: await adminDtos(result.rows),
      pagination: requestPaginationDto(page, pageSize, result.count),
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
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const record = await ExternalRequest.findOne({
      where: { id },
      include: adminIncludes(),
    });
    if (!record) throw new RequestError('Request not found', 404);
    return (await adminDtos([record]))[0];
  }

  function validateReviewInput(record, action, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    if (!['approve', 'reject'].includes(action)) {
      throw new RequestError('Unsupported review action');
    }
    const allowedFields = action === 'reject'
      ? ['reason']
      : (record.request_type === 'channel' ? ['grantToRequestingKey'] : []);
    if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    if (record.request_type === 'channel' &&
        input.grantToRequestingKey !== undefined &&
        typeof input.grantToRequestingKey !== 'boolean') {
      throw new RequestError('grantToRequestingKey must be a boolean');
    }
    return action === 'reject' ? sanitizeReason(input.reason) : null;
  }

  // Checks that need the current key and catalog, not slow work. Returns the
  // terminal values to record instead of approving, or null to approve.
  async function approvalOutcome(record, transaction) {
    const scope = REQUIRED_SCOPES[record.request_type];
    const storedKey = await ApiKey.findByPk(record.api_key_id, {
      attributes: KEY_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const key = normalizeStoredKey(storedKey);
    if (!key || key.isActive !== true || key.revokedAt || !hasExternalScope(key, scope)) {
      return { status: 'failed', message: 'Request is no longer eligible' };
    }
    try {
      await quotas.assertExecutionCapacity(record.api_key_id, scope, record.id, transaction);
    } catch (error) {
      if (error.name !== 'QuotaError') throw error;
      return { status: 'failed', message: 'Request exceeds the active job limit' };
    }
    if (record.request_type === 'channel') return null;
    let target;
    try {
      target = await validateTarget(key, record.youtube_id, record.channel_id, transaction);
    } catch (error) {
      if (!(error instanceof RequestError) && error.name !== 'CatalogError') throw error;
      return { status: 'failed', message: 'Request is no longer eligible' };
    }
    if (record.request_type === 'video' && target.downloaded) {
      return { status: 'completed', message: 'Video is already downloaded' };
    }
    if (record.request_type === 'delete_video' && !target.downloaded) {
      return { status: 'completed', message: 'Video is already deleted' };
    }
    return null;
  }

  async function reviewRequest(id, action, input = {}) {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const current = await ExternalRequest.findByPk(id);
    if (!current) throw new RequestError('Request not found', 404);
    const reason = validateReviewInput(current, action, input);
    let approved = false;
    await sequelize.transaction(async (transaction) => {
      // Key before request, the same lock order as request creation.
      await ApiKey.findByPk(current.api_key_id, { transaction, lock: transaction.LOCK.UPDATE });
      const record = await ExternalRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new RequestError('Request not found', 404);
      const decidedAt = now();

      if (action === 'reject') {
        if (record.status !== 'pending') {
          throw new RequestError('Only pending requests can be rejected', 409);
        }
        await record.update({
          status: 'rejected',
          active_dedupe_key: null,
          message: reason,
          decided_at: decidedAt,
          updated_at: decidedAt,
        }, { transaction });
        return;
      }

      // Repeating an approval is a no-op, but it may not change the decision.
      if (['approved', 'processing'].includes(record.status)) {
        if (record.request_type === 'channel' && input.grantToRequestingKey !== undefined &&
            input.grantToRequestingKey !== (record.grant_to_requesting_key !== false)) {
          throw new RequestError('The original grant decision cannot be changed', 409);
        }
        return;
      }
      if (record.status !== 'pending') {
        throw new RequestError('Only pending requests can be approved', 409);
      }

      const outcome = await approvalOutcome(record, transaction);
      if (outcome) {
        await record.update({
          ...outcome,
          active_dedupe_key: null,
          decided_at: decidedAt,
          ...(outcome.status === 'completed' ? { completed_at: decidedAt } : {}),
          updated_at: decidedAt,
        }, { transaction });
        return;
      }
      await record.update({
        status: 'approved',
        approval_source: 'admin',
        ...(record.request_type === 'channel'
          ? { grant_to_requesting_key: input.grantToRequestingKey !== false }
          : {}),
        decided_at: decidedAt,
        updated_at: decidedAt,
      }, { transaction });
      approved = true;
    });
    if (approved) onApproved();
    return getAdminRequest(id);
  }

  return { listAdminRequests, getAdminRequest, reviewRequest };
}

module.exports = { createExternalRequestReviewService };
