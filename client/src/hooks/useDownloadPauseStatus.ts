import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../contexts/WebSocketContext';
import { DownloadPauseStatus } from '../types/downloadPause';

interface BroadcastMessage {
  destination?: string;
  type?: string;
}

interface UseDownloadPauseStatusResult {
  data: DownloadPauseStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const isPauseMessage = (message: BroadcastMessage) =>
  message.destination === 'broadcast' && message.type === 'downloadPauseChanged';

// Missed broadcasts while disconnected are recovered by refetching.
const isReconnectMessage = (message: BroadcastMessage) => message.type === 'connectionRestored';

/**
 * Whether downloads are paused because a storage limit was reached. Seeded
 * over REST and kept current by downloadPauseChanged broadcasts.
 */
export function useDownloadPauseStatus(token: string | null): UseDownloadPauseStatusResult {
  const wsContext = useContext(WebSocketContext);
  const subscribe = wsContext?.subscribe;
  const unsubscribe = wsContext?.unsubscribe;

  const [data, setData] = useState<DownloadPauseStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  // Bumped by every request and broadcast; a response is applied only if
  // nothing newer arrived while it was in flight. Otherwise a slow GET could
  // overwrite a later "resumed" broadcast, and no further broadcast follows
  // once unpaused to correct it.
  const updateVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const requestVersion = ++updateVersionRef.current;
    try {
      const response = await axios.get<DownloadPauseStatus>('/api/jobs/download-pause', {
        headers: { 'x-access-token': token },
      });
      if (requestVersion !== updateVersionRef.current) return;
      setData(response.data);
      setError(null);
    } catch (err: unknown) {
      if (requestVersion !== updateVersionRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load download pause state');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!subscribe || !unsubscribe || !token) {
      return undefined;
    }

    const onPauseChanged = (payload: DownloadPauseStatus) => {
      updateVersionRef.current += 1;
      // Broadcasts skip measuring the downloaded total when no usage limit
      // needs it (null), so keep the last known value for display.
      setData((previous) => {
        const previousBytes = previous?.usage.downloadedBytes ?? null;
        if (payload.usage.downloadedBytes !== null || previousBytes === null) return payload;
        return { ...payload, usage: { ...payload.usage, downloadedBytes: previousBytes } };
      });
      setError(null);
    };
    const onReconnect = () => {
      refresh();
    };

    subscribe(isPauseMessage, onPauseChanged);
    subscribe(isReconnectMessage, onReconnect);
    return () => {
      unsubscribe(onPauseChanged);
      unsubscribe(onReconnect);
    };
  }, [subscribe, unsubscribe, token, refresh]);

  return { data, loading, error, refresh };
}
