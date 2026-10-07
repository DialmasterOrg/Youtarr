import { createContext, useContext } from 'react';
import type { LibraryFolder, LibraryFolderDetail, LibraryLayout } from '../../types/tvShows';
import type { MediaServerType } from '../../types/libraryCheck';
import type { ReorganizeChange } from '../../types/reorganize';
import type { PlexLibrary } from '../../utils/plexLibraries';
import type { LibraryCheckState, ServerRef } from '../../utils/libraryAttention';
import type { ConfigState, PlatformManagedState, PlexConnectionStatus, SnackbarState } from '../Configuration/types';
import type { LayoutResult } from './hooks/useLayoutChange';
import type { ReorganizeHandoffContext } from './hooks/useReorganizeHandoff';

/** What every section of the Library folders page reads, so props don't drill through the inspector. */
export interface LibraryPageValue {
  token: string | null;
  config: ConfigState;
  isPlatformManaged: PlatformManagedState;
  timeZone: string | null;
  phone: boolean;
  /** Shelves and inspector side by side (content >= 1012px); else list and detail screens */
  twoColumn: boolean;
  folders: LibraryFolder[];
  /** The folder list's first answer (or failure) has arrived */
  foldersLoaded: boolean;
  /** The main folder's detail, loaded once for every section that lists its channels */
  mainDetail: LibraryFolderDetail | null;
  check: LibraryCheckState & {
    refetch: () => Promise<void>;
    applyPlexMapping: (folder: string, libraryId: string) => Promise<void>;
  };
  configuredServers: MediaServerType[];
  /** The media server status or the check has answered; until then nothing says no server is connected */
  serversKnown: boolean;
  /** The check's servers, else the configured ones */
  servers: ServerRef[];
  plexLibraries: PlexLibrary[];
  plexConnectionStatus: PlexConnectionStatus;
  reorganizing: boolean;
  /** folderKey of each folder a running reorganize moves */
  movingFolders: string[];
  layoutResult: LayoutResult | null;
  busyLayoutFolder: string | null;
  changeLayout: (name: string, target: LibraryLayout) => Promise<void>;
  selectFolder: (name: string) => void;
  openAddFolder: (layout: LibraryLayout) => void;
  openStartTv: () => void;
  openMainFolderTv: () => void;
  openMakeDefault: (folder: LibraryFolder) => void;
  openDelete: (folder: LibraryFolder) => void;
  reviewChange: (change: ReorganizeChange, context: ReorganizeHandoffContext) => void;
  /** Select a folder from the attention list; the inspector then scrolls to the server's card and takes focus */
  jumpTo: (folder: string, serverType?: MediaServerType) => void;
  focusTarget: { folder: string; serverType?: MediaServerType } | null;
  clearFocusTarget: () => void;
  /** A toast; success unless told otherwise */
  notify: (message: string, severity?: SnackbarState['severity']) => void;
}

const LibraryPageContext = createContext<LibraryPageValue | null>(null);

export const LibraryPageProvider = LibraryPageContext.Provider;

export function useLibraryPage(): LibraryPageValue {
  const value = useContext(LibraryPageContext);
  if (!value) throw new Error('useLibraryPage must be used inside the Library folders page');
  return value;
}
