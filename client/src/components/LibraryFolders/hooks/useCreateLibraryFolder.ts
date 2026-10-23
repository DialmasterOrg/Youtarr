import { useCallback, useState } from 'react';
import axios from 'axios';
import type { CreateLibraryFolderResult, LibraryLayout } from '../../../types/tvShows';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { SUBFOLDERS_UPDATED_EVENT } from '../../../hooks/useSubfolders';
import { isReorganizeRequired, toRequestError } from '../../shared/Reorganize/reorganizeErrors';

function announceFolders() {
  window.dispatchEvent(new Event(SUBFOLDERS_UPDATED_EVENT));
  window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
}

/** POST /api/subfolders { name, layout }: creates the directory and registers the folder. */
export function useCreateLibraryFolder(token: string | null) {
  const [creating, setCreating] = useState(false);

  const createFolder = useCallback(async (name: string, layout: LibraryLayout): Promise<CreateLibraryFolderResult> => {
    setCreating(true);
    try {
      const response = await axios.post<CreateLibraryFolderResult>('/api/subfolders', { name, layout }, {
        headers: { 'x-access-token': token || '' },
      });
      announceFolders();
      return response.data;
    } catch (err: unknown) {
      const error = toRequestError(err, 'Failed to create the folder');
      // The folder exists as Videos; its move to TV goes through the review.
      if (isReorganizeRequired(error)) announceFolders();
      throw error;
    } finally {
      setCreating(false);
    }
  }, [token]);

  return { creating, createFolder };
}
