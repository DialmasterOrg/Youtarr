import { useState, useCallback } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';

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
  hideDownloaded: boolean,
  token: string | null
): UseRefreshChannelVideosResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVideos = useCallback(async (): Promise<RefreshResult | null> => {
    if (!channelId || !token) return null;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/fetchallchannelvideos/${channelId}?page=${page}&pageSize=${pageSize}&hideDownloaded=${hideDownloaded}`,
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
  }, [channelId, page, pageSize, hideDownloaded, token]);

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
