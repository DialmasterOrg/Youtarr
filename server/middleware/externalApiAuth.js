const EXTERNAL_ROLES = ['view', 'request', 'delete', 'admin'];
const ALLOWED_MEDIA_TYPES = ['video', 'short', 'livestream'];
const { sendExternalError } = require('../modules/externalApiResponse');
const {
  normalizeExternalPermissions,
  roleForExternalPermissions,
} = require('../modules/externalPermissions');

function normalizeAllowedMediaTypes(value) {
  if (!Array.isArray(value)) return null;
  if (value.some((type) => !ALLOWED_MEDIA_TYPES.includes(type))) return null;
  const types = [...new Set(value)];
  return types.length > 0 ? types : null;
}

function normalizeExternalApiKey(apiKey) {
  if (!apiKey || apiKey.is_active !== true || apiKey.revoked_at ||
      !EXTERNAL_ROLES.includes(apiKey.role)) {
    return null;
  }
  const permissionFields = [
    'allow_video_requests',
    'allow_channel_requests',
    'allow_delete_video_requests',
  ];
  if (permissionFields.some((field) => typeof apiKey[field] !== 'boolean')) {
    return null;
  }
  const allowedMediaTypes = normalizeAllowedMediaTypes(apiKey.allowed_media_types);
  const permissions = normalizeExternalPermissions(apiKey);
  if (!allowedMediaTypes || !permissions ||
      roleForExternalPermissions(permissions, apiKey.role) !== apiKey.role ||
      !Number.isInteger(apiKey.max_rating_level) ||
      apiKey.max_rating_level < 1 || apiKey.max_rating_level > 4 ||
      typeof apiKey.allow_unrated !== 'boolean' ||
      !Number.isInteger(apiKey.max_active_jobs) ||
      apiKey.max_active_jobs < 1 || apiKey.max_active_jobs > 5 ||
      !Number.isInteger(apiKey.hourly_write_limit) ||
      apiKey.hourly_write_limit < 1 || apiKey.hourly_write_limit > 30 ||
      !Number.isInteger(apiKey.daily_write_limit) ||
      apiKey.daily_write_limit < 1 || apiKey.daily_write_limit > 200) {
    return null;
  }
  const autoApproveFields = [
    ['auto_approve_video_requests', permissions.allowVideoRequests],
    ['auto_approve_channel_requests', permissions.allowChannelRequests],
    ['auto_approve_delete_requests', permissions.allowDeleteVideoRequests],
  ];
  if (autoApproveFields.some(([field, permission]) =>
    typeof apiKey[field] !== 'boolean' || (apiKey[field] && !permission))) {
    return null;
  }
  return {
    id: apiKey.id,
    name: apiKey.name,
    role: apiKey.role,
    autoApproveVideoRequests: apiKey.auto_approve_video_requests,
    autoApproveChannelRequests: apiKey.auto_approve_channel_requests,
    autoApproveDeleteRequests: apiKey.auto_approve_delete_requests,
    ...permissions,
    maxRatingLevel: apiKey.max_rating_level,
    allowUnrated: apiKey.allow_unrated,
    allowedMediaTypes,
    maxActiveJobs: apiKey.max_active_jobs,
    hourlyWriteLimit: apiKey.hourly_write_limit,
    dailyWriteLimit: apiKey.daily_write_limit,
  };
}

function createExternalApiAuth({ validateApiKey }) {
  return async function externalApiAuth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || typeof key !== 'string') {
      return sendExternalError(res, 401, 'x-api-key is required', {
        code: 'missing_api_key',
        requestId: req.id,
      });
    }

    try {
      const apiKey = await validateApiKey(key);
      if (!apiKey) {
        return sendExternalError(res, 401, 'Invalid external API key', {
          code: 'invalid_api_key',
          requestId: req.id,
        });
      }
      const normalized = normalizeExternalApiKey(apiKey);
      if (!normalized) {
        return sendExternalError(res, 401, 'Invalid external API key policy', {
          code: 'invalid_key_policy',
          requestId: req.id,
        });
      }
      req.externalApiKey = normalized;
      return next();
    } catch (error) {
      req.log?.error({ err: error }, 'External API key verification failed');
      return sendExternalError(res, 500, 'External API authentication error', {
        requestId: req.id,
      });
    }
  };
}

module.exports = {
  createExternalApiAuth,
  EXTERNAL_ROLES,
  normalizeAllowedMediaTypes,
  normalizeExternalApiKey,
};
