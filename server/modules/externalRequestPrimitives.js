const crypto = require('crypto');
const { UniqueConstraintError } = require('sequelize');
const { normalizeExternalPermissions } = require('./externalPermissions');

const REQUEST_STATUSES = [
  'pending', 'approved', 'processing', 'completed',
  'rejected', 'failed', 'cancelled',
];
const ACTIVE_STATUSES = ['pending', 'approved', 'processing'];
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const AUXILIARY_RECOVERY_DELAY_MS = 5 * 60 * 1000;
const paginationHelpers = require('./externalPagination');

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
  return paginationHelpers.parseInteger(value, fallback, minimum, maximum, name, RequestError);
}

function requestPagination(query) {
  return paginationHelpers.pagination(query, 100, RequestError);
}

const requestPaginationDto = paginationHelpers.paginationDto;

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

module.exports = {
  REQUEST_STATUSES, ACTIVE_STATUSES, VIDEO_ID_PATTERN, AUXILIARY_RECOVERY_DELAY_MS,
  RequestError, rethrowWorkLimit, requireCurrentAutoApproval, parseInteger,
  requestPagination, requestPaginationDto, normalizeIdempotencyKey, normalizeChannelUrl,
  dto, normalizeStoredKey, sanitizeReason, isUniqueConstraintError, adminDto,
};
