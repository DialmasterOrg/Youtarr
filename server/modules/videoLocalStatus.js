const { Video } = require('../models');
const ChannelVideo = require('../models/channelvideo');
const archiveModule = require('./archiveModule');

// IDs yt-dlp would skip as already downloaded even though no Videos row
// exists. Ignored videos are left out: ignoring writes the archive entry on
// purpose, and an explicit download removes it again.
async function findArchiveOnlyIds(youtubeIds) {
  const archived = archiveModule.filterArchivedVideoIds(youtubeIds);
  if (archived.size === 0) return archived;
  const ignored = await ChannelVideo.findAll({
    where: { youtube_id: [...archived], ignored: true },
    attributes: ['youtube_id'],
  });
  for (const row of ignored) archived.delete(row.youtube_id);
  return archived;
}

async function applyLocalVideoStatus(results) {
  const youtubeIds = results.map(r => r.youtubeId).filter(Boolean);
  if (youtubeIds.length === 0) return;
  const existing = await Video.findAll({
    where: { youtubeId: youtubeIds },
    attributes: [
      'id',
      'youtubeId',
      'removed',
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
    r.status = record.removed ? 'missing' : 'downloaded';
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
