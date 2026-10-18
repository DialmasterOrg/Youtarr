import { useCallback, useState } from 'react';
import axios from 'axios';

export interface MarkDeletedResult {
  updated: number;
}

export interface UseMarkDeletedReturn {
  // Marks the missing videos among `videoIds` as deleted; resolves null on failure (see `error`).
  markDeleted: (videoIds: number[]) => Promise<MarkDeletedResult | null>;
  loading: boolean;
  error: string | null;
}

const FALLBACK_ERROR = 'Failed to mark videos as deleted';

export function useMarkDeleted(token: string | null): UseMarkDeletedReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markDeleted = useCallback(async (videoIds: number[]): Promise<MarkDeletedResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<MarkDeletedResult>(
        '/api/videos/mark-deleted',
        { videoIds },
        { headers: { 'x-access-token': token ?? '' } }
      );
      return response.data;
    } catch (err: unknown) {
      // The server answers 409/500 with { error }; anything else gets the fallback.
      const serverMessage = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      setError(typeof serverMessage === 'string' ? serverMessage : FALLBACK_ERROR);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { markDeleted, loading, error };
}
