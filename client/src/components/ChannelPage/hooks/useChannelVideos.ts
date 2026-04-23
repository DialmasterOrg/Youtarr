import { useState, useEffect, useCallback, useRef } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { ChipFilterMode } from '../../shared/VideoList/types';

interface UseChannelVideosParams {
  channelId: string | undefined;
  page: number;
  pageSize: number;
  downloadedFilter: ChipFilterMode;
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
  protectedFilter?: ChipFilterMode;
  missingFilter?: ChipFilterMode;
  ignoredFilter?: ChipFilterMode;
}

interface UseChannelVideosResult {
  videos: ChannelVideo[];
  totalCount: number;
  oldestVideoDate: string | null;
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
  downloadedFilter,
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
        searchQuery: searchQuery,
        sortBy: sortBy,
        sortOrder: sortOrder,
        tabType: tabType,
      });

      if (downloadedFilter && downloadedFilter !== 'off') {
        queryParams.set('downloadedFilter', downloadedFilter);
      }

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
        // dateFrom is a local-midnight Date for the picked day; send as a full ISO
        // timestamp so the server compares against publishedAt in the viewer's
        // timezone, not UTC (avoids off-by-one near midnight).
        queryParams.append('dateFrom', dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        queryParams.append('dateTo', endOfDay.toISOString());
      }
      if (protectedFilter && protectedFilter !== 'off') {
        queryParams.append('protectedFilter', protectedFilter);
      }
      if (missingFilter && missingFilter !== 'off') {
        queryParams.append('missingFilter', missingFilter);
      }
      if (ignoredFilter && ignoredFilter !== 'off') {
        queryParams.append('ignoredFilter', ignoredFilter);
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
      setTotalCount(data.totalCount || 0);
      setOldestVideoDate(data.oldestVideoDate || null);
      setAutoDownloadsEnabled(data.autoDownloadsEnabled || false);
      setAvailableTabs(data.availableTabs || []);
      // Server sets fetchError when the upstream YouTube fetch failed and
      // no cached fallback was available. Surface it as an error so the UI
      // distinguishes "fetch failed" from "filter matched nothing".
      if (data.fetchError) {
        setError(new Error('Failed to fetch channel videos'));
      }
    } catch (err) {
      console.error('Error fetching channel videos:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [channelId, page, pageSize, downloadedFilter, searchQuery, sortBy, sortOrder, tabType, maxRating, token, append, resetKey, minDuration, maxDuration, dateFrom, dateTo, protectedFilter, missingFilter, ignoredFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    totalCount,
    oldestVideoDate,
    loading,
    error,
    autoDownloadsEnabled,
    availableTabs,
    refetch: fetchVideos,
  };
}
