const Channel = require('../models/channel');
const configModule = require('./configModule');
const downloadSettingsResolver = require('./download/downloadSettingsResolver');

/**
 * Buckets playlist videos by their resolved COMMAND settings (resolution,
 * audioFormat, skipVideoFolder) so each bucket can share one yt-dlp invocation.
 * Routing settings (subfolder, rating) are intentionally not resolved here: they
 * are applied per-video at finalize time by the post-processor, which reads the
 * real channel from the downloaded .info.json. See downloadSettingsResolver.
 */
class PlaylistDownloadGrouper {
  async loadChannelMap(channelIds) {
    const ids = [...new Set(channelIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const channels = await Channel.findAll({
      where: { channel_id: ids },
      attributes: ['channel_id', 'video_quality', 'audio_format', 'skip_video_folder'],
    });
    const map = new Map();
    channels.forEach((c) => map.set(c.channel_id, c));
    return map;
  }

  async buildGroups(playlist, entries, overrideSettings = {}) {
    const channelMap = await this.loadChannelMap(entries.map((e) => e.channel_id));
    const groups = new Map();

    for (const entry of entries) {
      const channel = entry.channel_id ? channelMap.get(entry.channel_id) || null : null;
      const { resolution, audioFormat, skipVideoFolder } =
        downloadSettingsResolver.resolveCommandSettings({
          override: overrideSettings,
          channel,
          playlist,
          config: configModule.config,
        });

      const key = JSON.stringify({ resolution, audioFormat, skipVideoFolder });
      if (!groups.has(key)) {
        groups.set(key, { resolution, audioFormat, skipVideoFolder, youtubeIds: [] });
      }
      groups.get(key).youtubeIds.push(entry.youtube_id);
    }

    return Array.from(groups.values());
  }
}

module.exports = new PlaylistDownloadGrouper();
