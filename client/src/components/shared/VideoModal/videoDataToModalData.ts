import { VideoData } from '../../../types/VideoData';
import { removalFromRow, removedState } from '../../../utils/videoRemoval';
import { VideoModalData } from './types';

interface MapOptions {
  // Download History lists videos that never finished downloading, so there a
  // row counts as downloaded only once it has a file path.
  requireFile?: boolean;
}

// A library row (the Videos page, a job's videos) in the shape the video modal takes.
export function videoDataToModalData(video: VideoData, { requireFile = false }: MapOptions = {}): VideoModalData {
  const isDownloaded = !video.removed && (!requireFile || Boolean(video.filePath || video.audioFilePath));
  const presentStatus = isDownloaded ? 'downloaded' : 'never_downloaded';
  return {
    youtubeId: video.youtubeId,
    title: video.youTubeVideoName,
    channelName: video.youTubeChannelName,
    thumbnailUrl: `/images/videothumb-${video.youtubeId}.jpg`,
    duration: video.duration,
    publishedAt: video.originalDate || null,
    addedAt: video.timeCreated || null,
    mediaType: video.media_type || 'video',
    status: video.removed ? removedState(video.removed_reason) : presentStatus,
    removal: removalFromRow(video),
    isDownloaded,
    filePath: video.filePath || null,
    fileSize: video.fileSize ? Number(video.fileSize) : null,
    audioFilePath: video.audioFilePath || null,
    audioFileSize: video.audioFileSize ? Number(video.audioFileSize) : null,
    isProtected: video.protected || false,
    isIgnored: false,
    normalizedRating: video.normalized_rating || null,
    ratingSource: video.rating_source || null,
    databaseId: video.id,
    channelId: video.channel_id || null,
  };
}
