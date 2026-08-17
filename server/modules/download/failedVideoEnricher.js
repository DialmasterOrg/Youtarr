// Best-effort backfill of title/channel onto failed-video records whose
// download died before any metadata reached jobs/info/ (so they are absent
// from videoData). Sources, in precedence order: videos, channelvideos
// (channel name via channels.uploader, then channels.title), playlistvideos.
// Fills only missing fields and never throws: enrichment must not break job
// finalization.
const logger = require('../../logger');
const Video = require('../../models/video');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const PlaylistVideo = require('../../models/playlistvideo');

// videoMetadataProcessor writes this placeholder into Videos rows when
// info.json has no uploader/channel field; never treat it as a real name.
const UNKNOWN_CHANNEL_PLACEHOLDER = 'Unknown Channel';

function needsMetadata(video) {
  return Boolean(video && video.youtubeId && (!video.title || !video.channel));
}

async function lookupKnownMetadata(youtubeIds) {
  const metaById = new Map();
  const setIfMissing = (id, field, value) => {
    if (!value) return;
    const entry = metaById.get(id) || {};
    if (!entry[field]) {
      entry[field] = value;
      metaById.set(id, entry);
    }
  };

  const [videos, channelVideos, playlistVideos] = await Promise.all([
    Video.findAll({
      where: { youtubeId: youtubeIds },
      attributes: ['youtubeId', 'youTubeVideoName', 'youTubeChannelName'],
      raw: true
    }),
    ChannelVideo.findAll({
      where: { youtube_id: youtubeIds },
      attributes: ['youtube_id', 'title', 'channel_id'],
      raw: true
    }),
    PlaylistVideo.findAll({
      where: { youtube_id: youtubeIds },
      attributes: ['youtube_id', 'title', 'channel_name'],
      raw: true
    })
  ]);

  for (const row of videos) {
    setIfMissing(row.youtubeId, 'title', row.youTubeVideoName);
    if (row.youTubeChannelName !== UNKNOWN_CHANNEL_PLACEHOLDER) {
      setIfMissing(row.youtubeId, 'channel', row.youTubeChannelName);
    }
  }

  const channelIds = [...new Set(channelVideos.map((row) => row.channel_id).filter(Boolean))];
  const channels = channelIds.length > 0
    ? await Channel.findAll({
      where: { channel_id: channelIds },
      attributes: ['channel_id', 'uploader', 'title'],
      raw: true
    })
    : [];
  const nameByChannelId = new Map(
    channels.map((row) => [row.channel_id, row.uploader || row.title])
  );

  for (const row of channelVideos) {
    setIfMissing(row.youtube_id, 'title', row.title);
    setIfMissing(row.youtube_id, 'channel', nameByChannelId.get(row.channel_id));
  }

  for (const row of playlistVideos) {
    setIfMissing(row.youtube_id, 'title', row.title);
    setIfMissing(row.youtube_id, 'channel', row.channel_name);
  }

  return metaById;
}

async function enrichFailedVideos(failedVideos = []) {
  const needing = failedVideos.filter(needsMetadata);
  if (needing.length === 0) return;

  try {
    const ids = [...new Set(needing.map((video) => video.youtubeId))];
    const metaById = await lookupKnownMetadata(ids);
    for (const video of needing) {
      const meta = metaById.get(video.youtubeId);
      if (!meta) continue;
      if (!video.title && meta.title) video.title = meta.title;
      if (!video.channel && meta.channel) video.channel = meta.channel;
    }
  } catch (err) {
    logger.warn(
      { err, videoCount: needing.length },
      'Failed to enrich failed-video metadata; continuing with ids only'
    );
  }
}

module.exports = { enrichFailedVideos };
