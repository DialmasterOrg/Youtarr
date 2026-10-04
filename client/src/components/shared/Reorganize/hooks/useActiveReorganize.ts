import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../../../../contexts/WebSocketContext';
import { ReorganizeOperation, ReorganizeProgressMessage } from '../../../../types/reorganize';
import { REORGANIZE_PROGRESS_MESSAGE } from './useReorganizeOperation';

export interface UseActiveReorganizeResult {
  /** The running reorganize, or null */
  operation: ReorganizeOperation | null;
}

/** The reorganize running right now, if any (for the app-wide notice). */
export function useActiveReorganize(token: string | null): UseActiveReorganizeResult {
  const [operation, setOperation] = useState<ReorganizeOperation | null>(null);
  const ws = useContext(WebSocketContext);

  const fetchActive = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get<{ operation: ReorganizeOperation | null }>('/api/tv/operations/active', {
        headers: { 'x-access-token': token },
      });
      setOperation(response.data?.operation ?? null);
    } catch {
      // The notice is informational; a failed check leaves it as it was.
    }
  }, [token]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    if (!ws) return undefined;
    const progressFilter = (msg: { type?: string }) => msg.type === REORGANIZE_PROGRESS_MESSAGE;
    const onProgress = (payload: ReorganizeProgressMessage) => {
      if (payload.status !== 'running') {
        setOperation(null);
        return;
      }
      setOperation({
        id: payload.operationId, label: payload.label, status: payload.status,
        total: payload.total, done: payload.done, failed: payload.failed,
      });
    };
    const reconnectFilter = (msg: { type?: string }) => msg.type === 'connectionRestored';
    const onReconnect = () => { fetchActive(); };
    ws.subscribe(progressFilter, onProgress);
    ws.subscribe(reconnectFilter, onReconnect);
    return () => {
      ws.unsubscribe(onProgress);
      ws.unsubscribe(onReconnect);
    };
  }, [ws, fetchActive]);

  return { operation };
}

export default useActiveReorganize;
