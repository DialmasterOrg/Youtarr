import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ReorganizeChange, ReorganizePreview } from '../../../../types/reorganize';
import { serverMessageOf } from '../reorganizeErrors';

// A preview held up by a task that ends on its own (a download, a sync) is
// computed again until the task ends, so the move can start without
// reopening the dialog. Nothing ends a 'problems' refusal.
export const BLOCKED_RECHECK_MS = 5000;
const PROBLEMS_REASON = 'problems';

export interface UseReorganizePreviewResult {
  preview: ReorganizePreview | null;
  loading: boolean;
  error: string | null;
  /** Compute the preview again (after a stale-preview refusal, or a retry) */
  refresh: () => Promise<void>;
}

/** The dry run of a reorganize: what would move where. Nothing is written. */
export function useReorganizePreview(token: string | null, change: ReorganizeChange | null): UseReorganizePreviewResult {
  const [preview, setPreview] = useState<ReorganizePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may set state.
  const requestSeq = useRef(0);
  const changeKey = change ? JSON.stringify(change) : null;

  const fetchPreview = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!token || !changeKey) return;
    const seq = ++requestSeq.current;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await axios.post<ReorganizePreview>(
        '/api/tv/reorganize/preview',
        { change: JSON.parse(changeKey) },
        { headers: { 'x-access-token': token } }
      );
      if (seq === requestSeq.current) setPreview(response.data);
    } catch (err: unknown) {
      // A failed recheck keeps the preview on screen.
      if (seq === requestSeq.current && !quiet) {
        setPreview(null);
        setError(serverMessageOf(err, 'Failed to preview the move'));
      }
    } finally {
      // Also ends a full load this recheck overtook.
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, changeKey]);

  useEffect(() => {
    setPreview(null);
    fetchPreview();
    return () => {
      requestSeq.current += 1;
    };
  }, [fetchPreview]);

  const blockedReason = preview?.blocked?.reason ?? null;
  // Each recheck arms the next one once it has settled, so a failed recheck
  // (which leaves the preview as it was) doesn't end the polling.
  const [recheckTick, setRecheckTick] = useState(0);
  useEffect(() => {
    if (!blockedReason || blockedReason === PROBLEMS_REASON) return undefined;
    const timer = setTimeout(() => {
      fetchPreview({ quiet: true }).finally(() => setRecheckTick((tick) => tick + 1));
    }, BLOCKED_RECHECK_MS);
    return () => clearTimeout(timer);
  }, [recheckTick, blockedReason, fetchPreview]);

  const refresh = useCallback(() => fetchPreview(), [fetchPreview]);

  return { preview, loading, error, refresh };
}

export default useReorganizePreview;
