import { useContext, useEffect, useRef } from 'react';
import WebSocketContext from '../../../contexts/WebSocketContext';

interface SyncMessage {
  type?: string;
  payload?: { playlistDbId?: number };
}

/**
 * Calls onUpdate when a media server sync of the given playlist starts or
 * ends (playlistSyncUpdated), and after a reconnect, since a sync may have
 * ended while disconnected. playlistDbId is the playlist's database id.
 */
export function usePlaylistSyncUpdates(playlistDbId: number | null, onUpdate: () => void): void {
  const wsContext = useContext(WebSocketContext);
  const subscribe = wsContext?.subscribe;
  const unsubscribe = wsContext?.unsubscribe;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!subscribe || !unsubscribe || playlistDbId === null) {
      return;
    }

    const filter = (message: SyncMessage) =>
      message.type === 'connectionRestored' ||
      (message.type === 'playlistSyncUpdated' && message.payload?.playlistDbId === playlistDbId);
    const callback = () => onUpdateRef.current();

    subscribe(filter, callback);
    return () => unsubscribe(callback);
  }, [subscribe, unsubscribe, playlistDbId]);
}
