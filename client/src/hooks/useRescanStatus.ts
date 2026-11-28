import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../utils/requestError';
import { useSocketEvents } from './useSocketEvents';

const RESCAN_MESSAGE_TYPES = ['rescanStatus'];

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

// Three things write this hook's state: the status load (on mount and after a
// reconnect), live rescanStatus messages, and a rescan started here. A load
// answers with what the server knew when it was sent, so a live message or a
// click on Rescan is newer than any load still in flight. Rule: those two bump
// the version of the state they set (`running`/`progress`, or `lastRun`), and
// the load applies each only if its version has not moved since it was sent.
// The one write that does not bump is the rollback after a failed start: it
// only undoes the click's guess, so a load sent after the click, which holds
// the server's own answer, wins over it.
export function useRescanStatus(token: string | null): UseRescanStatusReturn {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RescanProgress | null>(null);
  const [lastRun, setLastRun] = useState<RescanLastRun | null>(null);
  const [loading, setLoading] = useState(true);
  // Two errors, so a request clears only its own: a status load that succeeds
  // must not hide why a rescan failed to start.
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bumped when the connection comes back, to load the status again: a rescan
  // that ended while disconnected sends nothing more.
  const [reloads, reload] = useReducer((count: number) => count + 1, 0);
  // `status` covers `running` and `progress`. See the rule above.
  const versionRef = useRef({ status: 0, lastRun: 0 });

  useEffect(() => {
    let cancelled = false;
    const headers = token ? { 'x-access-token': token } : undefined;
    const versionAtStart = { ...versionRef.current };

    axios
      .get<RescanStatusResponse>('/api/maintenance/rescan-status', { headers })
      .then((res) => {
        if (cancelled) return;
        if (versionRef.current.status === versionAtStart.status) {
          setRunning(res.data.running);
          setProgress(res.data.running ? res.data.progress ?? null : null);
        }
        if (versionRef.current.lastRun === versionAtStart.lastRun) {
          setLastRun(res.data.lastRun);
        }
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load rescan status';
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloads]);

  const applyLiveStatus = (payload: RescanStatusPayload) => {
    versionRef.current.status += 1;
    setRunning(payload.running);
    // A start message carries no progress yet; a finished rescan has none.
    setProgress(payload.running ? payload.progress ?? null : null);
    if (payload.lastRun !== undefined) {
      versionRef.current.lastRun += 1;
      setLastRun(payload.lastRun);
    }
    if (payload.running || payload.lastRun !== undefined) {
      setTriggerError(null);
      setLoadError(null);
    }
  };
  useSocketEvents(RESCAN_MESSAGE_TYPES, applyLiveStatus, reload);

  const triggerRescan = useCallback(async (options?: TriggerRescanOptions): Promise<TriggerRescanOutcome> => {
    setTriggerError(null);
    setRunning(true);
    // Not a live message, but newer than a load in flight, which would
    // otherwise turn `running` back off and re-enable the button.
    versionRef.current.status += 1;
    const headers = token ? { 'x-access-token': token } : undefined;
    const body = options?.ignoreLibraryCheck ? { ignoreLibraryCheck: true } : undefined;
    try {
      await axios.post('/api/maintenance/rescan-files', body, { headers });
      return { started: true };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setTriggerError(serverErrorMessage(err, 'Rescan already in progress'));
        return { started: false };
      }
      // No version bump here, on purpose: a status load sent during this
      // request reports what the server is really doing and must win.
      setRunning(false);
      const message = err instanceof Error ? err.message : 'Failed to start rescan';
      setTriggerError(message);
      return { started: false };
    }
  }, [token]);

  // A rescan that failed to start outranks a status load that failed.
  return { running, progress, lastRun, loading, error: triggerError ?? loadError, triggerRescan };
}
