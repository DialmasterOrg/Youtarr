import type { LibraryLayout } from '../../types/tvShows';
import type { MediaServerType } from '../../types/libraryCheck';

/** Library type names and setup rows per server and layout (UI 5.7.2.4), shared by the inspector, Add folder and the panel. */

export type SetupServer = MediaServerType | 'kodi';

export const SETUP_SERVER_NAMES: Record<SetupServer, string> = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby', kodi: 'Kodi' };

export const LIBRARY_TYPE_NAMES: Record<SetupServer, Record<LibraryLayout, string>> = {
  plex: { videos: 'Other Videos', tv: 'TV Shows' },
  jellyfin: { videos: 'Movies', tv: 'Shows' },
  emby: { videos: 'Movies', tv: 'TV shows' },
  kodi: { videos: 'Movies source', tv: 'TV shows source' },
};

/** The library type text when no server is connected (UI 5.6 column header). */
export const GENERIC_LIBRARY_TYPES: Record<LibraryLayout, string> = {
  videos: 'Plex Other Videos, Jellyfin or Emby Movies, Kodi Movies source',
  tv: 'Plex TV Shows, Jellyfin Shows, Emby TV shows, Kodi TV shows source',
};

export function libraryTypeName(server: SetupServer, layout: LibraryLayout): string {
  return LIBRARY_TYPE_NAMES[server][layout];
}

/** "Plex Other Videos" */
export function serverLibraryType(server: SetupServer, layout: LibraryLayout): string {
  return `${SETUP_SERVER_NAMES[server]} ${libraryTypeName(server, layout)}`;
}

/** A folder's path under a server's downloads folder, keeping the server's separator. */
export function joinServerPath(base: string, folder: string): string {
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  const trimmed = base.length > 1 ? base.replace(/[\\/]+$/, '') : base;
  if (!folder) return trimmed;
  return trimmed.endsWith(separator) ? `${trimmed}__${folder}` : `${trimmed}${separator}__${folder}`;
}

export interface ServerPath {
  text: string;
  /** A real path (copy button), not a description */
  copyable: boolean;
}

export function folderServerPath(folder: string, downloadsPath: string | null | undefined, serverName: string): ServerPath {
  if (downloadsPath) return { text: joinServerPath(downloadsPath, folder), copyable: true };
  return {
    text: folder ? `__${folder} in your downloads folder, as ${serverName} sees it` : `Your downloads folder, as ${serverName} sees it`,
    copyable: false,
  };
}

export interface SetupRow {
  key: string;
  value: string;
  /** The Folder row: its path, with a copy button when real */
  path?: ServerPath;
}

export function setupRows(server: SetupServer, layout: LibraryLayout, path: ServerPath): SetupRow[] {
  const folder: SetupRow = { key: `Folder (as ${SETUP_SERVER_NAMES[server]} sees it)`, value: path.text, path };
  const row = (key: string, value: string): SetupRow => ({ key, value });
  switch (`${server}:${layout}`) {
    case 'plex:tv':
      return [row('Library type', 'TV Shows'), folder, row('Scanner', 'Plex TV Series'),
        row('Agent', 'Plex NFO Series or Personal Media'), row('Advanced', 'Use local assets: on')];
    case 'plex:videos':
      return [row('Library type', 'Other Videos'), folder, row('Agent', 'Plex Personal Media')];
    case 'jellyfin:tv':
      return [row('Content type', 'Shows'), folder, row('Metadata savers', 'Nfo: off'), row('Downloaders', 'All off'),
        row('Image fetchers', 'All off')];
    case 'jellyfin:videos':
      return [row('Content type', 'Movies'), folder, row('Downloaders', 'All off'), row('Image fetchers', 'TheMovieDb and OMDb off')];
    case 'emby:tv':
      return [row('Content type', 'TV shows'), folder, row('Metadata readers', 'Nfo: on'), row('Metadata savers', 'Nfo: off'),
        row('Downloaders and image fetchers', 'All off')];
    case 'emby:videos':
      return [row('Content type', 'Movies'), folder, row('Downloaders', 'All off')];
    case 'kodi:tv':
      return [row('Source type', 'TV shows'), folder, row('Information provider', 'Local information only')];
    default:
      return [row('Source type', 'Movies'), folder];
  }
}
