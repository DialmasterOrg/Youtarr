const Channel = require('../models/channel');
const configModule = require('./configModule');
const logger = require('../logger');
const downloadSettingsResolver = require('./download/downloadSettingsResolver');
const { getLayoutResolver } = require('./tvShows/libraryLayouts');

/**
 * Buckets playlist videos by their resolved COMMAND settings (resolution,
 * audioFormat, skipVideoFolder) so each bucket can share one yt-dlp invocation.
 * Routing settings (subfolder, rating) are intentionally not resolved here: they
 * are applied per-video at finalize time by the post-processor, which reads the
 * real channel from the downloaded .info.json. See downloadSettingsResolver.
 * The one exception is the destination's layout: TV folders are video-only, so
 * an MP3 type is downgraded for videos whose predicted folder is TV.
 */
class PlaylistDownloadGrouper {
  async loadChannelMap(channelIds) {
    const ids = [...new Set(channelIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    // Only enabled channels contribute settings. Disabled channels (including the hidden
    // source channels auto-created during playlist sync) are invisible in the UI, so their
    // settings shouldn't override the playlist. Treat them as untracked: resolution falls
    // through to playlist -> global.
    const channels = await Channel.findAll({
      where: { channel_id: ids, enabled: true },
      attributes: ['channel_id', 'video_quality', 'audio_format', 'skip_video_folder', 'sub_folder'],
    });
    const map = new Map();
    channels.forEach((c) => map.set(c.channel_id, c));
    return map;
  }

  /**
   * Download type for one video: the executor's audio contract (an explicitly
   * provided audioFormat wins even when it is null = force video-only; the
   * generic resolver treats null as "no override"), then the TV downgrade.
   * @returns {{audioFormat: string|null, downgraded: boolean}}
   */
  resolveAudioFormat({ overrideSettings, resolved, channel, playlist, layoutOf }) {
    const requested = overrideSettings.audioFormat !== undefined
      ? overrideSettings.audioFormat
      : resolved.audioFormat;
    const audioFormat = downloadSettingsResolver.coerceAudioFormatForLayout({
      audioFormat: requested,
      subfolder: downloadSettingsResolver.predictFinalSubfolder({
        override: overrideSettings,
        channel,
        playlist,
        globalDefault: configModule.getDefaultSubfolder(),
      }),
      layoutOf,
    });
    return { audioFormat, downgraded: audioFormat !== requested };
  }

  async buildGroups(playlist, entries, overrideSettings = {}) {
    const [channelMap, layoutOf] = await Promise.all([
      this.loadChannelMap(entries.map((e) => e.channel_id)),
      getLayoutResolver(),
    ]);
    const groups = new Map();
    let downgraded = 0;

    for (const entry of entries) {
      const channel = entry.channel_id ? channelMap.get(entry.channel_id) || null : null;
      const resolved = downloadSettingsResolver.resolveCommandSettings({
        override: overrideSettings,
        channel,
        playlist,
        config: configModule.config,
      });
      const audio = this.resolveAudioFormat({ overrideSettings, resolved, channel, playlist, layoutOf });
      if (audio.downgraded) downgraded += 1;
      const { audioFormat } = audio;
      const { resolution, skipVideoFolder } = resolved;

      const key = JSON.stringify({ resolution, audioFormat, skipVideoFolder });
      if (!groups.has(key)) {
        groups.set(key, { resolution, audioFormat, skipVideoFolder, youtubeIds: [] });
      }
      groups.get(key).youtubeIds.push(entry.youtube_id);
    }

    if (downgraded > 0) {
      logger.warn({ playlistId: playlist.playlist_id, downgraded }, 'MP3 download type downgraded to video for videos saved to TV folders');
    }
    return Array.from(groups.values());
  }
}

module.exports = new PlaylistDownloadGrouper();
