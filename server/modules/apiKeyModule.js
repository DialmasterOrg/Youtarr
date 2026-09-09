const crypto = require('crypto');
const ApiKey = require('../models/apikey');
const logger = require('../logger');
const {
  normalizeExternalPermissions,
  roleForExternalPermissions,
} = require('./externalPermissions');
const { getEffectiveChannelGrantCounts } = require('./apiKeyChannelGrantModule');

const MAX_API_KEYS = 20;
const ROLES = ['legacy_download', 'view', 'request', 'delete', 'admin'];
const MEDIA_TYPES = ['video', 'short', 'livestream'];
const POLICY_FIELDS = [
  'role', 'autoApproveVideoRequests', 'autoApproveChannelRequests',
  'autoApproveDeleteRequests', 'allowVideoRequests', 'allowChannelRequests',
  'allowDeleteVideoRequests', 'maxRatingLevel', 'allowUnrated', 'allowedMediaTypes',
  'maxActiveJobs', 'hourlyWriteLimit', 'dailyWriteLimit',
];
const MANAGEMENT_ATTRIBUTES = [
  'id', 'name', 'key_prefix', 'created_at', 'last_used_at', 'is_active', 'usage_count', 'role',
  'auto_approve_video_requests', 'auto_approve_channel_requests', 'auto_approve_delete_requests',
  'allow_video_requests', 'allow_channel_requests', 'allow_delete_video_requests',
  'max_rating_level', 'allow_unrated', 'allowed_media_types', 'revoked_at',
  'max_active_jobs', 'hourly_write_limit', 'daily_write_limit',
];

function serializeApiKey(apiKey) {
  const source = typeof apiKey?.get === 'function' ? apiKey.get({ plain: true }) : apiKey;
  return MANAGEMENT_ATTRIBUTES.reduce((result, attribute) => {
    if (source && Object.prototype.hasOwnProperty.call(source, attribute)) {
      result[attribute] = source[attribute];
    }
    return result;
  }, {});
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Policy must be an object');
  }
  const unknown = Object.keys(policy).filter((field) => !POLICY_FIELDS.includes(field));
  if (unknown.length > 0) throw new Error(`Unsupported policy field: ${unknown[0]}`);
  if (!ROLES.includes(policy.role)) throw new Error('Invalid API key role');
  for (const field of [
    'autoApproveVideoRequests', 'autoApproveChannelRequests', 'autoApproveDeleteRequests',
    'allowVideoRequests', 'allowChannelRequests', 'allowDeleteVideoRequests', 'allowUnrated',
  ]) {
    if (field in policy && typeof policy[field] !== 'boolean') throw new Error(`Invalid ${field}`);
  }
  if ('maxRatingLevel' in policy && (!Number.isInteger(policy.maxRatingLevel) || policy.maxRatingLevel < 1 || policy.maxRatingLevel > 4)) {
    throw new Error('maxRatingLevel must be an integer from 1 to 4');
  }
  if ('allowedMediaTypes' in policy && (!Array.isArray(policy.allowedMediaTypes) || policy.allowedMediaTypes.length === 0 ||
    policy.allowedMediaTypes.some((type) => !MEDIA_TYPES.includes(type)))) {
    throw new Error('allowedMediaTypes must contain only video, short, or livestream');
  }
  const quotaFields = [
    ['maxActiveJobs', 5],
    ['hourlyWriteLimit', 30],
    ['dailyWriteLimit', 200],
  ];
  for (const [field, maximum] of quotaFields) {
    if (field in policy &&
        (!Number.isInteger(policy[field]) || policy[field] < 1 || policy[field] > maximum)) {
      throw new Error(`${field} must be an integer from 1 to ${maximum}`);
    }
  }
  const permissions = normalizeExternalPermissions(policy);
  if (!permissions) throw new Error('Invalid external request permissions');
  for (const [autoField, permissionField] of [
    ['autoApproveVideoRequests', 'allowVideoRequests'],
    ['autoApproveChannelRequests', 'allowChannelRequests'],
    ['autoApproveDeleteRequests', 'allowDeleteVideoRequests'],
  ]) {
    if (policy[autoField] === true && permissions[permissionField] !== true) {
      throw new Error(`${autoField} requires ${permissionField}`);
    }
  }
  return {
    role: roleForExternalPermissions(permissions, policy.role),
    allow_video_requests: permissions.allowVideoRequests,
    allow_channel_requests: permissions.allowChannelRequests,
    allow_delete_video_requests: permissions.allowDeleteVideoRequests,
    auto_approve_video_requests:
      permissions.allowVideoRequests && (policy.autoApproveVideoRequests ?? false),
    auto_approve_channel_requests:
      permissions.allowChannelRequests && (policy.autoApproveChannelRequests ?? false),
    auto_approve_delete_requests:
      permissions.allowDeleteVideoRequests && (policy.autoApproveDeleteRequests ?? false),
    max_rating_level: policy.maxRatingLevel ?? 4,
    allow_unrated: policy.allowUnrated ?? false,
    allowed_media_types: policy.allowedMediaTypes ?? ['video'],
    max_active_jobs: policy.maxActiveJobs ?? 5,
    hourly_write_limit: policy.hourlyWriteLimit ?? 30,
    daily_write_limit: policy.dailyWriteLimit ?? 200,
  };
}

class ApiKeyModule {
  /**
   * Generate a new API key
   * @param {string} name - Human-readable name for the key
   * @returns {Object} { id, name, key, prefix } - key is only returned once!
   */
  async createApiKey(name, policy, { transaction, logEvent = true } = {}) {
    // Check max keys limit
    const existingCount = await ApiKey.count({
      where: { is_active: true },
      ...(transaction ? { transaction } : {}),
    });
    if (existingCount >= MAX_API_KEYS) {
      throw new Error(`Maximum number of API keys reached (${MAX_API_KEYS})`);
    }

    // Generate a secure random key (32 bytes = 64 hex chars)
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const values = {
      name,
      key_hash: keyHash,
      key_prefix: prefix,
      created_at: new Date(),
      is_active: true,
      ...(policy === undefined ? {} : validatePolicy(policy)),
    };
    const apiKey = transaction
      ? await ApiKey.create(values, { transaction })
      : await ApiKey.create(values);

    if (logEvent) this.logApiKeyCreated({ id: apiKey.id, name, prefix });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey, // Only time the full key is returned
      prefix: prefix,
    };
  }

  logApiKeyCreated({ id, name, prefix }) {
    logger.info({
      keyId: id,
      name,
      prefix,
      event: 'api_key_created',
    }, 'API key created');
  }

  /**
   * Validate an API key using timing-safe comparison
   * @param {string} key - The raw API key to validate
   * @returns {Object|null} The API key record if valid, null otherwise
   */
  async validateApiKey(key, { recordUsage = true } = {}) {
    if (!key || typeof key !== 'string' || key.length < 8) {
      return null;
    }

    const prefix = key.substring(0, 8);
    const providedHash = crypto.createHash('sha256').update(key).digest('hex');

    // Find potential matches by prefix
    const candidates = await ApiKey.findAll({
      where: { key_prefix: prefix, is_active: true, revoked_at: null },
    });

    for (const candidate of candidates) {
      // Use timing-safe comparison to prevent timing attacks
      const storedHashBuffer = Buffer.from(candidate.key_hash, 'hex');
      const providedHashBuffer = Buffer.from(providedHash, 'hex');

      if (storedHashBuffer.length === providedHashBuffer.length &&
          crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)) {
        if (recordUsage) await this.markApiKeyUsed(candidate.id);
        return candidate;
      }
    }

    return null;
  }

  async markApiKeyUsed(id, timestamp = new Date()) {
    const { Op } = require('sequelize');
    const cutoff = new Date(timestamp.getTime() - 60 * 1000);
    await ApiKey.update(
      { last_used_at: timestamp },
      {
        where: {
          id,
          [Op.or]: [
            { last_used_at: null },
            { last_used_at: { [Op.lt]: cutoff } },
          ],
        },
      }
    );
  }

  /**
   * Increment the usage count for an API key
   * @param {number} id - API key ID
   */
  async incrementUsageCount(id) {
    const apiKey = await ApiKey.findByPk(id);
    if (apiKey && apiKey.is_active) {
      await apiKey.increment('usage_count');
      logger.debug({ keyId: id, newCount: apiKey.usage_count + 1 }, 'Incremented API key usage count');
    }
  }

  /**
   * List all API keys (without the actual key values)
   * @returns {Array} List of API key records
   */
  async listApiKeys() {
    const keys = await ApiKey.findAll({
      attributes: MANAGEMENT_ATTRIBUTES,
      order: [['created_at', 'DESC']],
    });
    const serializedKeys = keys.map(serializeApiKey);
    const grantCounts = await getEffectiveChannelGrantCounts(
      serializedKeys.map((key) => key.id)
    );
    return serializedKeys.map((key) => ({
      ...key,
      channel_grant_count: grantCounts.get(key.id) || 0,
    }));
  }

  async updateApiKey(id, policy, { transaction } = {}) {
    const apiKey = transaction
      ? await ApiKey.findByPk(id, { transaction })
      : await ApiKey.findByPk(id);
    if (!apiKey || !apiKey.is_active || apiKey.revoked_at) return null;
    if (apiKey.role === 'legacy_download' || policy?.role === 'legacy_download') {
      throw new Error('Legacy and external API key types cannot be converted');
    }
    const values = validatePolicy(policy);
    if (transaction) await apiKey.update(values, { transaction });
    else await apiKey.update(values);
    return serializeApiKey(apiKey);
  }

  /**
   * Replace an active key's secret while preserving its identity, policy,
   * channel grants, and audit history. The returned plaintext is shown once.
   */
  async regenerateApiKey(id) {
    const apiKey = await ApiKey.findByPk(id);
    if (!apiKey || !apiKey.is_active || apiKey.revoked_at) return null;

    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await apiKey.update({
      key_hash: keyHash,
      key_prefix: prefix,
      last_used_at: null,
    });
    logger.info({
      keyId: apiKey.id,
      name: apiKey.name,
      prefix,
      event: 'api_key_regenerated',
    }, 'API key regenerated');

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      prefix,
    };
  }

  /**
   * Revoke an API key while retaining an audit record.
   * @param {number} id - API key ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteApiKey(id) {
    // Get key info before revocation for audit log
    const apiKey = await ApiKey.findByPk(id);
    const keyName = apiKey?.name;
    const keyPrefix = apiKey?.key_prefix;
    
    if (apiKey && !apiKey.revoked_at) {
      await apiKey.update({ is_active: false, revoked_at: new Date() });
      logger.info({ 
        keyId: id,
        name: keyName,
        prefix: keyPrefix,
        event: 'api_key_revoked'
      }, 'API key revoked');
      return true;
    }
    return false;
  }
}

module.exports = new ApiKeyModule();
module.exports.validatePolicy = validatePolicy;
module.exports.serializeApiKey = serializeApiKey;
module.exports.managementAttributes = MANAGEMENT_ATTRIBUTES;
