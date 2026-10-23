import { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } from './channelHelpers';
import { LibraryFolder, LibraryLayout } from '../types/tvShows';

export type LayoutResolver = (libraryFolder: string) => LibraryLayout;

/** Every folder is a Videos folder until the folder list has loaded. */
export const VIDEOS_EVERYWHERE: LayoutResolver = () => 'videos';

/**
 * Library folder ('' = main folder) a sub_folder value saves into. Mirrors
 * the server's resolveEffectiveSubfolder: the global default sentinel follows
 * the default subfolder, root and empty values mean the main folder.
 */
export function effectiveLibraryFolder(
  subFolderValue: string | null | undefined,
  defaultSubfolder: string | null | undefined
): string {
  if (subFolderValue === ROOT_SENTINEL) return '';
  if (subFolderValue === GLOBAL_DEFAULT_SENTINEL) return (defaultSubfolder || '').trim();
  return (subFolderValue || '').trim();
}

/** Resolver over the folder list, comparing names ignoring case like the server. */
export function buildLayoutResolver(folders: LibraryFolder[]): LayoutResolver {
  const layouts = new Map(folders.map((folder) => [folder.name.trim().toLowerCase(), folder.layout]));
  return (libraryFolder) => layouts.get((libraryFolder || '').trim().toLowerCase()) || 'videos';
}

/** Comparison key for a library folder name ('' = main folder), ignoring case like the server. */
export function folderKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

/** "Main folder" or "__Name". */
export function libraryFolderLabel(name: string): string {
  return name ? `__${name}` : 'Main folder';
}

/** Route key of the main folder in /settings/library/:folder; `~` can't appear in a subfolder name. */
export const MAIN_FOLDER_ROUTE_KEY = '~main';
export const LIBRARY_FOLDERS_PATH = '/settings/library';

export function folderRouteKey(name: string): string {
  return name ? encodeURIComponent(name) : MAIN_FOLDER_ROUTE_KEY;
}

/** The folder a route key names ('' = main folder). Router params may arrive decoded or not. */
export function folderFromRouteKey(key: string): string {
  if (key === MAIN_FOLDER_ROUTE_KEY) return '';
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function libraryFolderUrl(name: string): string {
  return `${LIBRARY_FOLDERS_PATH}/${folderRouteKey(name)}`;
}
