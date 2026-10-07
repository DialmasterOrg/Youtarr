import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { LibraryFolderDetail } from '../../../types/tvShows';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { SUBFOLDERS_UPDATED_EVENT } from '../../../hooks/useSubfolders';
import { folderKey, folderRouteKey } from '../../../utils/libraryLayouts';
import { serverMessageOf } from '../../shared/Reorganize/reorganizeErrors';

/** GET /api/library-folders/folder/:key for the selected folder; refetched when folders change. */
export function useLibraryFolderDetail(token: string | null, name: string | null) {
  const [detail, setDetail] = useState<LibraryFolderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const fetchDetail = useCallback(async () => {
    const seq = ++requestSeq.current;
    // Never show one folder's detail under another.
    setDetail((current) => (current && name !== null && folderKey(current.name) === folderKey(name) ? current : null));
    if (!token || name === null) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<LibraryFolderDetail>(`/api/library-folders/folder/${folderRouteKey(name)}`, {
        headers: { 'x-access-token': token },
      });
      if (seq === requestSeq.current) setDetail(response.data);
    } catch (err: unknown) {
      if (seq === requestSeq.current) setError(serverMessageOf(err, 'Failed to load the library folder'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, name]);

  useEffect(() => {
    fetchDetail();
    return () => { requestSeq.current += 1; };
  }, [fetchDetail]);

  useEffect(() => {
    const handler = () => { fetchDetail(); };
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
    window.addEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    return () => {
      window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
      window.removeEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    };
  }, [fetchDetail]);

  return { detail, loading, error, refetch: fetchDetail };
}
