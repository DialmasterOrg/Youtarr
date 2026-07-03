import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../contexts/WebSocketContext';

const REFETCH_DEBOUNCE_MS = 1000;
const ACTIVE_JOB_STATUSES = ['In Progress', 'Pending'];
const ACTIVE_PROGRESS_STATES = ['initiating', 'downloading', 'stalled'];
const TERMINAL_PROGRESS_STATES = ['complete', 'error', 'terminated'];

interface RunningJob {
  status?: string;
}

interface BroadcastMessage {
  destination?: string;
  type?: string;
}

interface DownloadProgressPayload {
  progress?: { state?: string };
  finalSummary?: unknown;
}

/**
 * The /runningjobs probe covers initial state: WebSocket reconnects only
 * replay final states, so a page opened mid-download would start blank.
 * Terminal signals re-probe instead of clearing because a finished job
 * can hand off to a queued Pending job.
 */
export function useActiveDownloads(token: string | null): { active: boolean } {
  const [active, setActive] = useState(false);
  const wsContext = useContext(WebSocketContext);
  const subscribe = wsContext?.subscribe;
  const unsubscribe = wsContext?.unsubscribe;

  const fetchActive = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const response = await axios.get<RunningJob[]>('/runningjobs', {
        headers: { 'x-access-token': token },
      });
      const jobs = Array.isArray(response.data) ? response.data : [];
      setActive(
        jobs.some(
          (job) => job.status !== undefined && ACTIVE_JOB_STATUSES.includes(job.status)
        )
      );
    } catch {
      // Leave the current value; the next broadcast or probe corrects it.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setActive(false);
      return;
    }
    fetchActive();
  }, [token, fetchActive]);

  useEffect(() => {
    if (!subscribe || !unsubscribe) {
      return;
    }

    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (refetchTimer) {
        clearTimeout(refetchTimer);
      }
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        fetchActive();
      }, REFETCH_DEBOUNCE_MS);
    };

    const progressFilter = (message: BroadcastMessage) =>
      message.destination === 'broadcast' && message.type === 'downloadProgress';
    const progressCallback = (payload: DownloadProgressPayload) => {
      const state = payload?.progress?.state;
      if (state !== undefined && ACTIVE_PROGRESS_STATES.includes(state)) {
        setActive(true);
        return;
      }
      if (
        payload?.finalSummary ||
        (state !== undefined && TERMINAL_PROGRESS_STATES.includes(state))
      ) {
        scheduleRefetch();
      }
    };

    const completeFilter = (message: BroadcastMessage) =>
      message.destination === 'broadcast' && message.type === 'downloadComplete';
    const completeCallback = () => scheduleRefetch();

    subscribe(progressFilter, progressCallback);
    subscribe(completeFilter, completeCallback);

    return () => {
      unsubscribe(progressCallback);
      unsubscribe(completeCallback);
      if (refetchTimer) {
        clearTimeout(refetchTimer);
      }
    };
  }, [subscribe, unsubscribe, fetchActive]);

  return { active };
}
