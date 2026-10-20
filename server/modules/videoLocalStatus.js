const { Video, Channel } = require('../models');
const { findArchiveOnlyIds } = require('./archiveOnlyIds');
const { REMOVAL_STATES, removalState } = require('./videoRemovalState');

const toIso = (value) => (value ? new Date(value).toISOString() : null);

// Search results carry a channelId; the local-status endpoint's do not, so the
// flag is only set where it can be answered and a refresh never clears it.
async function applyChannelSubscribed(results) {
  const withChannel = results.filter(r => typeof r.channelId === 'string' && r.channelId);
  if (withChannel.length === 0) return;
  const channelIds = [...new Set(withChannel.map(r => r.channelId))];
  const enabled = await Channel.findAll({
    where: { channel_id: channelIds, enabled: true },
    attributes: ['channel_id'],
  });
  const subscribed = new Set(enabled.map(c => c.channel_id));
  for (const r of withChannel) {
    r.channelSubscribed = subscribed.has(r.channelId);
  }
}

async function applyLocalVideoStatus(results) {
  const youtubeIds = results.map(r => r.youtubeId).filter(Boolean);
  if (youtubeIds.length === 0) return;
  await applyChannelSubscribed(results);
  const existing = await Video.findAll({
    where: { youtubeId: youtubeIds },
    attributes: [
      'id',
      'youtubeId',
      'removed',
      'removed_reason',
      'removed_at',
      'removed_detail',
      'filePath',
      'fileSize',
      'audioFilePath',
      'audioFileSize',
      'last_downloaded_at',
      'protected',
      'normalized_rating',
      'rating_source',
    ],
  });
  const recordByYoutubeId = new Map(existing.map(v => [v.youtubeId, v]));
  const archiveOnlyIds = await findArchiveOnlyIds(
    youtubeIds.filter(id => !recordByYoutubeId.has(id))
  );
  for (const r of results) {
    r.inArchive = archiveOnlyIds.has(r.youtubeId);
    const record = recordByYoutubeId.get(r.youtubeId);
    if (!record) continue;
    const state = removalState(record);
    r.status = state === REMOVAL_STATES.PRESENT ? 'downloaded' : state;
    r.removedReason = record.removed_reason ?? null;
    r.removedAt = toIso(record.removed_at);
    r.removedDetail = record.removed_detail ?? null;
    r.databaseId = record.id;
    r.filePath = record.filePath;
    r.fileSize = record.fileSize;
    r.audioFilePath = record.audioFilePath;
    r.audioFileSize = record.audioFileSize;
    r.addedAt = record.last_downloaded_at ? new Date(record.last_downloaded_at).toISOString() : null;
    r.isProtected = Boolean(record.protected);
    r.normalizedRating = record.normalized_rating;
    r.ratingSource = record.rating_source;
  }
}

module.exports = { applyLocalVideoStatus };
