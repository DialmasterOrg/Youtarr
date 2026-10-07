import { useCallback, useState } from 'react';
import axios from 'axios';
import type { PlexMappingChoice } from '../../../types/tvShows';
import type { ConfigState } from '../../Configuration/types';
import { CONFIG_PATCHED_EVENT } from '../../../hooks/useConfig';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { serverMessageOf } from '../../shared/Reorganize/reorganizeErrors';

export const PLEX_MAPPING_SAVE_ERROR = 'Could not save the Plex library mapping.';

interface PlexRefreshMappingResponse {
  mappedLibraryId: string | null;
  choice: PlexMappingChoice;
  plexSubfolderLibraryMappings: ConfigState['plexSubfolderLibraryMappings'];
}

/** The Plex library a folder's downloads refresh: set (replace mode), explicit default (null), or removed. */
export function usePlexRefreshMapping(token: string | null) {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (request: () => Promise<{ data: PlexRefreshMappingResponse }>) => {
    setSaving(true);
    try {
      const { data } = await request();
      window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, {
        detail: { plexSubfolderLibraryMappings: data.plexSubfolderLibraryMappings },
      }));
      window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
    } catch (err: unknown) {
      throw new Error(serverMessageOf(err, PLEX_MAPPING_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  }, []);

  const setMapping = useCallback((folder: string, libraryId: string | null) => save(() => axios.put<PlexRefreshMappingResponse>(
    '/api/library-folders/plex-mapping', { folder, libraryId, replace: true }, { headers: { 'x-access-token': token || '' } }
  )), [save, token]);

  const removeMapping = useCallback((folder: string) => save(() => axios.delete<PlexRefreshMappingResponse>(
    '/api/library-folders/plex-mapping', { headers: { 'x-access-token': token || '' }, params: { folder } }
  )), [save, token]);

  return { saving, setMapping, removeMapping };
}
