import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { LibraryFolder, LibraryFolderInclude, LibraryFoldersResponse, LibraryLayout } from '../types/tvShows';
import { buildLayoutResolver, LayoutResolver } from '../utils/libraryLayouts';
import { SUBFOLDERS_UPDATED_EVENT } from './useSubfolders';
import { toRequestError } from '../components/shared/Reorganize/reorganizeErrors';

export const LIBRARY_FOLDERS_UPDATED_EVENT = 'library-folders-updated';

interface LibraryFolderChangeResponse extends LibraryFoldersResponse {
  changed: boolean;
}

export interface UseLibraryFoldersOptions {
  /** Ask for usage fields and/or the downloaded video count (the Library folders page, the Core card) */
  include?: LibraryFolderInclude[];
}

export interface UseLibraryFoldersResult {
  folders: LibraryFolder[];
  loading: boolean;
  /** The first answer (or failure) has arrived */
  loaded: boolean;
  error: string | null;
  /** Layout of a library folder ('' = main folder); videos until loaded */
  layoutOf: LayoutResolver;
  refetch: () => Promise<void>;
  /**
   * Change a folder's layout; throws with the server's refusal message, or a
   * ReorganizeRequiredError when the folder's files must move
   */
  setFolderLayout: (name: string, layout: LibraryLayout) => Promise<void>;
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

/** Library folders (main folder and subfolders) with their layouts. */
export function useLibraryFolders(
  token: string | null,
  { include }: UseLibraryFoldersOptions = {}
): UseLibraryFoldersResult {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const includeKey = include && include.length > 0 ? include.join(',') : '';
  // Only the latest request answers: overlapping refetches can finish out of order.
  const requestSeq = useRef(0);

  const fetchFolders = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<LibraryFoldersResponse>('/api/library-folders', {
        headers: { 'x-access-token': token },
        ...(includeKey ? { params: { include: includeKey } } : {}),
      });
      if (seq === requestSeq.current) setFolders(Array.isArray(response.data?.folders) ? response.data.folders : []);
    } catch (err) {
      if (seq === requestSeq.current) setError(errorMessage(err, 'Failed to load library folders'));
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [token, includeKey]);

  const setFolderLayout = useCallback(async (name: string, layout: LibraryLayout) => {
    if (!token) return;
    let response;
    try {
      response = await axios.put<LibraryFolderChangeResponse>(
        '/api/library-folders',
        { name, layout },
        { headers: { 'x-access-token': token } }
      );
    } catch (err) {
      throw toRequestError(err, 'Failed to change the folder layout');
    }
    // The PUT's list has no usage fields; with include, the event's refetch brings them.
    if (!includeKey && Array.isArray(response.data?.folders)) setFolders(response.data.folders);
    window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
  }, [token, includeKey]);

  useEffect(() => {
    fetchFolders();
    return () => { requestSeq.current += 1; };
  }, [fetchFolders]);

  useEffect(() => {
    const handler = () => { fetchFolders(); };
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
    window.addEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    return () => {
      window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
      window.removeEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    };
  }, [fetchFolders]);

  const layoutOf = useMemo(() => buildLayoutResolver(folders), [folders]);

  return { folders, loading, loaded, error, layoutOf, refetch: fetchFolders, setFolderLayout };
}

export default useLibraryFolders;
