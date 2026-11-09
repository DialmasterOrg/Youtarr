// Best-effort backfill of title/channel onto failed-video records whose
// download died before any metadata reached jobs/info/ (so they are absent
// from videoData). Sources, in precedence order: videos, channelvideos
// (channel name via channels.uploader, then channels.title), playlistvideos,
// then YouTube's public oEmbed endpoint for ids the database has never seen
// (a brand-new upload that failed at extraction). Fills only missing fields
// and never throws: enrichment must not break job finalization.
const logger = require('../../logger');
const Video = require('../../models/video');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const PlaylistVideo = require('../../models/playlistvideo');
const videoOembedEnricher = require('../videoOembedEnricher');

// videoMetadataProcessor writes this placeholder into Videos rows when
// info.json has no uploader/channel field; never treat it as a real name.
const UNKNOWN_CHANNEL_PLACEHOLDER = 'Unknown Channel';

// oEmbed lookups are rate-limited to a few per second and run before the
// job's final status is broadcast, so a mass failure must not stall it.
const OEMBED_LOOKUP_LIMIT = 20;

function needsMetadata(video) {
  return Boolean(video && video.youtubeId && (!video.title || !video.channel));
}

function uniqueIds(videos) {
  return [...new Set(videos.map((video) => video.youtubeId))];
}

function applyMetadata(videos, metaById) {
  for (const video of videos) {
    const meta = metaById.get(video.youtubeId);
    if (!meta) continue;
    if (!video.title && meta.title) video.title = meta.title;
    if (!video.channel && meta.channel) video.channel = meta.channel;
  }
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

async function lookupOembedMetadata(youtubeIds) {
  const enriched = await videoOembedEnricher.enrichByIds(youtubeIds);
  const metaById = new Map();
  for (const [id, data] of Object.entries(enriched || {})) {
    metaById.set(id, { title: data.title, channel: data.channelName });
  }
  return metaById;
}

async function enrichFailedVideos(failedVideos = []) {
  const needing = failedVideos.filter(needsMetadata);
  if (needing.length === 0) return;

  try {
    const metaById = await lookupKnownMetadata(uniqueIds(needing));
    applyMetadata(needing, metaById);
  } catch (err) {
    logger.warn(
      { err, videoCount: needing.length },
      'Failed to enrich failed-video metadata; continuing with ids only'
    );
  }

  // Only a missing title sends a video to oEmbed: the title is what makes
  // a failed-video line readable, and a channel-only gap is rare.
  const untitled = needing.filter((video) => !video.title);
  if (untitled.length === 0) return;

  try {
    const ids = uniqueIds(untitled).slice(0, OEMBED_LOOKUP_LIMIT);
    const metaById = await lookupOembedMetadata(ids);
    applyMetadata(untitled, metaById);
  } catch (err) {
    logger.warn(
      { err, videoCount: untitled.length },
      'Failed to enrich failed-video metadata via oEmbed; continuing with ids only'
    );
  }
}

module.exports = { enrichFailedVideos, OEMBED_LOOKUP_LIMIT };
