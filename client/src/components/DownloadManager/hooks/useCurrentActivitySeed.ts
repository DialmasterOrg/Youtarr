import { useCallback, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import WebSocketContext from '../../../contexts/WebSocketContext';
import { DownloadProgressPayload, StructuredProgress } from '../types';

// A non-terminal snapshot older than this is treated as unreliable: the job
// record drives the UI instead of a frozen progress bar.
const STALE_ACTIVITY_MS = 60 * 1000;

export interface CurrentActivityResponse {
  jobId: string | null;
  capturedAt: number | null;
  terminal: boolean;
  activity: StructuredProgress | null;
  lastFinalActivity: DownloadProgressPayload | null;
}

interface UseCurrentActivitySeedArgs {
  token: string | null;
  // Incremented by the caller for every live downloadProgress message. A
  // probe captures the value when it starts and discards its response if a
  // live message arrived while the request was in flight - only those can be
  // newer than the REST snapshot.
  liveMessageGenerationRef: React.MutableRefObject<number>;
  applyPayload: (payload: DownloadProgressPayload) => void;
  // Clears all transient activity UI (progress, error, warning, summary);
  // called before applying a non-fresh result so a terminal replay fully
  // replaces whatever job state was on screen.
  resetActivityState: () => void;
}

/**
 * Seeds the activity page with the server's current download snapshot so it
 * renders immediately on mount, instead of waiting for the next WebSocket
 * broadcast. Re-probes when the connection is restored or the tab becomes
 * visible again.
 */
export function useCurrentActivitySeed({
  token,
  liveMessageGenerationRef,
  applyPayload,
  resetActivityState,
}: UseCurrentActivitySeedArgs): void {
  const wsContext = useContext(WebSocketContext);
  const subscribe = wsContext?.subscribe;
  const unsubscribe = wsContext?.unsubscribe;
  const probeGenerationRef = useRef(0);

  const probe = useCallback(async () => {
    if (!token) {
      return;
    }
    const probeGeneration = ++probeGenerationRef.current;
    const liveGenerationAtStart = liveMessageGenerationRef.current;
    try {
      const response = await axios.get<CurrentActivityResponse>(
        '/api/jobs/current-activity',
        { headers: { 'x-access-token': token } }
      );
      // Discard if a newer probe started or a live broadcast arrived while
      // this request was in flight
      if (
        probeGeneration !== probeGenerationRef.current ||
        liveMessageGenerationRef.current !== liveGenerationAtStart
      ) {
        return;
      }
      const data = response.data;
      const fresh =
        data.activity !== null &&
        !data.terminal &&
        data.capturedAt !== null &&
        Date.now() - data.capturedAt < STALE_ACTIVITY_MS;

      // An applied snapshot replaces whatever's on screen: it may belong to
      // an earlier job whose transition messages were missed
      resetActivityState();
      if (fresh && data.activity) {
        applyPayload({ progress: data.activity });
      } else if (data.lastFinalActivity) {
        applyPayload(data.lastFinalActivity);
      }
    } catch {
      // Best-effort seed: live broadcasts and job polling still cover the page
    }
  }, [token, liveMessageGenerationRef, applyPayload, resetActivityState]);

  useEffect(() => {
    probe();
  }, [probe]);

  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return;
    }
    const filter = (message: { type?: string }) =>
      message.type === 'connectionRestored';
    const callback = () => {
      probe();
    };
    subscribe(filter, callback);
    return () => {
      unsubscribe(callback);
    };
  }, [subscribe, unsubscribe, probe]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        probe();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [probe]);
}
