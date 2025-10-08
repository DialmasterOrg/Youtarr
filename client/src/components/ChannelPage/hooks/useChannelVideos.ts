import { useState, useEffect, useCallback } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';

interface UseChannelVideosParams {
  channelId: string | undefined;
  page: number;
  pageSize: number;
  hideDownloaded: boolean;
  searchQuery: string;
  sortBy: string;
  sortOrder: string;
  tabType: string;
  token: string | null;
}

interface UseChannelVideosResult {
  videos: ChannelVideo[];
  totalCount: number;
  oldestVideoDate: string | null;
  videoFailed: boolean;
  loading: boolean;
  error: Error | null;
  autoDownloadsEnabled: boolean;
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
  token,
}: UseChannelVideosParams): UseChannelVideosResult {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [oldestVideoDate, setOldestVideoDate] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [autoDownloadsEnabled, setAutoDownloadsEnabled] = useState<boolean>(false);

  const fetchVideos = useCallback(async () => {
    if (!channelId || !token) return;

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

      const response = await fetch(`/getchannelvideos/${channelId}?${queryParams}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = await response.json();

      if (data.videos !== undefined) {
        setVideos(data.videos || []);
      }
      setVideoFailed(data.videoFail || false);
      setTotalCount(data.totalCount || 0);
      setOldestVideoDate(data.oldestVideoDate || null);
      setAutoDownloadsEnabled(data.autoDownloadsEnabled || false);
    } catch (err) {
      console.error('Error fetching channel videos:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [channelId, page, pageSize, hideDownloaded, searchQuery, sortBy, sortOrder, tabType, token]);

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
    refetch: fetchVideos,
  };
}
