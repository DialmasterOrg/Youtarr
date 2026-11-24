const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const { ApiKey, ApiKeyChannelGrant, Channel } = require('../../models');
const { STATUS_READ_ROLE } = require('../constants/apiKeyRoles');

class ChannelGrantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChannelGrantValidationError';
  }
}

function normalizeChannelIds(channelIds) {
  if (!Array.isArray(channelIds)) throw new ChannelGrantValidationError('channelIds must be an array');
  const normalized = [...new Set(channelIds)];
  if (normalized.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new ChannelGrantValidationError('channelIds must contain only positive integer database IDs');
  }
  return normalized.sort((a, b) => a - b);
}

async function requireExternalKey(keyId, transaction) {
  const key = await ApiKey.findByPk(keyId, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!key) return null;
  if (!key.is_active || key.revoked_at || key.role === 'legacy_download' || key.role === STATUS_READ_ROLE) {
    throw new ChannelGrantValidationError('Only active external API keys can receive channel grants');
  }
  return key;
}

const eligibleChannelInclude = () => [{
  model: Channel,
  as: 'channel',
  attributes: [],
  required: true,
  where: { enabled: true, terminated_at: { [Op.is]: null } },
}];

async function findEligibleGrantChannelIds(keyId, transaction) {
  const grants = await ApiKeyChannelGrant.findAll({
    where: { api_key_id: keyId },
    attributes: ['channel_id'],
    include: eligibleChannelInclude(),
    order: [['channel_id', 'ASC']],
    raw: true,
    ...(transaction ? { transaction } : {}),
  });
  return grants.map((grant) => grant.channel_id);
}

async function getChannelGrants(keyId) {
  const key = await requireExternalKey(keyId);
  if (!key) return null;
  return { keyId, channelIds: await findEligibleGrantChannelIds(keyId) };
}

async function getEffectiveChannelGrantCounts(keyIds) {
  if (keyIds.length === 0) return new Map();
  const grants = await ApiKeyChannelGrant.findAll({
    where: { api_key_id: keyIds },
    attributes: ['api_key_id'],
    include: eligibleChannelInclude(),
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
        throw new ChannelGrantValidationError('Every channel ID must identify an enabled, non-terminated channel');
      }
    }

    // Only grants the editor can see are replaced. A grant on a disabled or
    // terminated channel grants nothing while it stays that way, and is kept
    // so the channel is approved again when it is turned back on.
    const replaceableIds = await findEligibleGrantChannelIds(keyId, transaction);
    if (replaceableIds.length > 0) {
      await ApiKeyChannelGrant.destroy({
        where: { api_key_id: keyId, channel_id: replaceableIds },
        transaction,
      });
    }
    if (normalized.length > 0) {
      // A channel disabled since the eligibility check keeps its dormant
      // grant, which would otherwise collide with the new row.
      await ApiKeyChannelGrant.bulkCreate(
        normalized.map((channelId) => ({ api_key_id: keyId, channel_id: channelId })),
        { transaction, ignoreDuplicates: true }
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
