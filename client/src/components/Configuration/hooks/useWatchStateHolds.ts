import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { WatchHold, WatchHoldsResponse } from '../../../types/reorganize';
import { serverMessageOf } from '../../shared/Reorganize/reorganizeErrors';

export interface UseWatchStateHoldsResult {
  holds: WatchHold[];
  counts: { pending: number; failed: number };
  loading: boolean;
  error: string | null;
  /** The restore a Retry or Dismiss is working on */
  busyId: number | null;
  retry: (id: number) => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

const EMPTY_COUNTS = { pending: 0, failed: 0 };

/** Watch-state restores a reorganize left for the media servers (GET /api/tv/holds). */
export function useWatchStateHolds(token: string | null): UseWatchStateHoldsResult {
  const [holds, setHolds] = useState<WatchHold[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchHolds = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get<WatchHoldsResponse>('/api/tv/holds', { headers: { 'x-access-token': token } });
      setHolds(Array.isArray(response.data?.holds) ? response.data.holds : []);
      setCounts(response.data?.counts ?? EMPTY_COUNTS);
      setError(null);
    } catch (err: unknown) {
      setError(serverMessageOf(err, 'Failed to load watch state restores'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHolds();
  }, [fetchHolds]);

  const act = useCallback(async (id: number, action: 'retry' | 'dismiss', failure: string) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await axios.post(`/api/tv/holds/${id}/${action}`, undefined, { headers: { 'x-access-token': token } });
      await fetchHolds();
    } catch (err: unknown) {
      setError(serverMessageOf(err, failure));
    } finally {
      setBusyId(null);
    }
  }, [token, fetchHolds]);

  const retry = useCallback((id: number) => act(id, 'retry', 'Failed to retry the restore'), [act]);
  const dismiss = useCallback((id: number) => act(id, 'dismiss', 'Failed to dismiss the restore'), [act]);

  return { holds, counts, loading, error, busyId, retry, dismiss, refetch: fetchHolds };
}

export default useWatchStateHolds;
