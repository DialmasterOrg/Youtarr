const { normalizePolicy, isMediaTypeEligible, isRatingEligible } = require('./externalEligibility');
const { RequestError } = require('./externalRequestPrimitives');

/**
 * Checks that a key may act on a cached video: the channel is granted,
 * enabled, and not terminated, and the video passes the key's media and
 * rating policy. Every failure is the same 404 so a key cannot probe for
 * videos outside its grants.
 */
function createTargetValidator({ models }) {
  const { ApiKeyChannelGrant, Channel, ChannelVideo, Video } = models;

  return async function validateTarget(key, youtubeId, channelId, transaction = null) {
    const policy = normalizePolicy(key);
    const queryOptions = transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {};
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
      attributes: ['id', 'youtubeId', 'normalized_rating', 'removed'],
      ...(transaction ? { transaction } : {}),
    });
    if (storedVideo && storedVideo.removed !== true && storedVideo.removed !== false) {
      throw new RequestError('Video not found', 404);
    }
    const downloaded = storedVideo?.removed === false ? storedVideo : null;
    if (!isRatingEligible(policy, storedVideo?.normalized_rating, channel.default_rating)) {
      throw new RequestError('Video not found', 404);
    }
    return { channel, downloaded };
  };
}

module.exports = { createTargetValidator };
