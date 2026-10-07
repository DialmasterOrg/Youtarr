const crypto = require('crypto');
const { normalizePolicy, isMediaTypeEligible, isRatingEligible } = require('./externalEligibility');
const { hasExternalScope } = require('./externalPermissions');

const {
  RequestError, REQUEST_STATUSES, ACTIVE_STATUSES, VIDEO_ID_PATTERN,
  parseInteger, requestPagination, requestPaginationDto, normalizeIdempotencyKey,
  normalizeChannelUrl, dto, adminDto, sanitizeReason, isUniqueConstraintError,
} = require('./externalRequestPrimitives');
const { createExternalRequestExecution } = require('./externalRequestExecution');
const { createExternalRequestReviewService } = require('./externalRequestReviewService');
const { createExternalRequestReconciliation } = require('./externalRequestReconciliation');

function createExternalRequestService({
  models = require('../models'),
  executor = (jobData) => require('./downloadModule').doGroupedManualDownloads(jobData),
  channelProvisioner = null,
  videoDeleter = require('./videoDeletionModule'),
  now = () => new Date(),
  sequelize = require('../db').sequelize,
  quotaService = null,
  workLimiter = require('./externalWorkLimiter').sharedExternalWorkLimiter,
} = {}) {
  const {
    ExternalRequest, ApiKeyChannelGrant, Channel, ChannelVideo, Video,
  } = models;
  const quotas = quotaService ||
    require('./externalQuotaService').createExternalQuotaService({ models, sequelize, now });
  const reconcile = createExternalRequestReconciliation({ models, now });
  const { dispatchAutoApproved, provisionChannelRequest, executeDeleteRequest } =
    createExternalRequestExecution({
      models, sequelize, now, quotas, workLimiter, executor, channelProvisioner,
      videoDeleter, validateTarget,
    });
  const reviewService = createExternalRequestReviewService({
    models, sequelize, now, quotas, workLimiter, executor, reconcile,
    validateTarget, provisionChannelRequest, executeDeleteRequest,
  });

  async function createReservedRequest(keyId, scope, buildValues) {
    return sequelize.transaction(async (transaction) => {
      const currentKey = await quotas.reserveWrite(keyId, scope, transaction);
      const record = await ExternalRequest.create(
        buildValues(currentKey),
        { transaction }
      );
      return { currentKey, record };
    });
  }

  async function failAuthorityChange(record) {
    const timestamp = now();
    await record.update({
      status: 'failed',
      active_dedupe_key: null,
      message: 'Request is no longer eligible',
      decided_at: record.decided_at || timestamp,
      updated_at: timestamp,
    });
    return record;
  }

  async function validateTarget(
    key,
    youtubeId,
    channelId,
    transaction = null,
    { lockVideo = true } = {}
  ) {
    const policy = normalizePolicy(key);
    const queryOptions = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
    const videoQueryOptions = transaction
      ? { transaction, ...(lockVideo ? { lock: transaction.LOCK.UPDATE } : {}) }
      : {};
    const grant = await ApiKeyChannelGrant.findOne({
      where: { api_key_id: key.id, channel_id: channelId },
      ...queryOptions,
    });
    const channel = await Channel.findByPk(channelId, {
      attributes: ['id', 'channel_id', 'enabled', 'terminated_at', 'default_rating'],
      ...queryOptions,
    });
    if (!grant || !channel || channel.enabled !== true || channel.terminated_at || !channel.channel_id) {
      throw new RequestError('Video not found', 404);
    }
    const cached = await ChannelVideo.findOne({
      where: { youtube_id: youtubeId, channel_id: channel.channel_id },
      attributes: ['youtube_id', 'media_type', 'youtube_removed', 'ignored'],
      ...queryOptions,
    });
    if (!cached || cached.youtube_removed !== false || cached.ignored !== false) {
      throw new RequestError('Video not found', 404);
    }
    if (!isMediaTypeEligible(policy, cached.media_type)) {
      throw new RequestError('Video not found', 404);
    }
    const storedVideo = await Video.findOne({
      where: { youtubeId },
      // Deletion execution reuses this locked instance in the deleter, so it
      // needs the complete row (including id/filePath). Read-only validation
      // keeps the narrower projection.
      ...(!(transaction && lockVideo)
        ? { attributes: ['youtubeId', 'normalized_rating', 'removed'] }
        : {}),
      ...videoQueryOptions,
    });
    if (storedVideo && storedVideo.removed !== true && storedVideo.removed !== false) {
      throw new RequestError('Video not found', 404);
    }
    const downloaded = storedVideo?.removed === false ? storedVideo : null;
    if (!isRatingEligible(policy, storedVideo?.normalized_rating, channel.default_rating)) {
      throw new RequestError('Video not found', 404);
    }
    return { channel, downloaded };
  }

  async function findDuplicate(keyId, activeDedupeKey, idempotencyHash, youtubeId, channelId) {
    const existing = await findExisting(keyId, activeDedupeKey, idempotencyHash);
    if (!existing) return null;
    if (existing.request_type !== 'video' || existing.youtube_id !== youtubeId || existing.channel_id !== channelId) {
      throw new RequestError('Idempotency key was already used for another target', 409);
    }
    await reconcile([existing]);
    return existing;
  }

  async function findExisting(keyId, activeDedupeKey, idempotencyHash) {
    // Resolve the supplied idempotency key first: a different active request
    // must not hide an earlier use of that key for another operation.
    return (idempotencyHash && await ExternalRequest.findOne({
      where: { api_key_id: keyId, idempotency_hash: idempotencyHash },
    })) || ExternalRequest.findOne({ where: { active_dedupe_key: activeDedupeKey } });
  }

  async function findTypedDuplicate({
    keyId, activeDedupeKey, idempotencyHash, requestType, youtubeId = null,
    channelId = null, channelUrl = null,
  }) {
    const existing = await findExisting(keyId, activeDedupeKey, idempotencyHash);
    if (!existing) return null;
    if (existing.request_type !== requestType ||
        existing.youtube_id !== youtubeId ||
        (requestType !== 'channel' && existing.channel_id !== channelId) ||
        existing.channel_url !== channelUrl) {
      throw new RequestError('Idempotency key was already used for another target', 409);
    }
    return existing;
  }

  async function createVideoRequest(key, input) {
    if (!hasExternalScope(key, 'video:request')) {
      throw new RequestError('video:request scope is required', 403);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    const supported = ['youtubeId', 'channelId', 'idempotencyKey'];
    if (Object.keys(input).some((name) => !supported.includes(name))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    if (typeof input.youtubeId !== 'string' || !VIDEO_ID_PATTERN.test(input.youtubeId)) {
      throw new RequestError('youtubeId must be an 11-character YouTube video ID');
    }
    if (input.channelId === undefined) throw new RequestError('channelId is required');
    const channelId = parseInteger(input.channelId, null, 1, Number.MAX_SAFE_INTEGER, 'channelId');
    const idempotencyHash = normalizeIdempotencyKey(input.idempotencyKey);
    const activeDedupeKey = `${key.id}:video:${input.youtubeId}`;
    const existing = await findDuplicate(
      key.id, activeDedupeKey, idempotencyHash, input.youtubeId, channelId
    );
    if (existing) {
      // Auto-approved requests are created as pending before enqueue. If the
      // process stopped in that boundary, an idempotent client retry resumes
      // dispatch with the request UUID as the stable downloader job ID.
      if (existing.status === 'pending' && existing.decided_at && !existing.job_id) {
        try {
          const currentKey = await quotas.assertExecutionCapacity(
            key.id, 'video:request', existing.id
          );
          const currentTarget = await validateTarget(
            currentKey,
            input.youtubeId,
            channelId
          );
          await dispatchAutoApproved(existing, currentKey, currentTarget.channel);
        } catch (error) {
          if (![403, 404].includes(error?.status)) throw error;
          await failAuthorityChange(existing);
        }
      }
      return { outcome: 'duplicate', request: dto(existing) };
    }

    const { downloaded } = await validateTarget(key, input.youtubeId, channelId);
    if (downloaded) return { outcome: 'already_downloaded', request: null };
    const timestamp = now();
    let currentKey;
    let record;
    try {
      ({ currentKey, record } = await createReservedRequest(
        key.id,
        'video:request',
        (reservedKey) => ({
          api_key_id: key.id,
          channel_id: channelId,
          youtube_id: input.youtubeId,
          request_type: 'video',
          status: 'pending',
          active_dedupe_key: activeDedupeKey,
          idempotency_hash: idempotencyHash,
          decided_at: reservedKey.autoApproveVideoRequests ? timestamp : null,
          created_at: timestamp,
          updated_at: timestamp,
        })
      ));
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const duplicate = await findDuplicate(
        key.id, activeDedupeKey, idempotencyHash, input.youtubeId, channelId
      );
      if (!duplicate) throw error;
      return { outcome: 'duplicate', request: dto(duplicate) };
    }

    if (currentKey.autoApproveVideoRequests) {
      try {
        const finalKey = await quotas.assertExecutionCapacity(
          key.id, 'video:request', record.id
        );
        const finalTarget = await validateTarget(finalKey, input.youtubeId, channelId);
        await dispatchAutoApproved(record, finalKey, finalTarget.channel);
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error;
        await failAuthorityChange(record);
      }
    }
    return { outcome: 'created', request: dto(record) };
  }

  async function createChannelRequest(key, input) {
    if (!hasExternalScope(key, 'channel:request')) {
      throw new RequestError('channel:request scope is required', 403);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    if (Object.keys(input).some((name) => !['channelUrl', 'idempotencyKey'].includes(name))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    const channelUrl = normalizeChannelUrl(input.channelUrl);
    const idempotencyHash = normalizeIdempotencyKey(input.idempotencyKey);
    const targetHash = crypto.createHash('sha256').update(channelUrl).digest('hex').slice(0, 32);
    const activeDedupeKey = `${key.id}:channel:${targetHash}`;
    const existing = await findTypedDuplicate({
      keyId: key.id,
      activeDedupeKey,
      idempotencyHash,
      requestType: 'channel',
      channelUrl,
    });
    if (existing) {
      if (existing.decided_at &&
          ['pending', 'approved', 'processing'].includes(existing.status)) {
        try {
          const currentKey = await quotas.assertExecutionCapacity(
            key.id, 'channel:request', existing.id
          );
          await provisionChannelRequest(existing, currentKey, {
            requireAutoApproval: existing.status === 'pending',
          });
        } catch (error) {
          if (![403, 404].includes(error?.status)) throw error;
          await failAuthorityChange(existing);
        }
      }
      return { outcome: 'duplicate', request: dto(existing) };
    }
    const timestamp = now();
    let currentKey;
    let record;
    try {
      ({ currentKey, record } = await createReservedRequest(
        key.id,
        'channel:request',
        (reservedKey) => ({
          api_key_id: key.id,
          channel_id: null,
          youtube_id: null,
          channel_url: channelUrl,
          request_type: 'channel',
          status: 'pending',
          grant_to_requesting_key: true,
          active_dedupe_key: activeDedupeKey,
          idempotency_hash: idempotencyHash,
          decided_at: reservedKey.autoApproveChannelRequests ? timestamp : null,
          created_at: timestamp,
          updated_at: timestamp,
        })
      ));
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const duplicate = await findTypedDuplicate({
        keyId: key.id,
        activeDedupeKey,
        idempotencyHash,
        requestType: 'channel',
        channelUrl,
      });
      if (!duplicate) throw error;
      return { outcome: 'duplicate', request: dto(duplicate) };
    }
    if (currentKey.autoApproveChannelRequests) {
      try {
        const finalKey = await quotas.assertExecutionCapacity(
          key.id, 'channel:request', record.id
        );
        await provisionChannelRequest(record, finalKey, { requireAutoApproval: true });
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error;
        await failAuthorityChange(record);
      }
    }
    return { outcome: 'created', request: dto(record) };
  }

  async function createDeleteVideoRequest(key, input) {
    if (!hasExternalScope(key, 'video:delete')) {
      throw new RequestError('video:delete scope is required', 403);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RequestError('Request body must be an object');
    }
    const supported = ['youtubeId', 'channelId', 'idempotencyKey'];
    if (Object.keys(input).some((name) => !supported.includes(name))) {
      throw new RequestError('Request body contains unsupported fields');
    }
    if (typeof input.youtubeId !== 'string' || !VIDEO_ID_PATTERN.test(input.youtubeId)) {
      throw new RequestError('youtubeId must be an 11-character YouTube video ID');
    }
    const channelId = parseInteger(
      input.channelId,
      null,
      1,
      Number.MAX_SAFE_INTEGER,
      'channelId'
    );
    const idempotencyHash = normalizeIdempotencyKey(input.idempotencyKey);
    const activeDedupeKey = `${key.id}:delete_video:${input.youtubeId}`;
    const existing = await findTypedDuplicate({
      keyId: key.id,
      activeDedupeKey,
      idempotencyHash,
      requestType: 'delete_video',
      youtubeId: input.youtubeId,
      channelId,
    });
    if (existing) {
      if (existing.decided_at &&
          ['pending', 'approved', 'processing'].includes(existing.status)) {
        try {
          const currentKey = await quotas.assertExecutionCapacity(
            key.id, 'video:delete', existing.id
          );
          await validateTarget(currentKey, input.youtubeId, channelId);
          await executeDeleteRequest(existing, {
            requireAutoApproval: existing.status === 'pending',
          });
        } catch (error) {
          if (![403, 404].includes(error?.status)) throw error;
          await failAuthorityChange(existing);
        }
      }
      return { outcome: 'duplicate', request: dto(existing) };
    }
    const target = await validateTarget(key, input.youtubeId, channelId);
    if (!target.downloaded) throw new RequestError('Video not found', 404);
    const timestamp = now();
    let currentKey;
    let record;
    try {
      ({ currentKey, record } = await createReservedRequest(
        key.id,
        'video:delete',
        (reservedKey) => ({
          api_key_id: key.id,
          channel_id: channelId,
          youtube_id: input.youtubeId,
          request_type: 'delete_video',
          status: 'pending',
          active_dedupe_key: activeDedupeKey,
          idempotency_hash: idempotencyHash,
          message: null,
          decided_at: reservedKey.autoApproveDeleteRequests ? timestamp : null,
          completed_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        })
      ));
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const duplicate = await findTypedDuplicate({
        keyId: key.id,
        activeDedupeKey,
        idempotencyHash,
        requestType: 'delete_video',
        youtubeId: input.youtubeId,
        channelId,
      });
      if (!duplicate) throw error;
      return { outcome: 'duplicate', request: dto(duplicate) };
    }
    if (currentKey.autoApproveDeleteRequests) {
      try {
        const finalKey = await quotas.assertExecutionCapacity(
          key.id, 'video:delete', record.id
        );
        await validateTarget(finalKey, input.youtubeId, channelId);
        await executeDeleteRequest(record, { requireAutoApproval: true });
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error;
        await failAuthorityChange(record);
      }
    }
    return { outcome: 'created', request: dto(record) };
  }

  async function listRequests(key, query = {}) {
    const { page, pageSize, offset } = requestPagination(query);
    const status = query.status;
    if (status !== undefined && !REQUEST_STATUSES.includes(status)) {
      throw new RequestError(`status must be one of: ${REQUEST_STATUSES.join(', ')}`);
    }
    const where = { api_key_id: key.id, ...(status ? { status } : {}) };
    const result = await ExternalRequest.findAndCountAll({
      where,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
    });
    await reconcile(result.rows);
    const reconciledResult = status
      ? await ExternalRequest.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset,
      })
      : result;
    return {
      data: reconciledResult.rows.map(dto),
      pagination: requestPaginationDto(page, pageSize, reconciledResult.count),
    };
  }

  async function getRequest(key, id) {
    if (typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const record = await ExternalRequest.findOne({ where: { id, api_key_id: key.id } });
    if (!record) throw new RequestError('Request not found', 404);
    await reconcile([record]);
    return dto(record);
  }

  return {
    createVideoRequest,
    createChannelRequest,
    createDeleteVideoRequest,
    listRequests,
    getRequest,
    ...reviewService,
  };
}

module.exports = {
  createExternalRequestService,
  RequestError,
  REQUEST_STATUSES,
  ACTIVE_STATUSES,
  dto,
  adminDto,
  sanitizeReason,
};
