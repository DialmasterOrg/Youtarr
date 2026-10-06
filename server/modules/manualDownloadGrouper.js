const Video = require('../models/video');
const ChannelVideo = require('../models/channelvideo');
const configModule = require('./configModule');
const logger = require('../logger');
const playlistDownloadGrouper = require('./playlistDownloadGrouper');
const downloadSettingsResolver = require('./download/downloadSettingsResolver');
const youtubeUrlParser = require('./youtubeUrlParser');
const { getLayoutResolver } = require('./tvShows/libraryLayouts');

/**
 * Buckets manually pasted URLs by their resolved pre-download settings
 * (resolution, audioFormat) so each bucket shares one yt-dlp invocation and
 * tracked channels' settings apply per video. Per-URL attribution priority:
 * videoChannelMap entry (validation-captured channelId; server cache merged
 * over the client echo upstream) -> videos.channel_id (previous download) ->
 * channelvideos listers. Only tracked AND enabled channels contribute
 * settings, mirroring finalize-time routing. File structure and routing
 * settings (subfolder, rating) are intentionally not resolved here; they
 * resolve per-video at finalize. See downloadSettingsResolver and
 * videoDownloadPostProcessFiles. The one exception is the destination's
 * layout: TV folders are video-only, so an MP3 type is downgraded for URLs
 * whose predicted folder is TV.
 */
class ManualDownloadGrouper {
  extractYoutubeId(url) {
    try {
      return youtubeUrlParser.normalizeUrlToVideoId(url).id;
    } catch (err) {
      return null;
    }
  }

  async buildGroups({ urls, overrideSettings = {}, videoChannelMap = null }) {
    const claimed = videoChannelMap && typeof videoChannelMap === 'object' ? videoChannelMap : {};
    const idByUrl = new Map(urls.map((url) => [url, this.extractYoutubeId(url)]));
    const ids = [...new Set([...idByUrl.values()].filter(Boolean))];

    const [videoRows, listerRows] = ids.length
      ? await Promise.all([
        Video.findAll({ where: { youtubeId: ids }, attributes: ['youtubeId', 'channel_id'] }),
        ChannelVideo.findAll({ where: { youtube_id: ids }, attributes: ['youtube_id', 'channel_id'] }),
      ])
      : [[], []];

    const ownChannelById = new Map();
    for (const row of videoRows) {
      if (row.channel_id) ownChannelById.set(row.youtubeId, row.channel_id);
    }
    const listersById = new Map();
    for (const row of listerRows) {
      if (!row.channel_id) continue;
      if (!listersById.has(row.youtube_id)) listersById.set(row.youtube_id, []);
      listersById.get(row.youtube_id).push(row.channel_id);
    }

    const candidatesFor = (id) =>
      [claimed[id], ownChannelById.get(id), ...(listersById.get(id) || [])].filter(Boolean);

    const allCandidates = [...new Set(ids.flatMap(candidatesFor))];
    const [channelMap, layoutOf] = await Promise.all([
      playlistDownloadGrouper.loadChannelMap(allCandidates),
      getLayoutResolver(),
    ]);

    const groups = new Map();
    let downgraded = 0;
    for (const url of urls) {
      const id = idByUrl.get(url);
      const ownerId = id ? candidatesFor(id).find((candidate) => channelMap.has(candidate)) : undefined;
      const channel = ownerId ? channelMap.get(ownerId) : null;
      const resolved = downloadSettingsResolver.resolveCommandSettings({
        override: overrideSettings,
        channel,
        playlist: {},
        config: configModule.config,
      });
      const audio = playlistDownloadGrouper.resolveAudioFormat({
        overrideSettings, resolved, channel, playlist: {}, layoutOf,
      });
      if (audio.downgraded) downgraded += 1;
      const { audioFormat } = audio;
      const { resolution } = resolved;
      const key = JSON.stringify({ resolution, audioFormat });
      if (!groups.has(key)) {
        groups.set(key, { resolution, audioFormat, urls: [] });
      }
      groups.get(key).urls.push(url);
    }
    if (downgraded > 0) {
      logger.warn({ downgraded }, 'MP3 download type downgraded to video for URLs saved to TV folders');
    }
    return Array.from(groups.values());
  }
}

module.exports = new ManualDownloadGrouper();
