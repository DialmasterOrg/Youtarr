import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const RUNNING_POLL_INTERVAL_MS = 2_000;
// Consecutive failed status polls tolerated before the hook stops trusting the
// optimistic running state (~10s: rides out a transient blip, but an expired
// session or dead backend can't pin "Sync in progress" forever).
const MAX_POLL_FAILURES = 5;
const POLL_ERROR_MESSAGE =
  'Could not check sync status; it may still be running on the server.';

export interface WatchStatusSyncServerResult {
  updated?: number;
  error?: string;
}

export interface WatchStatusSyncRun {
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  servers?: Record<string, WatchStatusSyncServerResult>;
  skipped?: string;
  error?: string;
}

export interface WatchStatusSyncState {
  running: boolean;
  lastRun: WatchStatusSyncRun | null;
}

// Watch-status sync state: the last run's per-server summary, plus a manual
// trigger. While a sync runs (whether started here or by the scheduler), the
// hook polls the status endpoint until it completes so the summary appears
// without a manual refresh. `running` is the polled state gated on the poll
// loop still being healthy: after MAX_POLL_FAILURES straight failures the loop
// stops, pollError is set, and running reverts to false so the caller can
// offer Sync Now as the retry path.
export const useWatchStatusSync = (token: string | null) => {
  const [syncState, setSyncState] = useState<WatchStatusSyncState | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollFailuresRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get<WatchStatusSyncState>('/api/mediaservers/watch-status', {
        headers: { 'x-access-token': token },
      });
      pollFailuresRef.current = 0;
      setPollError(null);
      setSyncState(res.data);
    } catch {
      pollFailuresRef.current += 1;
      if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
        setPollError(POLL_ERROR_MESSAGE);
      }
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!syncState?.running || pollError) return;
    const interval = setInterval(refresh, RUNNING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [syncState?.running, pollError, refresh]);

  const startSync = useCallback(async () => {
    if (!token) return;
    setStarting(true);
    setStartError(null);
    pollFailuresRef.current = 0;
    setPollError(null);
    try {
      await axios.post('/api/mediaservers/watch-status/sync', null, {
        headers: { 'x-access-token': token },
      });
      // Flip to running immediately so the poll loop starts; the next poll
      // replaces this with the server's actual state.
      setSyncState((prev) => ({ running: true, lastRun: prev?.lastRun ?? null }));
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) || 'Failed to start sync';
      setStartError(typeof message === 'string' ? message : 'Failed to start sync');
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Another sync is already running; start polling it as well.
        setSyncState((prev) => ({ running: true, lastRun: prev?.lastRun ?? null }));
      }
    } finally {
      setStarting(false);
    }
  }, [token]);

  const running = !!syncState?.running && !pollError;

  return { syncState, running, starting, startError, pollError, startSync, refresh };
};
