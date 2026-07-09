import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { SUBFOLDERS_UPDATED_EVENT } from './useSubfolders';

/** Where a subfolder is referenced, mirroring the server-side delete guard. */
export interface SubfolderUsage {
  channels: number;
  playlists: number;
  isDefault: boolean;
  plexMapped: boolean;
  hasFiles: boolean;
}

export interface SubfolderUsageItem {
  /** Clean name (no __ prefix) used for delete calls. */
  name: string;
  /** __-prefixed name for display. */
  displayName: string;
  usage: SubfolderUsage;
  deletable: boolean;
}

interface UseSubfolderUsageResult {
  items: SubfolderUsageItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch subfolders with their usage breakdown. Re-fetches on the
 * subfolder-updated event.
 */
export function useSubfolderUsage(token: string | null): UseSubfolderUsageResult {
  const [items, setItems] = useState<SubfolderUsageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<SubfolderUsageItem[]>('/api/subfolders', {
        headers: { 'x-access-token': token },
      });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch subfolder usage:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    const handler = () => { fetchUsage(); };
    window.addEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
  }, [fetchUsage]);

  return { items, loading, error, refetch: fetchUsage };
}
