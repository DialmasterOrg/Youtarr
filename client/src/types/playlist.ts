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
  auto_download_baseline_at?: string | null;
  auto_download_baseline_id?: number | null;
  auto_download_setup_error?: 'PLAYLIST_TOO_LARGE' | 'PLAYLIST_REFRESH_INCOMPLETE' | null;
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
  activity?: 'queued' | 'downloading';
  id: number;
  playlist_id: string;
  youtube_id: string;
  position: number;
  /** @deprecated Compatibility alias for first_seen_at. */
  added_at?: string | null;
  first_seen_at?: string | null;
  downloaded_at?: string | null;
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
  availability?: string;
  members_only_access?: 'access_confirmed' | 'access_denied' | 'access_unchecked' | 'no_cookies' | 'public';
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

/** A playlist Youtarr has saved before, as reported by the add-playlist preview. */
export interface PlaylistExistingSubscription {
  /** True when the playlist is subscribed now; false when it was removed and can be restored. */
  enabled: boolean;
  settings: {
    auto_download: boolean | null;
    default_sub_folder: string | null;
    video_quality: string | null;
    audio_format: string | null;
  };
}

export interface PlaylistPreview {
  title: string;
  url: string;
  uploader: string | null;
  thumbnail: string | null;
  description: string | null;
  video_count: number;
  playlist_id: string;
  existing_subscription?: PlaylistExistingSubscription | null;
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
