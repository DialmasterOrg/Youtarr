// Saved output order for the .m3u file and media server playlist sync.
export type PlaylistSortOrderSetting = 'default' | 'reversed';

export interface Playlist {
  id: number;
  playlist_id: string;
  title: string;
  url: string;
  description: string | null;
  uploader: string | null;
  thumbnail: string | null;
  video_count: number;
  enabled: boolean;
  auto_download: boolean;
  sync_to_plex: boolean;
  sync_to_jellyfin: boolean;
  sync_to_emby: boolean;
  public_on_servers: boolean;
  sort_order: PlaylistSortOrderSetting;
  default_sub_folder: string | null;
  video_quality: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
  audio_format: string | null;
  default_rating: string | null;
  lastFetched: string | null;
}

export interface PlaylistVideo {
  id: number;
  playlist_id: string;
  youtube_id: string;
  position: number;
  added_at: string | null;
  channel_id: string | null;
  ignored: boolean;
  ignored_at: string | null;
  // Enriched on read by joining with Videos and channelvideos. Fall back to
  // YouTube's deterministic CDN URL for thumbnail when no local metadata exists.
  title: string | null;
  channel_name: string | null;
  duration: number | null;
  published_at: string | null;
  thumbnail: string | null;
  downloaded: boolean;
  // Previously downloaded but the file is gone (deleted/missing). The backend
  // skips these during downloads unless allowRedownload is set.
  previously_downloaded: boolean;
  youtube_removed: boolean;
  // Populated only for videos that have been downloaded; used to hydrate VideoModal
  video_id: number | null;
  file_path: string | null;
  file_size: number | null;
  audio_file_path: string | null;
  audio_file_size: number | null;
  // Actual downloaded pixel dimensions, e.g. "1920x1080"; "0x0" = probe failed
  video_resolution?: string | null;
  // Media server types with a played watch-status row for this video.
  watched_by?: string[];
}

export interface MediaServerStatus {
  plex: boolean;
  jellyfin: boolean;
  emby: boolean;
}

export interface PlaylistPreview {
  title: string;
  url: string;
  uploader: string | null;
  thumbnail: string | null;
  description: string | null;
  video_count: number;
  playlist_id: string;
}

export interface PlaylistSubscribeSettings {
  auto_download?: boolean;
  sync_to_plex?: boolean;
  sync_to_jellyfin?: boolean;
  sync_to_emby?: boolean;
  public_on_servers?: boolean;
  default_sub_folder?: string | null;
  video_quality?: string | null;
  min_duration?: number | null;
  max_duration?: number | null;
  title_filter_regex?: string | null;
  audio_format?: string | null;
  default_rating?: string | null;
  sort_order?: PlaylistSortOrderSetting;
}

export type MediaServerType = 'plex' | 'jellyfin' | 'emby';
