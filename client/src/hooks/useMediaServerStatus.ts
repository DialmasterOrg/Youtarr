import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MediaServerStatus } from '../types/playlist';

const POLL_INTERVAL_MS = 60_000;

const EMPTY_STATUS: MediaServerStatus = {
  plex: false,
  jellyfin: false,
  emby: false,
};

export const useMediaServerStatus = (token: string | null) => {
  const [status, setStatus] = useState<MediaServerStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) {
      setStatus(EMPTY_STATUS);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const res = await axios.get<MediaServerStatus>('/api/mediaservers/status', {
        headers: { 'x-access-token': token },
      });
      setStatus({
        plex: !!res.data.plex,
        jellyfin: !!res.data.jellyfin,
        emby: !!res.data.emby,
      });
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) ||
        'Failed to load media server status';
      setError(typeof message === 'string' ? message : 'Failed to load media server status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();

    if (!token) {
      return;
    }

    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, fetchStatus]);

  const anyConfigured = status.plex || status.jellyfin || status.emby;

  return {
    status,
    anyConfigured,
    loading,
    error,
    refetch: fetchStatus,
  };
};
