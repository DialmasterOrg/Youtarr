const { Op } = require('sequelize');
const { sequelize } = require('../db');
const { ApiKey, ApiKeyChannelGrant, Channel } = require('../models');

function normalizeChannelIds(channelIds) {
  if (!Array.isArray(channelIds)) throw new Error('channelIds must be an array');
  const normalized = [...new Set(channelIds)];
  if (normalized.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error('channelIds must contain only positive integer database IDs');
  }
  return normalized.sort((a, b) => a - b);
}

async function requireExternalKey(keyId, transaction) {
  const key = await ApiKey.findByPk(keyId, { transaction });
  if (!key) return null;
  if (!key.is_active || key.revoked_at || key.role === 'legacy_download') {
    throw new Error('Only active external API keys can receive channel grants');
  }
  return key;
}

async function getChannelGrants(keyId) {
  const key = await requireExternalKey(keyId);
  if (!key) return null;
  const grants = await ApiKeyChannelGrant.findAll({
    where: { api_key_id: keyId },
    attributes: ['channel_id'],
    include: [{
      model: Channel,
      as: 'channel',
      attributes: [],
      required: true,
      where: { enabled: true, terminated_at: { [Op.is]: null } },
    }],
    order: [['channel_id', 'ASC']],
    raw: true,
  });
  return { keyId, channelIds: grants.map((grant) => grant.channel_id) };
}

async function getEffectiveChannelGrantCounts(keyIds) {
  if (keyIds.length === 0) return new Map();
  const grants = await ApiKeyChannelGrant.findAll({
    where: { api_key_id: keyIds },
    attributes: ['api_key_id'],
    include: [{
      model: Channel,
      as: 'channel',
      attributes: [],
      required: true,
      where: { enabled: true, terminated_at: { [Op.is]: null } },
    }],
    raw: true,
  });
  return grants.reduce((counts, grant) => {
    counts.set(grant.api_key_id, (counts.get(grant.api_key_id) || 0) + 1);
    return counts;
  }, new Map());
}

async function replaceChannelGrants(keyId, channelIds, { transaction: existingTransaction } = {}) {
  const normalized = normalizeChannelIds(channelIds);
  const replace = async (transaction) => {
    const key = await requireExternalKey(keyId, transaction);
    if (!key) return null;

    if (normalized.length > 0) {
      const enabledCount = await Channel.count({
        where: { id: normalized, enabled: true, terminated_at: { [Op.is]: null } },
        transaction,
      });
      if (enabledCount !== normalized.length) {
        throw new Error('Every channel ID must identify an enabled, non-terminated channel');
      }
    }

    await ApiKeyChannelGrant.destroy({ where: { api_key_id: keyId }, transaction });
    if (normalized.length > 0) {
      await ApiKeyChannelGrant.bulkCreate(
        normalized.map((channelId) => ({ api_key_id: keyId, channel_id: channelId })),
        { transaction }
      );
    }
    return { keyId, channelIds: normalized };
  };
  return existingTransaction
    ? replace(existingTransaction)
    : sequelize.transaction(replace);
}

module.exports = {
  getChannelGrants,
  getEffectiveChannelGrantCounts,
  replaceChannelGrants,
  normalizeChannelIds,
};
