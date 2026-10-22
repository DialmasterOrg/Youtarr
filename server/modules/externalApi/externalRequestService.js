const crypto = require('crypto');
const { hasExternalScope } = require('./externalPermissions');

const {
  RequestError, REQUEST_STATUSES, ACTIVE_STATUSES, VIDEO_ID_PATTERN,
  parseInteger, requestPagination, requestPaginationDto, normalizeIdempotencyKey,
  normalizeChannelUrl, dto, adminDto, sanitizeReason, isUniqueConstraintError,
} = require('./externalRequestPrimitives');
const { createTargetValidator } = require('./externalRequestTargets');
const { createExternalRequestExecutor } = require('./externalRequestExecutor');
const { createExternalRequestReviewService } = require('./externalRequestReviewService');

const AUTO_APPROVAL_FIELDS = {
  'video:request': 'autoApproveVideoRequests',
  'channel:request': 'autoApproveChannelRequests',
  'video:delete': 'autoApproveDeleteRequests',
};

function createExternalRequestService({
  models = require('../../models'),
  downloader = (jobData, options) =>
    require('../downloadModule').doSpecificDownloads(jobData, false, options),
  channelProvisioner = require('../channel/channelProvisioning'),
  videoDeleter = require('../videoDeletionModule'),
  storageGuard = require('../storageGuard'),
  jobLookup = (jobId) => require('../jobModule').getJob(jobId),
  logger = require('../../logger'),
  now = () => new Date(),
  sequelize = require('../../db').sequelize,
  quotaService = null,
  workLimiter = require('./externalWorkLimiter').sharedExternalWorkLimiter,
  sweepIntervalMs,
} = {}) {
  const { ExternalRequest } = models;
  const quotas = quotaService ||
    require('./externalQuotaService').createExternalQuotaService({ models, sequelize, now });
  const validateTarget = createTargetValidator({ models });
  const executor = createExternalRequestExecutor({
    models, sequelize, now, quotas, validateTarget, workLimiter, downloader,
    channelProvisioner, videoDeleter, storageGuard, jobLookup, logger, sweepIntervalMs,
  });
  const reviewService = createExternalRequestReviewService({
    models, sequelize, now, quotas, validateTarget, onApproved: executor.wake,
  });

  // Charge the write quota and persist the request in one transaction. A key
  // with auto-approval for this scope records the decision immediately; the
  // executor runs it in the background.
  async function createReservedRequest(scope, values) {
    const result = await sequelize.transaction(async (transaction) => {
      const currentKey = await quotas.reserveWrite(values.api_key_id, scope, transaction);
      const autoApproved = currentKey[AUTO_APPROVAL_FIELDS[scope]] === true;
      const timestamp = now();
      const record = await ExternalRequest.create({
        ...values,
        status: autoApproved ? 'approved' : 'pending',
        approval_source: autoApproved ? 'auto' : null,
        decided_at: autoApproved ? timestamp : null,
        created_at: timestamp,
        updated_at: timestamp,
      }, { transaction });
      return { record, autoApproved };
    });
    if (result.autoApproved) executor.wake();
    return result.record;
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
        (existing.youtube_id ?? null) !== youtubeId ||
        (requestType !== 'channel' && existing.channel_id !== channelId) ||
        (existing.channel_url ?? null) !== channelUrl) {
      throw new RequestError('Idempotency key was already used for another target', 409);
    }
    return existing;
  }

  // Persist a new request, or return the row that won a concurrent create.
  async function createOrFindDuplicate(scope, values, duplicateLookup) {
    try {
      return { outcome: 'created', request: dto(await createReservedRequest(scope, values)) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const duplicate = await findTypedDuplicate(duplicateLookup);
      if (!duplicate) throw error;
      return { outcome: 'duplicate', request: dto(duplicate) };
    }
  }

  function validateMediaInput(input) {
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
    return {
      youtubeId: input.youtubeId,
      channelId: parseInteger(input.channelId, null, 1, Number.MAX_SAFE_INTEGER, 'channelId'),
      idempotencyHash: normalizeIdempotencyKey(input.idempotencyKey),
    };
  }

  async function createVideoRequest(apiKey, input) {
    if (!hasExternalScope(apiKey, 'video:request')) {
      throw new RequestError('video:request scope is required', 403);
    }
    const { youtubeId, channelId, idempotencyHash } = validateMediaInput(input);
    const lookup = {
      keyId: apiKey.id,
      activeDedupeKey: `${apiKey.id}:video:${youtubeId}`,
      idempotencyHash,
      requestType: 'video',
      youtubeId,
      channelId,
    };
    const existing = await findTypedDuplicate(lookup);
    if (existing) return { outcome: 'duplicate', request: dto(existing) };

    const { downloaded } = await validateTarget(apiKey, youtubeId, channelId);
    if (downloaded) return { outcome: 'already_downloaded', request: null };
    return createOrFindDuplicate('video:request', {
      api_key_id: apiKey.id,
      channel_id: channelId,
      youtube_id: youtubeId,
      request_type: 'video',
      active_dedupe_key: lookup.activeDedupeKey,
      idempotency_hash: idempotencyHash,
    }, lookup);
  }

  async function createChannelRequest(apiKey, input) {
    if (!hasExternalScope(apiKey, 'channel:request')) {
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
    const lookup = {
      keyId: apiKey.id,
      activeDedupeKey: `${apiKey.id}:channel:${targetHash}`,
      idempotencyHash,
      requestType: 'channel',
      channelUrl,
    };
    const existing = await findTypedDuplicate(lookup);
    if (existing) return { outcome: 'duplicate', request: dto(existing) };
    return createOrFindDuplicate('channel:request', {
      api_key_id: apiKey.id,
      channel_id: null,
      youtube_id: null,
      channel_url: channelUrl,
      request_type: 'channel',
      grant_to_requesting_key: true,
      active_dedupe_key: lookup.activeDedupeKey,
      idempotency_hash: idempotencyHash,
    }, lookup);
  }

  async function createDeleteVideoRequest(apiKey, input) {
    if (!hasExternalScope(apiKey, 'video:delete')) {
      throw new RequestError('video:delete scope is required', 403);
    }
    const { youtubeId, channelId, idempotencyHash } = validateMediaInput(input);
    const lookup = {
      keyId: apiKey.id,
      activeDedupeKey: `${apiKey.id}:delete_video:${youtubeId}`,
      idempotencyHash,
      requestType: 'delete_video',
      youtubeId,
      channelId,
    };
    const existing = await findTypedDuplicate(lookup);
    if (existing) return { outcome: 'duplicate', request: dto(existing) };
    const target = await validateTarget(apiKey, youtubeId, channelId);
    if (!target.downloaded) throw new RequestError('Video not found', 404);
    return createOrFindDuplicate('video:delete', {
      api_key_id: apiKey.id,
      channel_id: channelId,
      youtube_id: youtubeId,
      request_type: 'delete_video',
      active_dedupe_key: lookup.activeDedupeKey,
      idempotency_hash: idempotencyHash,
    }, lookup);
  }

  async function listRequests(apiKey, query = {}) {
    const { page, pageSize, offset } = requestPagination(query);
    const status = query.status;
    if (status !== undefined && !REQUEST_STATUSES.includes(status)) {
      throw new RequestError(`status must be one of: ${REQUEST_STATUSES.join(', ')}`);
    }
    const result = await ExternalRequest.findAndCountAll({
      where: { api_key_id: apiKey.id, ...(status ? { status } : {}) },
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
    });
    return {
      data: result.rows.map(dto),
      pagination: requestPaginationDto(page, pageSize, result.count),
    };
  }

  async function getRequest(apiKey, id) {
    if (typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new RequestError('Request not found', 404);
    }
    const record = await ExternalRequest.findOne({ where: { id, api_key_id: apiKey.id } });
    if (!record) throw new RequestError('Request not found', 404);
    return dto(record);
  }

  return {
    createVideoRequest,
    createChannelRequest,
    createDeleteVideoRequest,
    listRequests,
    getRequest,
    ...reviewService,
    startExecutor: executor.start,
    stopExecutor: executor.stop,
    handleJobEnded: executor.handleJobEnded,
    runExecutorOnce: executor.runOnce,
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
