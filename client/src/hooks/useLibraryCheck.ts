import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { LibraryCheckResponse } from '../types/libraryCheck';
import type { LibraryLayout, PlexMappingChoice } from '../types/tvShows';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from './useLibraryFolders';
import { CONFIG_PATCHED_EVENT } from './useConfig';
import type { ConfigState } from '../components/Configuration/types';

const CHECK_FAILED_MESSAGE = 'Could not check the media server libraries';
const MAPPING_FAILED_MESSAGE = 'Could not save the Plex library mapping';

export interface UseLibraryCheckOptions {
  /** Only these library folders ('' = main folder); every folder when omitted */
  folders?: string[] | null;
  /** Check the given folders as this layout instead of their saved one (a preview of a layout change) */
  layout?: LibraryLayout | null;
  /** Skip the check (e.g. until the folders are known) */
  enabled?: boolean;
}

export interface UseLibraryCheckResult {
  data: LibraryCheckResponse | null;
  loading: boolean;
  error: string | null;
  /** Client time of the last successful check; kept when a refresh fails */
  lastCheckedAt: number | null;
  refetch: () => Promise<void>;
  /** Map a TV subfolder to the Plex library that holds it, then check again; throws with the server's message */
  applyPlexMapping: (folder: string, libraryId: string) => Promise<void>;
}

/** PUT /api/library-folders/plex-mapping */
interface PlexMappingResponse {
  mappedLibraryId: string;
  choice?: PlexMappingChoice;
  plexSubfolderLibraryMappings: ConfigState['plexSubfolderLibraryMappings'];
}

function serverMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

/** Which media server libraries hold each library folder, and what works against Youtarr there. */
export function useLibraryCheck(
  token: string | null,
  { folders = null, layout = null, enabled = true }: UseLibraryCheckOptions = {}
): UseLibraryCheckResult {
  const [data, setData] = useState<LibraryCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const requestSeq = useRef(0);
  const skipOwnEvent = useRef(false);
  const foldersKey = folders ? JSON.stringify(folders) : null;
  // A report is about the folders it was asked for: a new set starts from nothing.
  const reportedKey = useRef(foldersKey);

  const fetchCheck = useCallback(async () => {
    if (reportedKey.current !== foldersKey) {
      reportedKey.current = foldersKey;
      setData(null);
      setLastCheckedAt(null);
    }
    if (!token || !enabled) {
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (foldersKey) (JSON.parse(foldersKey) as string[]).forEach((folder) => params.append('folder', folder));
    if (foldersKey && layout) params.set('layout', layout);
    try {
      const response = await axios.get<LibraryCheckResponse>('/api/library-folders/check', {
        headers: { 'x-access-token': token },
        params,
      });
      if (seq === requestSeq.current) {
        setData(response.data);
        setLastCheckedAt(Date.now());
      }
    } catch (err: unknown) {
      if (seq === requestSeq.current) setError(serverMessage(err, CHECK_FAILED_MESSAGE));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, enabled, foldersKey, layout]);

  const applyPlexMapping = useCallback(async (folder: string, libraryId: string) => {
    if (!token) return;
    let saved: PlexMappingResponse;
    try {
      const response = await axios.put<PlexMappingResponse>(
        '/api/library-folders/plex-mapping',
        { folder, libraryId },
        { headers: { 'x-access-token': token } }
      );
      saved = response.data;
    } catch (err: unknown) {
      throw new Error(serverMessage(err, MAPPING_FAILED_MESSAGE));
    }
    // The mappings live in the config, which an open Settings page keeps a
    // copy of (and saves whole): hand it the saved list rather than reloading
    // it over the page's unsaved edits.
    const patch: Partial<ConfigState> = { plexSubfolderLibraryMappings: saved.plexSubfolderLibraryMappings };
    window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, { detail: patch }));
    // The folder list reads each folder's mapping. This instance checks once itself, awaited
    // so callers' spinners last until the refreshed check is in; its own listener skips this event.
    skipOwnEvent.current = true;
    window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
    skipOwnEvent.current = false;
    await fetchCheck();
  }, [token, fetchCheck]);

  useEffect(() => {
    fetchCheck();
    return () => {
      requestSeq.current += 1;
    };
  }, [fetchCheck]);

  useEffect(() => {
    const handler = () => {
      if (skipOwnEvent.current) return;
      fetchCheck();
    };
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
  }, [fetchCheck]);

  return { data, loading, error, lastCheckedAt, refetch: fetchCheck, applyPlexMapping };
}

export default useLibraryCheck;
