/*export interface VideoData {
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  duration: number;
}*/

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
  removed?: boolean;
  youtube_removed?: boolean;
  channel_id?: string | null;
  media_type?: string;
}

export interface EnabledChannel {
  channel_id: string;
  uploader: string;
}

export interface PaginatedVideosResponse {
  videos: VideoData[];
  total: number;
  page: number;
  totalPages: number;
  channels: string[];
  enabledChannels: EnabledChannel[];
}
