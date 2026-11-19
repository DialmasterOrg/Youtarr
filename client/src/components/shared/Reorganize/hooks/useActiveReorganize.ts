import { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  // The operation whose change was asked for (or seeded), so a burst of progress messages asks once.
  const seededId = useRef<number | null>(null);

  const requestActive = useCallback(async (): Promise<ReorganizeOperation | null | undefined> => {
    if (!token) return undefined;
    try {
      const response = await axios.get<{ operation: ReorganizeOperation | null }>('/api/tv/operations/active', {
        headers: { 'x-access-token': token },
      });
      return response.data?.operation ?? null;
    } catch {
      // The notice is informational; a failed check leaves it as it was.
      return undefined;
    }
  }, [token]);

  const fetchActive = useCallback(async () => {
    const active = await requestActive();
    if (active === undefined) return;
    seededId.current = active?.id ?? null;
    setOperation(active);
  }, [requestActive]);

  // Progress messages don't carry the change: ask for it once, and only add it to
  // the same operation if that is still running when the answer arrives.
  const fetchChange = useCallback(async (operationId: number) => {
    const active = await requestActive();
    if (!active || active.id !== operationId) return;
    setOperation((current) => (current && current.id === operationId
      ? { ...current, change: active.change, changeType: active.changeType }
      : current));
  }, [requestActive]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    if (!ws) return undefined;
    const progressFilter = (msg: { type?: string }) => msg.type === REORGANIZE_PROGRESS_MESSAGE;
    const onProgress = (payload: ReorganizeProgressMessage) => {
      if (payload.status !== 'running') {
        // A retry runs the same operation again; it asks for its change anew.
        seededId.current = null;
        setOperation(null);
        return;
      }
      if (seededId.current !== payload.operationId) {
        seededId.current = payload.operationId;
        void fetchChange(payload.operationId);
      }
      setOperation((current) => ({
        // Keep the change the REST seed (or the fetch above) gave.
        ...(current && current.id === payload.operationId
          ? { change: current.change, changeType: current.changeType }
          : {}),
        id: payload.operationId, label: payload.label, status: payload.status,
        total: payload.total, done: payload.done, failed: payload.failed,
      }));
    };
    const reconnectFilter = (msg: { type?: string }) => msg.type === 'connectionRestored';
    const onReconnect = () => { fetchActive(); };
    ws.subscribe(progressFilter, onProgress);
    ws.subscribe(reconnectFilter, onReconnect);
    return () => {
      ws.unsubscribe(onProgress);
      ws.unsubscribe(onReconnect);
    };
  }, [ws, fetchActive, fetchChange]);

  return { operation };
}

export default useActiveReorganize;
