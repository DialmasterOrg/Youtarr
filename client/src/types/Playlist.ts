export interface Playlist {
  id?: string;
  playlist_id: string;
  title: string;
  uploader: string;
  uploader_id?: string;
  url: string;
  description?: string;
  enabled: boolean;
  auto_download_enabled: boolean;
  folder_name?: string;
  sub_folder?: string | null;
  video_quality?: string | null;
  min_duration?: number | null;
  max_duration?: number | null;
  title_filter_regex?: string | null;
  audio_format?: string | null;
}

export interface PlaylistVideo {
  youtube_id: string;
  title: string;
  thumbnail: string;
  duration: number | null;
  publishedAt: string | null;
  playlist_index: number | null;
  added: boolean;
  media_type: string;
  ignored: boolean;
}
