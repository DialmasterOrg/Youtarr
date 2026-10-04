import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ReorganizeChange, ReorganizePreview } from '../../../../types/reorganize';
import { serverMessageOf } from '../reorganizeErrors';

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

  const fetchPreview = useCallback(async () => {
    if (!token || !changeKey) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<ReorganizePreview>(
        '/api/tv/reorganize/preview',
        { change: JSON.parse(changeKey) },
        { headers: { 'x-access-token': token } }
      );
      if (seq === requestSeq.current) setPreview(response.data);
    } catch (err: unknown) {
      if (seq === requestSeq.current) {
        setPreview(null);
        setError(serverMessageOf(err, 'Failed to preview the move'));
      }
    } finally {
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

  return { preview, loading, error, refresh: fetchPreview };
}

export default useReorganizePreview;
