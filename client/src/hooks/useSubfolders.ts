import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const SUBFOLDERS_UPDATED_EVENT = 'subfolders-updated';

interface UseSubfoldersResult {
  subfolders: string[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createSubfolder: (name: string) => Promise<void>;
  deleteSubfolder: (name: string) => Promise<void>;
}

/** Pull the server's `{ error }` message off an Axios error, or fall back. */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

export function useSubfolders(token: string | null): UseSubfoldersResult {
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubfolders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<string[]>('/api/channels/subfolders', {
        headers: { 'x-access-token': token },
      });
      setSubfolders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch subfolders:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createSubfolder = useCallback(async (name: string) => {
    if (!token) return;
    try {
      await axios.post('/api/subfolders', { name }, { headers: { 'x-access-token': token } });
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to create subfolder'));
    }
    window.dispatchEvent(new Event(SUBFOLDERS_UPDATED_EVENT));
  }, [token]);

  const deleteSubfolder = useCallback(async (name: string) => {
    if (!token) return;
    try {
      await axios.delete(`/api/subfolders/${encodeURIComponent(name)}`, {
        headers: { 'x-access-token': token },
      });
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to delete subfolder'));
    }
    window.dispatchEvent(new Event(SUBFOLDERS_UPDATED_EVENT));
  }, [token]);

  useEffect(() => {
    fetchSubfolders();
  }, [fetchSubfolders]);

  useEffect(() => {
    const handler = () => { fetchSubfolders(); };
    window.addEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SUBFOLDERS_UPDATED_EVENT, handler);
  }, [fetchSubfolders]);

  return { subfolders, loading, error, refetch: fetchSubfolders, createSubfolder, deleteSubfolder };
}
