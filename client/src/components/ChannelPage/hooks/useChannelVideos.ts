import { useState, useEffect, useCallback, useRef } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';

interface UseChannelVideosParams {
  channelId: string | undefined;
  page: number;
  pageSize: number;
  hideDownloaded: boolean;
  searchQuery: string;
  sortBy: string;
  sortOrder: string;
  tabType: string | null;
  maxRating: string;
  token: string | null;
  append?: boolean;
  resetKey?: string;
  minDuration?: number | null;
  maxDuration?: number | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  protectedFilter?: boolean;
  missingFilter?: boolean;
  ignoredFilter?: boolean;
}

interface UseChannelVideosResult {
  videos: ChannelVideo[];
  totalCount: number;
  oldestVideoDate: string | null;
  videoFailed: boolean;
  loading: boolean;
  error: Error | null;
  autoDownloadsEnabled: boolean;
  availableTabs: string[];
  refetch: () => Promise<void>;
}

export function useChannelVideos({
  channelId,
  page,
  pageSize,
  hideDownloaded,
  searchQuery,
  sortBy,
  sortOrder,
  tabType,
  maxRating,
  token,
  append = false,
  resetKey,
  minDuration,
  maxDuration,
  dateFrom,
  dateTo,
  protectedFilter,
  missingFilter,
  ignoredFilter,
}: UseChannelVideosParams): UseChannelVideosResult {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [oldestVideoDate, setOldestVideoDate] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [autoDownloadsEnabled, setAutoDownloadsEnabled] = useState<boolean>(false);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const resetKeyRef = useRef<string | undefined>(resetKey);

  const fetchVideos = useCallback(async () => {
    if (!channelId || !token || !tabType) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        hideDownloaded: hideDownloaded.toString(),
        searchQuery: searchQuery,
        sortBy: sortBy,
        sortOrder: sortOrder,
        tabType: tabType,
      });

      if (maxRating) {
        queryParams.set('maxRating', maxRating);
      }

      // Add optional filter params (convert duration from minutes to seconds)
      if (minDuration != null) {
        queryParams.append('minDuration', (minDuration * 60).toString());
      }
      if (maxDuration != null) {
        queryParams.append('maxDuration', (maxDuration * 60).toString());
      }
      if (dateFrom) {
        queryParams.append('dateFrom', dateFrom.toISOString().split('T')[0]);
      }
      if (dateTo) {
        queryParams.append('dateTo', dateTo.toISOString().split('T')[0]);
      }
      if (protectedFilter) {
        queryParams.append('protectedFilter', 'true');
      }
      if (missingFilter) {
        queryParams.append('missingFilter', 'true');
      }
      if (ignoredFilter) {
        queryParams.append('ignoredFilter', 'true');
      }

      const response = await fetch(`/getchannelvideos/${channelId}?${queryParams}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = await response.json();

      const incomingVideos: ChannelVideo[] = data.videos || [];
      const isReset = resetKeyRef.current !== resetKey;
      if (isReset) {
        resetKeyRef.current = resetKey;
      }

      if (data.videos !== undefined) {
        if (!isReset && append && page > 1) {
          setVideos((prev) => {
            const combined = [...prev, ...incomingVideos];
            const seen = new Set<string>();
            return combined.filter((video) => {
              if (seen.has(video.youtube_id)) return false;
              seen.add(video.youtube_id);
              return true;
            });
          });
        } else {
          setVideos(incomingVideos);
        }
      } else if (isReset) {
        setVideos([]);
      }
      setVideoFailed(data.videoFail || false);
      setTotalCount(data.totalCount || 0);
      setOldestVideoDate(data.oldestVideoDate || null);
      setAutoDownloadsEnabled(data.autoDownloadsEnabled || false);
      setAvailableTabs(data.availableTabs || []);
    } catch (err) {
      console.error('Error fetching channel videos:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [channelId, page, pageSize, hideDownloaded, searchQuery, sortBy, sortOrder, tabType, maxRating, token, append, resetKey, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    totalCount,
    oldestVideoDate,
    videoFailed,
    loading,
    error,
    autoDownloadsEnabled,
    availableTabs,
    refetch: fetchVideos,
  };
}
