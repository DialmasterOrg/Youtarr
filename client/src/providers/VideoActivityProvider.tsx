import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSocketEvents } from '../hooks/useSocketEvents';

const ACTIVITY_MESSAGE_TYPES = ['videoActivityUpdated'];

export type VideoActivityState = 'queued' | 'downloading';
interface Snapshot {
  instanceId: string;
  revision: number;
  videos: Record<string, { jobId: string; state: VideoActivityState } | undefined>;
}
const EMPTY: Snapshot = { instanceId: '', revision: -1, videos: {} };
const VideoActivityContext = createContext({ snapshot: EMPTY, refresh: () => {} });

export function useVideoActivity() {
  return useContext(VideoActivityContext);
}

export default function VideoActivityProvider({ token, children }: {
  token: string | null;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    setSnapshot(EMPTY);
    if (!token) return;
    let disposed = false;
    let running = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const fetchSnapshot = async () => {
      if (running) { dirty = true; return; }
      running = true;
      try {
        const { data } = await axios.get<Snapshot>('/api/jobs/video-activity', {
          headers: { 'x-access-token': token }, signal: controller.signal,
        });
        if (!disposed && !dirty) {
          setSnapshot(previous => previous.instanceId === data.instanceId && previous.revision >= data.revision ? previous : data);
        }
      } catch {
        // Reconnect, focus, and the bounded fallback poll repair missed updates.
      } finally {
        running = false;
        if (dirty && !disposed) { dirty = false; void fetchSnapshot(); }
      }
    };
    const schedule = () => {
      if (running) { dirty = true; return; }
      clearTimeout(timer);
      timer = setTimeout(() => { void fetchSnapshot(); }, 100);
    };
    refreshRef.current = schedule;
    window.addEventListener('focus', schedule);
    const poll = setInterval(schedule, 30000);
    void fetchSnapshot();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('focus', schedule);
      refreshRef.current = () => {};
    };
  }, [token]);

  useSocketEvents(ACTIVITY_MESSAGE_TYPES, refresh, refresh);

  const value = useMemo(() => ({ snapshot, refresh }), [snapshot, refresh]);
  return <VideoActivityContext.Provider value={value}>{children}</VideoActivityContext.Provider>;
}
