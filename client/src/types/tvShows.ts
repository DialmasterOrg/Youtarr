import type { ChannelReorganizeState } from './reorganize';

/** Layout of a library folder: movie-style videos or TV shows. */
export type LibraryLayout = 'videos' | 'tv';

export type LibraryFolderInclude = 'usage' | 'files';
export type DeleteBlockerCode = 'channels' | 'disabledChannels' | 'playlists' | 'shows' | 'default' | 'files' | 'main';
export interface DeleteBlocker {
  code: DeleteBlockerCode;
  count?: number;
}
export type PlexMappingChoice = 'library' | 'default' | 'none';
/** The Plex library a folder's downloads refresh: a library, the default by choice, or no setting. */
export interface FolderPlexMapping {
  choice: PlexMappingChoice;
  libraryId: string | null;
}

/** A library folder from GET /api/library-folders. */
export interface LibraryFolder {
  /** '' for the main downloads folder, else the subfolder name without __ */
  name: string;
  layout: LibraryLayout;
  /** The default subfolder (the main folder when no default subfolder is set) */
  isDefault: boolean;
  /** Holds downloaded files: changing its layout moves them (the reorganize) */
  hasFiles: boolean;
  /** Enabled channels that download to this folder */
  channels: number;
  /** include=usage: enabled channels whose own setting names this folder */
  channelsChosen?: number;
  /** include=usage: enabled channels following the default folder into it (default folder only) */
  channelsFollowing?: number;
  /** include=usage: enabled playlists that download here by default */
  playlists?: number;
  /** include=usage: active title shows in this folder */
  titleShows?: number;
  /** include=usage: a layout change opens Review the move (the server's own guard rule) */
  layoutChangeNeedsReview?: boolean;
  /** include=usage: making it the default opens Review the move */
  makeDefaultNeedsReview?: boolean;
  plexMapping?: FolderPlexMapping;
  /** include=usage: every reason delete is refused, in guard order */
  deleteBlockers?: DeleteBlocker[];
  deletable?: boolean;
  /** include=files: downloaded videos whose file sits in this folder */
  fileCount?: number;
}

export interface LibraryFoldersResponse {
  folders: LibraryFolder[];
}

export interface LibraryFolderExample {
  channelName: string;
  title: string;
  youtubeId: string;
  /** ISO time; null when the info.json has neither timestamp nor upload date */
  uploadedAt: string | null;
  uploadedAtSource: 'timestamp' | 'upload_date' | null;
  /** The media file's path inside the folder, with / separators */
  relativePath: string;
}

/** GET /api/library-folders/folder/:key */
export interface LibraryFolderDetail {
  name: string;
  layout: LibraryLayout;
  channels: Array<{ channelId: string; name: string; videoCount: number }>;
  followers: { count: number; sample: string[] };
  playlists: Array<{ playlistId: string; name: string; videoCount: number }>;
  titleShows: Array<{ id: number; name: string; channelId: string; channelName: string; episodeCount: number }>;
  example: LibraryFolderExample | null;
}

/** POST /api/subfolders */
export interface CreateLibraryFolderResult {
  name: string;
  layout: LibraryLayout;
  created: boolean;
  existingContent?: boolean;
}

/** A channel's show, as stored on the server. */
export interface ChannelTvShow {
  name: string;
  folderName: string;
  libraryFolder: string;
  path: string;
}

/** GET /api/channels/:channelId/tv */
export interface ChannelTvState {
  layout: LibraryLayout;
  /** The library folder the channel downloads to ('' = main folder) */
  libraryFolder: string;
  /** The channel's show; null for a Videos channel or a TV channel before its first episode */
  show: ChannelTvShow | null;
  /** Library folders with the TV layout ('' = main folder) */
  tvFolders: string[];
  defaultFolder: string;
  defaultFolderLayout: LibraryLayout;
  /** Switching layouts moves the channel's files, reviewed in the reorganize preview */
  hasDownloads: boolean;
  /** Whether a reorganize is moving the channel's files, and videos one left unmoved */
  reorganize?: ChannelReorganizeState;
}

/** Episode details on a video in listing and detail responses. */
export interface EpisodeInfo {
  showName: string | null;
  season: number;
  episode: number;
  /** e.g. "S2024E03151200" or "S01E20" */
  code: string;
}
