import { useCallback, useState } from 'react';
import axios from 'axios';

// The server accepts this many ids per request; larger selections are sent in batches.
export const MARK_DELETED_BATCH_SIZE = 1000;

export interface MarkDeletedOutcome {
  // How many videos were marked, counting the batches that succeeded.
  updated: number;
  // The server's message for the batch that failed, or null when every batch went through.
  error: string | null;
}

export interface UseMarkDeletedReturn {
  markDeleted: (videoIds: number[]) => Promise<MarkDeletedOutcome>;
  loading: boolean;
}

const FALLBACK_ERROR = 'Failed to mark videos as deleted';

function serverMessage(err: unknown): string {
  // The server answers 400/409/500 with { error }; anything else gets the fallback.
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' ? message : FALLBACK_ERROR;
}

export function useMarkDeleted(token: string | null): UseMarkDeletedReturn {
  const [loading, setLoading] = useState(false);

  const markDeleted = useCallback(async (videoIds: number[]): Promise<MarkDeletedOutcome> => {
    setLoading(true);
    let updated = 0;
    try {
      for (let start = 0; start < videoIds.length; start += MARK_DELETED_BATCH_SIZE) {
        const batch = videoIds.slice(start, start + MARK_DELETED_BATCH_SIZE);
        const response = await axios.post<{ updated: number }>(
          '/api/videos/mark-deleted',
          { videoIds: batch },
          { headers: { 'x-access-token': token ?? '' } }
        );
        updated += response.data.updated;
      }
      return { updated, error: null };
    } catch (err: unknown) {
      return { updated, error: serverMessage(err) };
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { markDeleted, loading };
}
