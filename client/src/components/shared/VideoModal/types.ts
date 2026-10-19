import { VideoStatus } from '../../../utils/videoStatus';
import type { RemovalInfo } from '../../../utils/videoRemoval';

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
  // Listed in the download archive without a database record. Pages that know
  // it pass it in; the modal's local status lookup then keeps it current.
  inArchive?: boolean;
  // Why the file is gone, for a 'deleted' or 'missing' status (see utils/videoRemoval).
  removal?: RemovalInfo | null;
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
  // A missing video was marked as deleted from the modal.
  onMarkedDeleted?: (youtubeId: string) => void;
  onProtectionChanged?: (youtubeId: string, isProtected: boolean) => void;
  onIgnoreChanged?: (youtubeId: string, isIgnored: boolean) => void;
  onDownloadQueued?: (youtubeId: string) => void;
  onRatingChanged?: (youtubeId: string, rating: string | null) => void;
  onAvailabilityDetected?: (youtubeId: string, availability: string) => void;
  onPublishedDateDetected?: (youtubeId: string, isoDate: string) => void;
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
}

export interface VideoRelatedFile {
  fileName: string;
  fileSize: number;
  type: string;
}
