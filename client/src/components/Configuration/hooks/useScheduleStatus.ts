import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CONFIG_UPDATED_EVENT } from '../../../hooks/useConfig';
import { ScheduleKey } from '../schedules';

export type ScheduleRunStatus = 'running' | 'success' | 'error' | 'skipped' | 'interrupted';
export type ScheduleRunTrigger = 'scheduled' | 'manual' | 'startup';

export interface ScheduleRun {
  id: number;
  taskKey: string;
  trigger: ScheduleRunTrigger;
  status: ScheduleRunStatus;
  outcome: string | null;
  message: string | null;
  details: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScheduleTaskStatus {
  key: ScheduleKey;
  label: string;
  enabled: boolean;
  active: boolean;
  expression: string | null;
  error: string | null;
  running: boolean;
  nextRunAt: string | null;
  lastRun: ScheduleRun | null;
}

interface ScheduleStatusResponse {
  tasks: ScheduleTaskStatus[];
}

const LOAD_ERROR_MESSAGE = 'Could not load schedule status.';
// Runs are rare, so idle polling only has to catch a next-run rolling over;
// while something is running the page should notice it finishing promptly.
const IDLE_POLL_INTERVAL_MS = 60_000;
const RUNNING_POLL_INTERVAL_MS = 5_000;

// Live scheduler state for the Scheduling page: whether each timer is armed,
// when it fires next, and its last recorded run. Refetched after every save,
// on a timer while the tab is visible, and when the tab becomes visible again.
export function useScheduleStatus(token: string | null) {
  const [tasks, setTasks] = useState<ScheduleTaskStatus[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  // Polls and post-save refreshes can overlap; only the newest request may
  // write state, so a slow older response can't overwrite fresher status.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    latestRequest.current += 1;
    const request = latestRequest.current;
    try {
      const res = await axios.get<ScheduleStatusResponse>('/api/schedules', {
        headers: { 'x-access-token': token },
      });
      if (request !== latestRequest.current) return;
      setTasks(res.data.tasks);
      setError(null);
    } catch {
      if (request !== latestRequest.current) return;
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(CONFIG_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CONFIG_UPDATED_EVENT, refresh);
  }, [refresh]);

  const anyRunning = tasks.some((task) => task.running);
  useEffect(() => {
    if (!token) return undefined;
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, anyRunning ? RUNNING_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, anyRunning, refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  return { tasks, loading, error, refresh };
}
