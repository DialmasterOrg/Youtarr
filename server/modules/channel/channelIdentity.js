const Channel = require('../../models/channel');

class ChannelIdentity {
  /**
   * Find channel by URL or ID
   * @param {string} channelUrlOrId - Channel URL or ID
   * @returns {Promise<Object>} - Channel object with url and id
   */
  async findChannelByUrlOrId(channelUrlOrId) {
    let channelUrl = '';
    let channelId = '';
    let foundChannel = null;

    if (channelUrlOrId.startsWith('http')) {
      channelUrl = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { url: channelUrl },
      });
      if (foundChannel && foundChannel.channel_id) {
        channelId = foundChannel.channel_id;
        channelUrl = this.resolveChannelUrlFromId(channelId);
      }
    } else {
      channelId = channelUrlOrId;
      foundChannel = await Channel.findOne({
        where: { channel_id: channelId },
      });
      channelUrl = this.resolveChannelUrlFromId(channelId);
    }

    return { foundChannel, channelUrl, channelId };
  }

  /**
   * Build a canonical YouTube channel URL from a channel-like ID.
   * Handles uploads playlist IDs (UU...) by converting to UC...
   * @param {string} channelId
   * @returns {string}
   */
  resolveChannelUrlFromId(channelId) {
    if (!channelId) return '';
    const normalizedId = channelId.startsWith('UU')
      ? `UC${channelId.substring(2)}`
      : channelId;
    return `https://www.youtube.com/channel/${normalizedId}`;
  }
}

module.exports = new ChannelIdentity();
