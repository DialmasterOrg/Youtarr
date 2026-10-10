import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import WebSocketContext from '../contexts/WebSocketContext';

// Automatic downloads can count as running for hours and already have the
// download activity indicator.
const EXCLUDED_TASK_KEYS = new Set(['channelDownloadFrequency']);
// The scheduler broadcasts every start and finish; connectionRestored covers
// broadcasts missed while disconnected.
const REFRESH_MESSAGE_TYPES = new Set(['scheduledTaskStatus', 'connectionRestored']);
const REFETCH_DEBOUNCE_MS = 1000;
// A fallback for a missed finish broadcast, only while something is running.
const RUNNING_POLL_INTERVAL_MS = 30_000;

export interface RunningScheduledTask {
  key: string;
  label: string;
}

interface ScheduleTaskSummary {
  key: string;
  label: string;
  running: boolean;
  runNow?: { reason: string | null };
}

function runningTasks(tasks: ScheduleTaskSummary[]): RunningScheduledTask[] {
  return tasks
    .filter((task) => !EXCLUDED_TASK_KEYS.has(task.key))
    .filter((task) => task.running || task.runNow?.reason === 'running')
    .map(({ key, label }) => ({ key, label }));
}

// Scheduled tasks running right now, for the header indicator. Fetched once,
// then again on scheduler broadcasts, reconnects, and returning to the tab.
export function useRunningScheduledTasks(token: string | null): { running: RunningScheduledTask[] } {
  const [running, setRunning] = useState<RunningScheduledTask[]>([]);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    latestRequest.current += 1;
    const request = latestRequest.current;
    try {
      const res = await axios.get<{ tasks?: ScheduleTaskSummary[] }>('/api/schedules', {
        headers: { 'x-access-token': token },
      });
      if (request !== latestRequest.current) return;
      setRunning(runningTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []));
    } catch {
      // Keep the current value; the next broadcast or refresh corrects it.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setRunning([]);
      return;
    }
    refresh();
  }, [token, refresh]);

  const ws = useContext(WebSocketContext);
  useEffect(() => {
    if (!ws) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const filter = (message: { type?: string }) => REFRESH_MESSAGE_TYPES.has(message.type ?? '');
    const callback = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, REFETCH_DEBOUNCE_MS);
    };
    ws.subscribe(filter, callback);
    return () => {
      ws.unsubscribe(callback);
      if (timer) clearTimeout(timer);
    };
  }, [ws, refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  const anyRunning = running.length > 0;
  useEffect(() => {
    if (!anyRunning) return undefined;
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, RUNNING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [anyRunning, refresh]);

  return { running };
}
