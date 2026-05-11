import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../contexts/WebSocketContext';

export type RescanTrigger = 'manual' | 'scheduled' | 'startup';
export type RescanStatus = 'completed' | 'timed-out' | 'error';

export interface RescanLastRun {
  startedAt: string;
  completedAt: string;
  trigger: RescanTrigger;
  status: RescanStatus;
  videosUpdated: number;
  videosMarkedMissing: number;
  videosScanned: number;
  filesFoundOnDisk: number;
  errorMessage: string | null;
}

interface RescanStatusResponse {
  running: boolean;
  lastRun: RescanLastRun | null;
}

interface RescanStatusPayload {
  running: boolean;
  trigger?: RescanTrigger;
  lastRun?: RescanLastRun | null;
}

export interface UseRescanStatusReturn {
  running: boolean;
  lastRun: RescanLastRun | null;
  loading: boolean;
  error: string | null;
  triggerRescan: () => Promise<void>;
}

export function useRescanStatus(token: string | null): UseRescanStatusReturn {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RescanLastRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ws = useContext(WebSocketContext);

  useEffect(() => {
    let cancelled = false;
    const headers = token ? { 'x-access-token': token } : undefined;

    axios
      .get<RescanStatusResponse>('/api/maintenance/rescan-status', { headers })
      .then((res) => {
        if (cancelled) return;
        setRunning(res.data.running);
        setLastRun(res.data.lastRun);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load rescan status';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!ws) return undefined;
    // Filter receives the full message envelope; callback receives only the
    // payload (WebSocketProvider strips the envelope before invoking).
    const filter = (msg: { type?: string }) => msg.type === 'rescanStatus';
    const callback = (payload: RescanStatusPayload) => {
      setRunning(payload.running);
      if (payload.running) {
        setError(null);
      }
      if (payload.lastRun !== undefined) {
        setLastRun(payload.lastRun);
        setError(null);
      }
    };
    ws.subscribe(filter, callback);
    return () => ws.unsubscribe(callback);
  }, [ws]);

  const triggerRescan = useCallback(async () => {
    setError(null);
    setRunning(true);
    const headers = token ? { 'x-access-token': token } : undefined;
    try {
      await axios.post('/api/maintenance/rescan-files', undefined, { headers });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as { error?: string } | undefined;
        setError(data?.error ?? 'Rescan already in progress');
        return;
      }
      setRunning(false);
      const message = err instanceof Error ? err.message : 'Failed to start rescan';
      setError(message);
    }
  }, [token]);

  return { running, lastRun, loading, error, triggerRescan };
}
