const crypto = require('crypto');
const { Op, UniqueConstraintError } = require('sequelize');
const { normalizePolicy } = require('./externalCatalogService');
const { isMediaTypeEligible, isRatingEligible } = require('./externalEligibility');
const { hasExternalScope, normalizeExternalPermissions } = require('./externalPermissions');

const REQUEST_STATUSES = [
  'pending', 'approved', 'processing', 'completed',
  'rejected', 'failed', 'cancelled',
];
const ACTIVE_STATUSES = ['pending', 'approved', 'processing'];
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const AUXILIARY_RECOVERY_DELAY_MS = 5 * 60 * 1000;
const MAX_PAGE = 100;

class RequestError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

function rethrowWorkLimit(error) {
  if (error?.name === 'ExternalWorkLimitError') {
    throw new RequestError(
      'External API work capacity is temporarily unavailable',
      503,
      'work_queue_full'
    );
  }
}

function requireCurrentAutoApproval(key, requestType) {
  const enabled = {
    video: key.autoApproveVideoRequests,
    channel: key.autoApproveChannelRequests,
    delete_video: key.autoApproveDeleteRequests,
  }[requestType];
  if (enabled !== true) {
    throw new RequestError('Request is no longer eligible', 403);
  }
}

function parseInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new RequestError(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RequestError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function decodeCursor(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new RequestError('cursor is invalid');
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed?.v !== 1 || !Number.isSafeInteger(parsed.page) ||
        parsed.page < 1 || parsed.page > MAX_PAGE) {
      throw new Error('invalid cursor');
    }
    return parsed.page;
  } catch (_error) {
    throw new RequestError('cursor is invalid');
  }
}

function requestPagination(query) {
  if (query.cursor !== undefined && query.page !== undefined) {
    throw new RequestError('cursor and page cannot be used together');
  }
  const page = decodeCursor(query.cursor) ||
    parseInteger(query.page, 1, 1, MAX_PAGE, 'page');
  const pageSize = parseInteger(query.pageSize, 50, 1, 100, 'pageSize');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function requestPaginationDto(page, pageSize, total) {
  const totalPages = total === 0 ? 0 : Math.min(MAX_PAGE, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    nextCursor: page < totalPages
      ? Buffer.from(JSON.stringify({ v: 1, page: page + 1 }), 'utf8').toString('base64url')
      : null,
  };
}

function normalizeIdempotencyKey(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > 200) {
    throw new RequestError('idempotencyKey must be a string of 1 to 200 characters');
  }
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeChannelUrl(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500) {
    throw new RequestError('channelUrl must be a supported YouTube channel URL');
  }
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
  } catch (_error) {
    throw new RequestError('channelUrl must be a supported YouTube channel URL');
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const supportedPrefix = segments[0]?.startsWith('@') ||
    ['channel', 'c', 'user'].includes(segments[0]);
  if (!['youtube.com', 'm.youtube.com'].includes(hostname) ||
      !supportedPrefix || segments.length !== (segments[0].startsWith('@') ? 1 : 2)) {
    throw new RequestError('channelUrl must be a supported YouTube channel URL');
  }
  try {
    return `https://www.youtube.com/${segments.map((segment) => {
      const decoded = decodeURIComponent(segment);
      return decoded.startsWith('@')
        ? `@${encodeURIComponent(decoded.slice(1))}`
        : encodeURIComponent(decoded);
    }).join('/')}`;
  } catch (_error) {
    throw new RequestError('channelUrl must be a supported YouTube channel URL');
  }
}

function dto(record) {
  const value = record.toJSON ? record.toJSON() : record;
  return {
    id: value.id,
    type: value.request_type,
    status: value.status,
    target: {
      youtubeId: value.youtube_id || null,
      channelId: value.channel_id || null,
      channelUrl: value.channel_url || null,
    },
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    ...(value.decided_at ? { decidedAt: value.decided_at } : {}),
    ...(value.completed_at ? { completedAt: value.completed_at } : {}),
    ...(value.message ? { message: value.message } : {}),
    ...(value.request_type === 'channel' && value.grant_to_requesting_key !== null &&
      value.grant_to_requesting_key !== undefined
      ? { grantToRequestingKey: value.grant_to_requesting_key === true }
      : {}),
  };
}

function normalizeStoredKey(record) {
  const value = record?.toJSON ? record.toJSON() : record;
  if (!value) return null;
  const permissions = normalizeExternalPermissions(value);
  if (!permissions) return null;
  return {
    id: value.id,
    name: value.name,
    role: value.role,
    isActive: value.is_active,
    revokedAt: value.revoked_at,
    autoApproveVideoRequests: value.auto_approve_video_requests,
    autoApproveChannelRequests: value.auto_approve_channel_requests,
    autoApproveDeleteRequests: value.auto_approve_delete_requests,
    ...permissions,
    maxRatingLevel: value.max_rating_level,
    allowUnrated: value.allow_unrated,
    allowedMediaTypes: value.allowed_media_types,
  };
}

function sanitizeReason(value) {
  if (typeof value !== 'string') {
    throw new RequestError('reason is required');
  }
  // eslint-disable-next-line no-control-regex
  const sanitized = value.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (sanitized.length < 1 || sanitized.length > 300) {
    throw new RequestError('reason must be between 1 and 300 characters');
  }
  return sanitized;
}

function isUniqueConstraintError(error) {
  return error instanceof UniqueConstraintError ||
    error?.name === 'SequelizeUniqueConstraintError';
}

function adminDto(record, catalogVideo = null) {
  const value = record.toJSON ? record.toJSON() : record;
  const key = value.apiKey || value.api_key || null;
  const channel = value.channel || null;
  const job = value.job || null;
  return {
    ...dto(record),
    requester: key ? {
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      role: key.role,
      isActive: key.is_active === true,
      revokedAt: key.revoked_at || null,
    } : null,
    target: {
      youtubeId: value.youtube_id || null,
      channelId: value.channel_id || null,
      channelUrl: value.channel_url || null,
      youtubeChannelId: channel?.channel_id || null,
      channelTitle: channel?.title || channel?.uploader || null,
      title: catalogVideo?.title || null,
      mediaType: catalogVideo?.media_type || null,
      rating: channel?.default_rating || null,
      contentRating: catalogVideo?.content_rating || channel?.default_rating || null,
    },
    job: job ? {
      id: job.id,
      status: job.status,
      type: job.jobType,
      createdAt: job.timeCreated,
      startedAt: job.timeInitiated,
    } : null,
  };
}

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
    ExternalRequest, ApiKey, ApiKeyChannelGrant, Channel, ChannelVideo, Video, Job,
  } = models;
  const quotas = quotaService ||
    require('./externalQuotaService').createExternalQuotaService({ models, sequelize, now });

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

  async function reconcile(records) {
    const processing = records.filter((record) => record.status === 'processing');
    const mediaRequests = processing.filter(
      (record) => ['video', 'delete_video'].includes(record.request_type)
    );
    const youtubeIds = [...new Set(mediaRequests.map((record) => record.youtube_id))];
    if (youtubeIds.length === 0) return records;
    const videos = await Video.findAll({
      where: { youtubeId: youtubeIds, removed: false },
      attributes: ['youtubeId'],
    });
    const completed = new Set(videos.map((video) => video.youtubeId));
    const completedAt = now();
    const completedRecords = mediaRequests.filter((record) =>
      (record.request_type === 'video' && completed.has(record.youtube_id)) ||
      (record.request_type === 'delete_video' && !completed.has(record.youtube_id))
    );
    await Promise.all(completedRecords.map(async (record) => {
      await record.update({
        status: 'completed',
        active_dedupe_key: null,
        completed_at: completedAt,
        updated_at: completedAt,
      });
    }));
    const unresolved = mediaRequests.filter(
      (record) => record.request_type === 'video' &&
        !completed.has(record.youtube_id) && record.job_id
    );
    if (unresolved.length > 0) {
      const jobs = await Job.findAll({
        where: { id: [...new Set(unresolved.map((record) => record.job_id))] },
        attributes: ['id', 'status'],
      });
      const terminalFailures = new Set(
        jobs
          .filter((job) => [
            'Error', 'Killed', 'Terminated', 'Complete', 'Complete with Warnings',
          ].includes(job.status))
          .map((job) => job.id)
      );
      await Promise.all(unresolved
        .filter((record) => terminalFailures.has(record.job_id))
        .map((record) => record.update({
          status: 'failed',
          active_dedupe_key: null,
          message: 'Download did not complete',
          updated_at: completedAt,
        })));
    }
    return records;
  }

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
      { where: { id: record.id, status: whereStatus } }
    );
    if (claimed !== 1) return false;
    record.status = 'processing';
    record.updated_at = timestamp;
    return true;
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

  async function findDuplicate(keyId, activeDedupeKey, idempotencyHash, youtubeId, channelId) {
    const clauses = [{ active_dedupe_key: activeDedupeKey }];
    if (idempotencyHash) clauses.push({ api_key_id: keyId, idempotency_hash: idempotencyHash });
    const existing = await ExternalRequest.findOne({ where: { [Op.or]: clauses } });
    if (!existing) return null;
    if (existing.youtube_id !== youtubeId || existing.channel_id !== channelId) {
      throw new RequestError('Idempotency key was already used for another target', 409);
    }
    await reconcile([existing]);
    return existing;
  }

  async function findTypedDuplicate({
    keyId, activeDedupeKey, idempotencyHash, requestType, youtubeId = null,
    channelId = null, channelUrl = null,
  }) {
    const clauses = [{ active_dedupe_key: activeDedupeKey }];
    if (idempotencyHash) clauses.push({ api_key_id: keyId, idempotency_hash: idempotencyHash });
    const existing = await ExternalRequest.findOne({ where: { [Op.or]: clauses } });
    if (!existing) return null;
    if (existing.request_type !== requestType ||
        existing.youtube_id !== youtubeId ||
        existing.channel_id !== channelId ||
        existing.channel_url !== channelUrl) {
      throw new RequestError('Idempotency key was already used for another target', 409);
    }
    return existing;
  }

  async function dispatchAutoApproved(record, key) {
    try {
      const jobId = await workLimiter.run(() =>
        sequelize.transaction(async (transaction) => {
          const currentKey = await quotas.assertExecutionCapacity(
            key.id,
            'video:request',
            record.id,
            transaction
          );
          requireCurrentAutoApproval(currentKey, 'video');
          const target = await validateTarget(
            currentKey,
            record.youtube_id,
            record.channel_id,
            transaction
          );
          return executor({
            body: {
              urls: [`https://www.youtube.com/watch?v=${record.youtube_id}`],
              channelId: target.channel.channel_id,
              ownerChannelMap: { [record.youtube_id]: target.channel.channel_id },
              initiatedBy: { type: 'api_key', name: currentKey.name },
              jobLabel: 'External video request',
              // The downloader uses this UUID as the job identity. A retry after a
              // crash can therefore observe/reuse the accepted job instead of
              // starting the same download twice.
              externalRequestId: record.id,
            },
          });
        })
      );
      const acceptedAt = now();
      await record.update({
        status: 'processing',
        job_id: jobId || record.id,
        updated_at: acceptedAt,
      });
    } catch (error) {
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
    const { downloaded } = await validateTarget(key, input.youtubeId, channelId);
    if (downloaded) return { outcome: 'already_downloaded', request: null };

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
        } catch (_error) {
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
        if (error?.status === 503) throw error;
        await failAuthorityChange(record);
      }
    }
    return { outcome: 'created', request: dto(record) };
  }

  async function provisionChannelRequest(
    record,
    key,
    { grantToRequestingKey, requireAutoApproval = false } = {}
  ) {
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
            requireAutoApproval: existing.status !== 'approved',
          });
        } catch (_error) {
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
        if (error?.status === 503) throw error;
        await failAuthorityChange(record);
      }
    }
    return { outcome: 'created', request: dto(record) };
  }

  async function executeDeleteRequest(record, { requireAutoApproval = false } = {}) {
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
        if (!target.downloaded) {
          throw new RequestError('Video not found', 404);
        }
        const result = await videoDeleter.deleteVideoById(
          target.downloaded.id,
          { transaction, video: target.downloaded }
        );
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
    const target = await validateTarget(key, input.youtubeId, channelId);
    if (!target.downloaded) {
      // Removed and never-downloaded targets are deliberately indistinguishable
      // from every other hidden target state.
      throw new RequestError('Video not found', 404);
    }
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
            requireAutoApproval: existing.status !== 'approved',
          });
        } catch (_error) {
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
        if (error?.status === 503) throw error;
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

    await sequelize.transaction(async (transaction) => {
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
      try {
        const jobId = await workLimiter.run(() => executor({
          body: {
            urls: [`https://www.youtube.com/watch?v=${record.youtube_id}`],
            channelId: target.channel.channel_id,
            ownerChannelMap: { [record.youtube_id]: target.channel.channel_id },
            initiatedBy: { type: 'api_key', name: key.name },
            jobLabel: 'External video request',
            externalRequestId: record.id,
          },
        }));
        const acceptedAt = now();
        await record.update({
          status: 'processing',
          job_id: jobId || record.id,
          updated_at: acceptedAt,
        }, { transaction });
      } catch (_error) {
        await failApproval('Download could not be queued');
      }
    });

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
      const record = await ExternalRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new RequestError('Request not found', 404);
      if (record.status !== 'pending') {
        throw new RequestError('Only pending requests can be reviewed', 409);
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
        ...(record.request_type === 'channel'
          ? { grant_to_requesting_key: input.grantToRequestingKey !== false }
          : {}),
        decided_at: decisionAt,
        updated_at: decisionAt,
      }, { transaction });
      claimed = record;
    });
    if (action === 'approve' && claimed) {
      if (claimed.request_type === 'channel') {
        await provisionChannelRequest(claimed, key, {
          grantToRequestingKey: input.grantToRequestingKey !== false,
        });
      } else if (claimed.request_type === 'delete_video') {
        await executeDeleteRequest(claimed);
      }
    }
    return getAdminRequest(id);
  }

  return {
    createVideoRequest,
    createChannelRequest,
    createDeleteVideoRequest,
    listRequests,
    getRequest,
    listAdminRequests,
    getAdminRequest,
    reviewVideoRequest,
    reviewRequest,
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
