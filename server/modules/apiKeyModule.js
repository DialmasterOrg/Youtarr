const crypto = require('crypto');
const ApiKey = require('../models/apikey');
const logger = require('../logger');

const MAX_API_KEYS = 20;

class ApiKeyModule {
  /**
   * Generate a new API key
   * @param {string} name - Human-readable name for the key
   * @returns {Object} { id, name, key, prefix } - key is only returned once!
   */
  async createApiKey(name) {
    // Check max keys limit
    const existingCount = await ApiKey.count({ where: { is_active: true } });
    if (existingCount >= MAX_API_KEYS) {
      throw new Error(`Maximum number of API keys reached (${MAX_API_KEYS})`);
    }

    // Generate a secure random key (32 bytes = 64 hex chars)
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.create({
      name,
      key_hash: keyHash,
      key_prefix: prefix,
      created_at: new Date(),
      is_active: true,
    });

    logger.info({ 
      keyId: apiKey.id, 
      name,
      prefix,
      event: 'api_key_created'
    }, 'API key created');

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey, // Only time the full key is returned
      prefix: prefix,
    };
  }

  /**
   * Validate an API key using timing-safe comparison
   * @param {string} key - The raw API key to validate
   * @returns {Object|null} The API key record if valid, null otherwise
   */
  async validateApiKey(key) {
    if (!key || typeof key !== 'string' || key.length < 8) {
      return null;
    }

    const prefix = key.substring(0, 8);
    const providedHash = crypto.createHash('sha256').update(key).digest('hex');

    // Find potential matches by prefix
    const candidates = await ApiKey.findAll({
      where: { key_prefix: prefix, is_active: true },
    });

    for (const candidate of candidates) {
      // Use timing-safe comparison to prevent timing attacks
      const storedHashBuffer = Buffer.from(candidate.key_hash, 'hex');
      const providedHashBuffer = Buffer.from(providedHash, 'hex');

      if (storedHashBuffer.length === providedHashBuffer.length &&
          crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)) {
        // Update last_used_at
        await candidate.update({ last_used_at: new Date() });
        return candidate;
      }
    }

    return null;
  }

  /**
   * List all API keys (without the actual key values)
   * @returns {Array} List of API key records
   */
  async listApiKeys() {
    return ApiKey.findAll({
      attributes: ['id', 'name', 'key_prefix', 'created_at', 'last_used_at', 'is_active'],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Revoke an API key (soft delete)
   * @param {number} id - API key ID
   * @returns {boolean} True if revoked, false if not found
   */
  async revokeApiKey(id) {
    const apiKey = await ApiKey.findByPk(id);
    if (!apiKey) {
      return false;
    }

    const keyName = apiKey.name;
    const keyPrefix = apiKey.key_prefix;
    await apiKey.update({ is_active: false });
    logger.info({ 
      keyId: id, 
      name: keyName,
      prefix: keyPrefix,
      event: 'api_key_revoked'
    }, 'API key revoked');
    return true;
  }

  /**
   * Delete an API key permanently
   * @param {number} id - API key ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteApiKey(id) {
    // Get key info before deletion for audit log
    const apiKey = await ApiKey.findByPk(id);
    const keyName = apiKey?.name;
    const keyPrefix = apiKey?.key_prefix;
    
    const result = await ApiKey.destroy({ where: { id } });
    if (result > 0) {
      logger.info({ 
        keyId: id,
        name: keyName,
        prefix: keyPrefix,
        event: 'api_key_deleted'
      }, 'API key deleted');
      return true;
    }
    return false;
  }
}

module.exports = new ApiKeyModule();

