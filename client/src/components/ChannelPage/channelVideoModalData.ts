import { ChannelVideo } from '../../types/ChannelVideo';
import { VideoModalData } from '../shared/VideoModal/types';
import { getVideoStatus } from '../../utils/videoStatus';

export function channelVideoToModalData(
  video: ChannelVideo,
  channelName: string,
  channelId: string | undefined
): VideoModalData {
  const status = getVideoStatus({ ...video, activity: undefined });
  return {
    youtubeId: video.youtube_id,
    title: video.title,
    channelName,
    thumbnailUrl: video.thumbnail,
    duration: video.duration,
    publishedAt: video.publishedAt || null,
    addedAt: null,
    mediaType: video.media_type || 'video',
    status,
    inArchive: video.inArchive,
    membersAccess: video.members_access ?? null,
    isDownloaded: video.added && !video.removed,
    filePath: video.filePath || null,
    fileSize: video.fileSize || null,
    audioFilePath: video.audioFilePath || null,
    audioFileSize: video.audioFileSize || null,
    isProtected: video.protected || false,
    isIgnored: video.ignored || false,
    normalizedRating: video.normalized_rating || null,
    ratingSource: video.rating_source || null,
    databaseId: video.id || null,
    channelId: channelId || null,
  };
}
