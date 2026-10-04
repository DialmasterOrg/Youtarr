import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../../../../contexts/WebSocketContext';
import { ReorganizeOperation, ReorganizeProgressMessage } from '../../../../types/reorganize';
import { serverMessageOf } from '../reorganizeErrors';

export const REORGANIZE_PROGRESS_MESSAGE = 'tvReorganizeProgress';

export interface UseReorganizeOperationResult {
  operation: ReorganizeOperation | null;
  error: string | null;
  retrying: boolean;
  /** Retry the operation's failed videos; resolves to whether the retry started */
  retry: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * A reorganize's progress and result: loaded over REST, kept current by the
 * tvReorganizeProgress broadcasts (counts while it runs, a full reload when it
 * ends, for its failed videos).
 */
export function useReorganizeOperation(token: string | null, operationId: number | null): UseReorganizeOperationResult {
  const [operation, setOperation] = useState<ReorganizeOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const ws = useContext(WebSocketContext);
  const requestSeq = useRef(0);

  const fetchOperation = useCallback(async () => {
    if (!token || !operationId) return;
    const seq = ++requestSeq.current;
    try {
      const response = await axios.get<ReorganizeOperation>(`/api/tv/operations/${operationId}`, {
        headers: { 'x-access-token': token },
      });
      if (seq === requestSeq.current) {
        setOperation(response.data);
        setError(null);
      }
    } catch (err: unknown) {
      if (seq === requestSeq.current) setError(serverMessageOf(err, 'Failed to load the reorganize'));
    }
  }, [token, operationId]);

  useEffect(() => {
    setOperation(null);
    fetchOperation();
  }, [fetchOperation]);

  useEffect(() => {
    if (!ws || !operationId) return undefined;
    const progressFilter = (msg: { type?: string; payload?: { operationId?: number } }) => (
      msg.type === REORGANIZE_PROGRESS_MESSAGE && msg.payload?.operationId === operationId
    );
    const onProgress = (payload: ReorganizeProgressMessage) => {
      if (payload.status === 'running') {
        setOperation((current) => (current
          ? { ...current, status: payload.status, total: payload.total, done: payload.done, failed: payload.failed }
          : current));
        return;
      }
      fetchOperation();
    };
    const reconnectFilter = (msg: { type?: string }) => msg.type === 'connectionRestored';
    const onReconnect = () => { fetchOperation(); };
    ws.subscribe(progressFilter, onProgress);
    ws.subscribe(reconnectFilter, onReconnect);
    return () => {
      ws.unsubscribe(onProgress);
      ws.unsubscribe(onReconnect);
    };
  }, [ws, operationId, fetchOperation]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (!token || !operationId) return false;
    setRetrying(true);
    setError(null);
    try {
      await axios.post(`/api/tv/operations/${operationId}/retry`, undefined, { headers: { 'x-access-token': token } });
      await fetchOperation();
      return true;
    } catch (err: unknown) {
      setError(serverMessageOf(err, 'Failed to retry the reorganize'));
      return false;
    } finally {
      setRetrying(false);
    }
  }, [token, operationId, fetchOperation]);

  return { operation, error, retrying, retry, refetch: fetchOperation };
}

export default useReorganizeOperation;
