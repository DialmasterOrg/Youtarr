import { useCallback, useState } from 'react';
import axios from 'axios';
import type { LibraryFoldersResponse } from '../../../types/tvShows';
import { CONFIG_PATCHED_EVENT } from '../../../hooks/useConfig';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { toRequestError } from '../../shared/Reorganize/reorganizeErrors';

function announceDefault(value: string) {
  window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, { detail: { defaultSubfolder: value } }));
  window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
}

/** PUT /api/library-folders/default, and reading the saved default back after a reorganize. */
export function useDefaultFolder(token: string | null) {
  const [saving, setSaving] = useState(false);

  const setDefaultFolder = useCallback(async (name: string): Promise<void> => {
    setSaving(true);
    try {
      const response = await axios.put<{ changed: boolean; defaultSubfolder: string }>(
        '/api/library-folders/default', { name }, { headers: { 'x-access-token': token || '' } }
      );
      announceDefault(response.data.defaultSubfolder);
    } catch (err: unknown) {
      throw toRequestError(err, 'Failed to change the default folder');
    } finally {
      setSaving(false);
    }
  }, [token]);

  // The server undoes a layout-changing switch when nothing could move.
  const readBackDefault = useCallback(async (): Promise<string | null> => {
    try {
      const response = await axios.get<LibraryFoldersResponse>('/api/library-folders', {
        headers: { 'x-access-token': token || '' },
      });
      const value = response.data.folders.find((folder) => folder.isDefault)?.name ?? '';
      announceDefault(value);
      return value;
    } catch {
      return null;
    }
  }, [token]);

  return { saving, setDefaultFolder, readBackDefault };
}
