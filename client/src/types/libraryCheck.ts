import type { LibraryLayout } from './tvShows';

export type MediaServerType = 'plex' | 'jellyfin' | 'emby';

/** How a server library relates to a folder: points at it, at a parent folder, or inside it. */
export type LibraryRelation = 'exact' | 'covers' | 'inside';

export type LibraryCheckStatus = 'ok' | 'warning' | 'missing' | 'unreachable';

export interface LibraryCheckLibrary {
  id: string;
  name: string;
  type: 'videos' | 'tv' | 'mixed' | 'music' | 'other';
  /** The library's folder, as the server sees it */
  location: string;
  relation: LibraryRelation;
}

export interface LibraryCheckIssue {
  code: string;
  message: string;
  libraryId?: string;
}

export interface PlexMappingState {
  /** The library new downloads in this folder refresh, when a mapping exists */
  mappedLibraryId: string | null;
  /** The one Plex TV library that holds the folder */
  suggestedLibraryId: string | null;
}

export interface LibraryCheckServerReport {
  serverType: MediaServerType;
  status: LibraryCheckStatus;
  libraries: LibraryCheckLibrary[];
  issues: LibraryCheckIssue[];
  /** Plex only, TV subfolders only */
  plexMapping?: PlexMappingState;
}

export interface LibraryCheckFolder {
  /** '' for the main folder */
  name: string;
  layout: LibraryLayout;
  hasFiles: boolean;
  channels: number;
  servers: LibraryCheckServerReport[];
}

export interface LibraryCheckServer {
  serverType: MediaServerType;
  name: string;
  reachable: boolean;
  error: string | null;
}

/** GET /api/library-folders/check */
export interface LibraryCheckResponse {
  servers: LibraryCheckServer[];
  folders: LibraryCheckFolder[];
}
