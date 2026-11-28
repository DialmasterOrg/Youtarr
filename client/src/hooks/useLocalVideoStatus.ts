import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SearchResult } from '../components/FindVideos/types';
import { useVideoActivity } from '../providers/VideoActivityProvider';
import { useSocketEvents } from './useSocketEvents';

const STATUS_MESSAGE_TYPES = ['videosUpdated', 'downloadComplete'];

export type LocalVideoStatus = Pick<SearchResult, 'youtubeId' | 'status' | 'inArchive' | 'databaseId' | 'filePath' | 'fileSize' | 'audioFilePath' | 'audioFileSize' | 'addedAt' | 'isProtected' | 'normalizedRating' | 'ratingSource' | 'removedReason' | 'removedAt' | 'removedDetail'>;

// Refresh only local DB metadata; never re-run a YouTube search for activity.
export function useLocalVideoStatus(ids: string[], token: string | null) {
  const key = JSON.stringify([...new Set(ids)].sort());
  const [statuses, setStatuses] = useState<Record<string, LocalVideoStatus | undefined>>({});
  const request = useRef(0);
  const { snapshot } = useVideoActivity();
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    const youtubeIds: string[] = JSON.parse(key);
    if (!token || !youtubeIds.length) { setStatuses({}); return; }
    try {
      const results: LocalVideoStatus[] = [];
      for (let offset = 0; offset < youtubeIds.length; offset += 500) {
        const { data } = await axios.post<{ results: LocalVideoStatus[] }>('/api/videos/local-status', {
          youtubeIds: youtubeIds.slice(offset, offset + 500),
        }, { headers: { 'x-access-token': token } });
        if (generation !== request.current) return;
        results.push(...data.results);
      }
      setStatuses(Object.fromEntries(results.map(result => [result.youtubeId, result])));
    } catch {
      // Preserve the last known file state until the next update.
    }
  }, [key, token]);

  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void refresh(); }, 150);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    return () => { clearTimeout(timer.current); request.current += 1; };
  }, [refresh]);

  const previousInstance = useRef(snapshot.instanceId);
  useEffect(() => {
    if (previousInstance.current && previousInstance.current !== snapshot.instanceId) scheduleRefresh();
    previousInstance.current = snapshot.instanceId;
  }, [snapshot.instanceId, scheduleRefresh]);

  useSocketEvents(STATUS_MESSAGE_TYPES, scheduleRefresh, scheduleRefresh);
  return statuses;
}
