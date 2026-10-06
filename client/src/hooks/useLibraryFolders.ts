import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { LibraryFolder, LibraryFoldersResponse, LibraryLayout } from '../types/tvShows';
import { buildLayoutResolver, LayoutResolver } from '../utils/libraryLayouts';
import { SUBFOLDERS_UPDATED_EVENT } from './useSubfolders';
import { toRequestError } from '../components/shared/Reorganize/reorganizeErrors';

export const LIBRARY_FOLDERS_UPDATED_EVENT = 'library-folders-updated';

interface LibraryFolderChangeResponse extends LibraryFoldersResponse {
  changed: boolean;
}

export interface UseLibraryFoldersResult {
  folders: LibraryFolder[];
  loading: boolean;
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
export function useLibraryFolders(token: string | null): UseLibraryFoldersResult {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<LibraryFoldersResponse>('/api/library-folders', {
        headers: { 'x-access-token': token },
      });
      setFolders(Array.isArray(response.data?.folders) ? response.data.folders : []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load library folders'));
    } finally {
      setLoading(false);
    }
  }, [token]);

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
    if (Array.isArray(response.data?.folders)) setFolders(response.data.folders);
    window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
  }, [token]);

  useEffect(() => {
    fetchFolders();
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

  return { folders, loading, error, layoutOf, refetch: fetchFolders, setFolderLayout };
}

export default useLibraryFolders;
