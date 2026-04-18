import { VideoStatus } from '../../../utils/videoStatus';

export interface VideoModalData {
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number | null;
  publishedAt: string | null;
  addedAt: string | null;
  mediaType: string;
  status: VideoStatus;
  isDownloaded: boolean;
  filePath: string | null;
  fileSize: number | null;
  audioFilePath: string | null;
  audioFileSize: number | null;
  isProtected: boolean;
  isIgnored: boolean;
  normalizedRating: string | null;
  ratingSource: string | null;
  databaseId: number | null;
  channelId: string | null;
}

export interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  video: VideoModalData;
  token: string | null;
  onVideoDeleted?: (youtubeId: string) => void;
  onProtectionChanged?: (youtubeId: string, isProtected: boolean) => void;
  onIgnoreChanged?: (youtubeId: string, isIgnored: boolean) => void;
  onDownloadQueued?: (youtubeId: string) => void;
  onRatingChanged?: (youtubeId: string, rating: string | null) => void;
  allowIgnore?: boolean;
}

export interface VideoExtendedMetadata {
  description: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  tags: string[] | null;
  categories: string[] | null;
  uploadDate: string | null;
  resolution: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  aspectRatio: number | null;
  language: string | null;
  isLive: boolean | null;
  wasLive: boolean | null;
  availability: string | null;
  channelFollowerCount: number | null;
  ageLimit: number | null;
  webpageUrl: string | null;
  relatedFiles: VideoRelatedFile[] | null;
  availableResolutions: number[] | null;
  downloadedTier: number | null;
}

export interface VideoRelatedFile {
  fileName: string;
  fileSize: number;
  type: string;
}
