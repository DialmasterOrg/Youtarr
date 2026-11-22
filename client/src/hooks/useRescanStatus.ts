import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../contexts/WebSocketContext';

export type RescanTrigger = 'manual' | 'scheduled' | 'startup';
// timed-out: only runs from releases before the disk walk was exempt from the time limit.
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
  // Videos left unmarked because a folder looked unmounted or most of its videos were not found.
  videosNotMarkedMissing?: number;
  // Missing videos after the run; null or absent for runs recorded before it was counted.
  videosMissing?: number | null;
  errorMessage: string | null;
  // A "Rescan anyway" run, which skipped the unmounted-drive check.
  libraryCheckSkipped?: boolean;
}

/** A running rescan: first the walk of the downloads folder, then the check of each video. */
export interface RescanProgress {
  phase: 'walk' | 'rows';
  foldersScanned: number;
  filesFound: number;
  videosProcessed: number;
  videosTotal: number;
  startedAt: string;
}

interface RescanStatusResponse {
  running: boolean;
  progress?: RescanProgress | null;
  lastRun: RescanLastRun | null;
}

interface RescanStatusPayload {
  running: boolean;
  trigger?: RescanTrigger;
  progress?: RescanProgress;
  lastRun?: RescanLastRun | null;
}

export interface TriggerRescanOptions {
  // Rescan anyway: skip the unmounted-drive check, for a folder emptied on purpose.
  ignoreLibraryCheck?: boolean;
}

export interface TriggerRescanOutcome {
  // False when the server refused (already running) or the request failed; `error` says why.
  started: boolean;
}

export interface UseRescanStatusReturn {
  running: boolean;
  // The running rescan's progress, or null (not running, or no report yet).
  progress: RescanProgress | null;
  lastRun: RescanLastRun | null;
  loading: boolean;
  error: string | null;
  triggerRescan: (options?: TriggerRescanOptions) => Promise<TriggerRescanOutcome>;
}

export function useRescanStatus(token: string | null): UseRescanStatusReturn {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RescanProgress | null>(null);
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
        setProgress(res.data.running ? res.data.progress ?? null : null);
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
      // A start message carries no progress yet; a finished rescan has none.
      setProgress(payload.running ? payload.progress ?? null : null);
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

  const triggerRescan = useCallback(async (options?: TriggerRescanOptions): Promise<TriggerRescanOutcome> => {
    setError(null);
    setRunning(true);
    const headers = token ? { 'x-access-token': token } : undefined;
    const body = options?.ignoreLibraryCheck ? { ignoreLibraryCheck: true } : undefined;
    try {
      await axios.post('/api/maintenance/rescan-files', body, { headers });
      return { started: true };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const data = err.response.data as { error?: string } | undefined;
        setError(data?.error ?? 'Rescan already in progress');
        return { started: false };
      }
      setRunning(false);
      const message = err instanceof Error ? err.message : 'Failed to start rescan';
      setError(message);
      return { started: false };
    }
  }, [token]);

  return { running, progress, lastRun, loading, error, triggerRescan };
}
