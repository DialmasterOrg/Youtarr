/*export interface VideoData {
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  duration: number;
}*/

import type { RemovalReason } from '../utils/videoRemoval';

export interface VideoData {
  id: number;
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  timeCreated: string;
  originalDate: string | null;
  duration: number | null;
  description: string | null;
  filePath?: string | null;
  fileSize?: string | null;
  audioFilePath?: string | null;
  audioFileSize?: string | null;
  removed?: boolean;
  // Why the file is gone (see utils/videoRemoval): 'not_found' = missing, anything else = deleted
  removed_reason?: RemovalReason | null;
  removed_at?: string | null;
  removed_detail?: string | null;
  youtube_removed?: boolean;
  channel_id?: string | null;
  media_type?: string;
  normalized_rating?: string | null;
  rating_source?: string | null;
  protected?: boolean;
  // Actual downloaded pixel dimensions, e.g. "1920x1080"; "0x0" = probe failed
  video_resolution?: string | null;
  watchedBy?: string[];
}

export interface EnabledChannel {
  channel_id: string;
  uploader: string;
}

// Set when videos were not marked missing because the downloads folder looked
// unmounted (missing, empty, unreadable, or an empty __subfolder).
export interface LibraryWarning {
  reason: string;
  path: string;
  message: string;
  heldBack: number;
}

export interface PaginatedVideosResponse {
  videos: VideoData[];
  total: number;
  page: number;
  totalPages: number;
  channels: string[];
  enabledChannels: EnabledChannel[];
  // How many deleted videos the deleted filter hid; null unless it excludes them.
  hiddenDeletedCount?: number | null;
  libraryWarning?: LibraryWarning | null;
}
