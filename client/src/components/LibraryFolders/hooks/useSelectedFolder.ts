import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { LibraryFolder } from '../../../types/tvShows';
import { LIBRARY_FOLDERS_PATH, folderFromRouteKey, folderKey, libraryFolderUrl } from '../../../utils/libraryLayouts';

export interface LibraryRouteState {
  /** The list was opened before this detail screen, so Back can return in history */
  fromList?: boolean;
  /** A folder URL that matched no folder */
  missingFolder?: string;
}

export interface UseSelectedFolderOptions {
  folders: LibraryFolder[];
  loaded: boolean;
  /** A refetch is running: the list may not hold a folder created a moment ago */
  loading?: boolean;
  /** The last load failed: an empty list says nothing about a folder */
  error?: string | null;
  /** null until the page is measured */
  twoColumn: boolean | null;
}

/**
 * The folder the URL selects (/settings/library/:folder, ~main for the main
 * folder). Two columns select the default folder for the bare URL, once, and
 * never reselect on their own; list/detail pushes the detail so Back returns.
 */
export function useSelectedFolder({ folders, loaded, loading = false, error = null, twoColumn }: UseSelectedFolderOptions) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as LibraryRouteState | null;
  const routeKey = params['*'] || '';
  const requested = routeKey ? folderFromRouteKey(routeKey) : null;
  const selected = requested === null ? null : folders.find((folder) => folderKey(folder.name) === folderKey(requested)) ?? null;

  useEffect(() => {
    if (!loaded || loading || error) return;
    if (requested !== null && !selected) {
      navigate(LIBRARY_FOLDERS_PATH, { replace: true, state: { missingFolder: requested } });
      return;
    }
    if (requested === null && twoColumn === true) {
      const fallback = folders.find((folder) => folder.isDefault) ?? folders[0];
      if (fallback) navigate(libraryFolderUrl(fallback.name), { replace: true, state });
    }
  }, [loaded, loading, error, requested, selected, twoColumn, folders, navigate, state]);

  const select = useCallback((name: string) => {
    if (twoColumn) navigate(libraryFolderUrl(name), { replace: true });
    else navigate(libraryFolderUrl(name), { state: { fromList: true } });
  }, [navigate, twoColumn]);

  const backToList = useCallback(() => {
    if (state?.fromList) navigate(-1);
    else navigate(LIBRARY_FOLDERS_PATH);
  }, [navigate, state]);

  // After a delete: return to the list without leaving the deleted folder's entry behind.
  const leaveFolder = useCallback(() => {
    if (state?.fromList) navigate(-1);
    else navigate(LIBRARY_FOLDERS_PATH, { replace: true });
  }, [navigate, state]);

  const dismissMissing = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { ...state, missingFolder: undefined } });
  }, [navigate, location.pathname, location.search, state]);

  return { selected, missingName: state?.missingFolder ?? null, dismissMissing, select, backToList, leaveFolder };
}
