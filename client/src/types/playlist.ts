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
  youtube_removed: boolean;
  // Populated only for videos that have been downloaded; used to hydrate VideoModal
  video_id: number | null;
  file_path: string | null;
  file_size: number | null;
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
}

export interface PlaylistSyncState {
  server_type: 'plex' | 'jellyfin' | 'emby';
  server_playlist_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

export type MediaServerType = 'plex' | 'jellyfin' | 'emby';
