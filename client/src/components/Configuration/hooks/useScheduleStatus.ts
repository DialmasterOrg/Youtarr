import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { CONFIG_UPDATED_EVENT } from '../../../hooks/useConfig';
import { ScheduleKey } from '../schedules';
import WebSocketContext from '../../../contexts/WebSocketContext';

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

export type RunBlockReason =
  | 'not-registered' | 'running' | 'disabled' | 'cooldown' | 'managed'
  | 'downloads-paused' | 'no-media-server' | 'youtube-throttled' | 'downloads-active';

export interface ScheduleRunAvailability {
  available: boolean;
  reason: RunBlockReason | null;
  message: string | null;
  availableAt: string | null;
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
  runNow: ScheduleRunAvailability;
}

interface ScheduleStatusResponse {
  tasks: ScheduleTaskStatus[];
  serverTime?: string;
}

const LOAD_ERROR_MESSAGE = 'Could not load schedule status.';
// Runs are rare, so idle polling only has to catch a next-run rolling over.
// While something is running, WebSocket events (scheduledTaskStatus,
// downloadComplete, jobsUpdated, connectionRestored, ...) carry the start and
// finish promptly; this poll is only a fallback, so it can stay slow even
// though automatic downloads can count as running for hours.
const IDLE_POLL_INTERVAL_MS = 60_000;
const RUNNING_POLL_INTERVAL_MS = 30_000;
// Server events that can change a task's running state or Run now availability.
const REFRESH_MESSAGE_TYPES = new Set([
  'scheduledTaskStatus', 'rescanStatus', 'jobsUpdated', 'downloadComplete',
  'downloadPauseChanged', 'connectionRestored',
]);
// Download batches emit bursts of events; one refetch covers a burst.
const WS_REFRESH_DEBOUNCE_MS = 300;
// Refetch just after a cooldown or pause ends so Run now re-enables on time.
const AVAILABILITY_REFRESH_GRACE_MS = 1_000;

function earliestFutureTime(tasks: ScheduleTaskStatus[], now: number): number | null {
  const times = tasks
    .map((task) => (task.runNow?.availableAt ? Date.parse(task.runNow.availableAt) : NaN))
    .filter((time) => Number.isFinite(time) && time > now);
  return times.length > 0 ? Math.min(...times) : null;
}

// Live scheduler state for the Scheduling page: whether each timer is armed,
// when it fires next, its last recorded run, and whether Run now is
// available. Refetched after every save, on a timer while the tab is
// visible, when the tab becomes visible again, on relevant WebSocket
// events, and just after a blocked task's availableAt passes.
export function useScheduleStatus(token: string | null) {
  const [tasks, setTasks] = useState<ScheduleTaskStatus[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  // Difference between the server clock and the browser clock, so
  // availableAt (server time) can be timed accurately even when they drift.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
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
      const serverTime = res.data.serverTime ? Date.parse(res.data.serverTime) : NaN;
      setClockOffsetMs(Number.isFinite(serverTime) ? serverTime - Date.now() : 0);
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

  const ws = useContext(WebSocketContext);
  useEffect(() => {
    if (!ws) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const filter = (message: { type?: string }) => REFRESH_MESSAGE_TYPES.has(message.type ?? '');
    const callback = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!document.hidden) refresh();
      }, WS_REFRESH_DEBOUNCE_MS);
    };
    ws.subscribe(filter, callback);
    return () => {
      ws.unsubscribe(callback);
      if (timer) clearTimeout(timer);
    };
  }, [ws, refresh]);

  // availableAt is in server time; the browser clock may be off by minutes.
  const nextAvailableAt = useMemo(
    () => earliestFutureTime(tasks, Date.now() + clockOffsetMs),
    [tasks, clockOffsetMs]
  );
  useEffect(() => {
    if (nextAvailableAt === null) return undefined;
    const serverNow = Date.now() + clockOffsetMs;
    const timer = setTimeout(refresh, nextAvailableAt - serverNow + AVAILABILITY_REFRESH_GRACE_MS);
    return () => clearTimeout(timer);
  }, [nextAvailableAt, clockOffsetMs, refresh]);

  return { tasks, loading, error, refresh };
}
