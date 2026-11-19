import { MediaServerType, Playlist } from '../../types/playlist';

export const MAX_PLAYLIST_VIDEOS = 5000;
export const MAX_BATCH_SIZE = 1000;
export const DEFAULT_PREVIEW_COUNT = 5;
export const CANDIDATE_PAGE_SIZE = 100;

export const MEDIA_SERVERS: MediaServerType[] = ['plex', 'jellyfin', 'emby'];

export const MEDIA_SERVER_LABEL: Record<MediaServerType, string> = {
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

// The playlist field holding each server's per-playlist sync toggle.
export const MEDIA_SERVER_SYNC_KEY: Record<MediaServerType, keyof Playlist> = {
  plex: 'sync_to_plex',
  jellyfin: 'sync_to_jellyfin',
  emby: 'sync_to_emby',
};
