import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useDebouncedCallback } from './useDebouncedCallback';
import { useSocketEvents } from './useSocketEvents';

const REFETCH_DEBOUNCE_MS = 1000;
const DOWNLOAD_MESSAGE_TYPES = ['downloadProgress', 'downloadComplete'];
const ACTIVE_JOB_STATUSES = ['In Progress', 'Pending'];
const ACTIVE_PROGRESS_STATES = ['initiating', 'downloading', 'stalled'];
const TERMINAL_PROGRESS_STATES = ['complete', 'error', 'terminated'];

interface RunningJob {
  status?: string;
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

  const scheduleRefetch = useDebouncedCallback(fetchActive, REFETCH_DEBOUNCE_MS);

  const onMessage = (payload: DownloadProgressPayload, type: string) => {
    if (type === 'downloadComplete') {
      scheduleRefetch();
      return;
    }
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
  // A server restart mid-download sends no final message, so a restored
  // connection re-probes too.
  useSocketEvents(DOWNLOAD_MESSAGE_TYPES, onMessage, scheduleRefetch);

  return { active };
}
