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
}

export interface PaginatedVideosResponse {
  videos: VideoData[];
  total: number;
  page: number;
  totalPages: number;
}
