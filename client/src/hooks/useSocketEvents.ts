import { useContext, useEffect, useRef } from 'react';
import WebSocketContext, { CONNECTION_RESTORED } from '../contexts/WebSocketContext';

interface Envelope {
  type?: string;
}

/**
 * Listens for server messages of the given types while the component is
 * mounted. onMessage gets each payload and its type. onRestored runs when the
 * connection comes back: of the messages sent while it was down, the server
 * replays only the last final downloadProgress one (which onMessage receives
 * as usual), so onRestored must reload whatever the others keep current.
 */
export function useSocketEvents<T = unknown>(
  types: readonly string[],
  onMessage: (payload: T, type: string) => void,
  onRestored: () => void
): void {
  const ws = useContext(WebSocketContext);
  const subscribe = ws?.subscribe;
  const unsubscribe = ws?.unsubscribe;
  const handlersRef = useRef({ onMessage, onRestored });
  handlersRef.current = { onMessage, onRestored };
  const typeKey = types.join(' ');

  useEffect(() => {
    if (!subscribe || !unsubscribe) return undefined;
    // One subscription per type: the provider hands a callback the payload
    // only, so the type is known from which subscription fired.
    const subscriptions = typeKey.split(' ').filter(Boolean).map((type) => ({
      filter: (message: Envelope) => message.type === type,
      callback: (payload: T) => handlersRef.current.onMessage(payload, type),
    }));
    const restored = {
      filter: (message: Envelope) => message.type === CONNECTION_RESTORED,
      callback: () => handlersRef.current.onRestored(),
    };
    [...subscriptions, restored].forEach(({ filter, callback }) => subscribe(filter, callback));
    return () => {
      [...subscriptions, restored].forEach(({ callback }) => unsubscribe(callback));
    };
  }, [subscribe, unsubscribe, typeKey]);
}
