import type { ChannelReorganizeState } from './reorganize';

/** Layout of a library folder: movie-style videos or TV shows. */
export type LibraryLayout = 'videos' | 'tv';

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
}

export interface LibraryFoldersResponse {
  folders: LibraryFolder[];
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
