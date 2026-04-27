import { useState, useCallback, useEffect } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { ChipFilterMode } from '../../shared/VideoList/types';

interface RefreshResult {
  videos: ChannelVideo[];
  totalCount: number;
  oldestVideoDate: string | null;
}

interface UseRefreshChannelVideosResult {
  refreshVideos: () => Promise<RefreshResult | null>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useRefreshChannelVideos(
  channelId: string | undefined,
  page: number,
  pageSize: number,
  downloadedFilter: ChipFilterMode,
  tabType: string | null,
  token: string | null
): UseRefreshChannelVideosResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset loading state when tab changes (the load is per-tab, not global)
  useEffect(() => {
    setLoading(false);
    setError(null);
  }, [tabType]);

  const refreshVideos = useCallback(async (): Promise<RefreshResult | null> => {
    if (!channelId || !token || !tabType) return null;

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        tabType: tabType,
      });
      if (downloadedFilter && downloadedFilter !== 'off') {
        queryParams.set('downloadedFilter', downloadedFilter);
      }
      const response = await fetch(
        `/fetchallchannelvideos/${channelId}?${queryParams}`,
        {
          method: 'POST',
          headers: {
            'x-access-token': token,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 409 || data.error === 'FETCH_IN_PROGRESS') {
          throw new Error('A fetch operation is already in progress for this channel. Please wait for it to complete.');
        }
        throw new Error(data.message || 'Failed to fetch all videos');
      }

      return {
        videos: data.videos || [],
        totalCount: data.totalCount || 0,
        oldestVideoDate: data.oldestVideoDate || null,
      };
    } catch (err: any) {
      console.error('Error fetching all videos:', err);
      setError(err.message || 'Failed to fetch all videos for channel');
      return null;
    } finally {
      setLoading(false);
    }
  }, [channelId, page, pageSize, downloadedFilter, tabType, token]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    refreshVideos,
    loading,
    error,
    clearError,
  };
}
