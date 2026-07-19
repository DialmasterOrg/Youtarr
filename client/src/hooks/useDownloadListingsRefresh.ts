import { useContext, useEffect, useRef } from 'react';
import WebSocketContext from '../contexts/WebSocketContext';

const REFRESH_DEBOUNCE_MS = 1000;

interface BroadcastMessage {
  destination?: string;
  type?: string;
}

/**
 * Calls onRefresh (debounced) when a download job is enqueued or starts
 * (jobsUpdated), a download batch persists a video (videosUpdated), or a
 * job finishes (downloadComplete), so listing pages can refetch without
 * a manual reload.
 */
export function useDownloadListingsRefresh(onRefresh: () => void): void {
  const wsContext = useContext(WebSocketContext);
  const subscribe = wsContext?.subscribe;
  const unsubscribe = wsContext?.unsubscribe;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return;
    }
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const filter = (message: BroadcastMessage) =>
      message.destination === 'broadcast' &&
      (message.type === 'videosUpdated' ||
        message.type === 'downloadComplete' ||
        message.type === 'jobsUpdated');

    const callback = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        onRefreshRef.current();
      }, REFRESH_DEBOUNCE_MS);
    };

    subscribe(filter, callback);
    return () => {
      unsubscribe(callback);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [subscribe, unsubscribe]);
}
