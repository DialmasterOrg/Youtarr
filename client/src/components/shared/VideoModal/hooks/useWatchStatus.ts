import { useState, useEffect } from 'react';
import axios from 'axios';

export interface ServerWatchStatus {
  server: string;
  played: boolean;
  playCount: number;
  percentWatched: number | null;
  lastWatchedAt: string | null;
  lastSyncedAt: string | null;
}

interface UseWatchStatusReturn {
  statuses: ServerWatchStatus[];
  loading: boolean;
}

export const useWatchStatus = (
  youtubeId: string,
  token: string | null
): UseWatchStatusReturn => {
  const [statuses, setStatuses] = useState<ServerWatchStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!youtubeId || !token) {
      setStatuses([]);
      // An in-flight fetch's finally is cancelled by the cleanup below, so
      // reset loading here or it would stick at true.
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchStatuses = async () => {
      setLoading(true);
      setStatuses([]);
      try {
        const res = await axios.get<{ statuses: ServerWatchStatus[] }>(
          `/api/videos/${youtubeId}/watch-status`,
          { headers: { 'x-access-token': token } }
        );
        if (!cancelled) setStatuses(res.data.statuses || []);
      } catch {
        // Watch status is supplementary; a failed fetch just hides the section.
        if (!cancelled) setStatuses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [youtubeId, token]);

  return { statuses, loading };
};
