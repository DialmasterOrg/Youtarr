import { useState, useEffect, useCallback } from 'react';

interface UseSubfoldersResult {
  subfolders: string[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching available subfolders from the API
 * @param token - Authentication token
 * @returns Object containing subfolders array, loading state, error, and refetch function
 */
export function useSubfolders(token: string | null): UseSubfoldersResult {
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubfolders = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/channels/subfolders', {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subfolders: ${response.statusText}`);
      }

      const data = await response.json();
      setSubfolders(data);
    } catch (err) {
      console.error('Failed to fetch subfolders:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSubfolders();
  }, [fetchSubfolders]);

  return {
    subfolders,
    loading,
    error,
    refetch: fetchSubfolders,
  };
}
