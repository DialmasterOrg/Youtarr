import { useState } from 'react';
import axios from 'axios';

interface DeletionResult {
  success: boolean;
  deleted: (number | string)[];
  failed: Array<{ videoId?: number; youtubeId?: string; error: string }>;
}

interface UseVideoDeletionReturn {
  deleteVideos: (videoIds: number[], token: string | null) => Promise<DeletionResult>;
  deleteVideosByYoutubeIds: (youtubeIds: string[], token: string | null) => Promise<DeletionResult>;
  loading: boolean;
  error: string | null;
}

export const useVideoDeletion = (): UseVideoDeletionReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteVideos = async (
    videoIds: number[],
    token: string | null
  ): Promise<DeletionResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.delete<DeletionResult>('/api/videos', {
        headers: {
          'x-access-token': token || '',
        },
        data: {
          videoIds,
        },
      });

      setLoading(false);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete videos';
      setError(errorMessage);
      setLoading(false);

      // Return a failed result
      return {
        success: false,
        deleted: [],
        failed: videoIds.map(id => ({ videoId: id, error: errorMessage })),
      };
    }
  };

  const deleteVideosByYoutubeIds = async (
    youtubeIds: string[],
    token: string | null
  ): Promise<DeletionResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.delete<DeletionResult>('/api/videos', {
        headers: {
          'x-access-token': token || '',
        },
        data: {
          youtubeIds,
        },
      });

      setLoading(false);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete videos';
      setError(errorMessage);
      setLoading(false);

      // Return a failed result
      return {
        success: false,
        deleted: [],
        failed: youtubeIds.map(id => ({ youtubeId: id, error: errorMessage })),
      };
    }
  };

  return {
    deleteVideos,
    deleteVideosByYoutubeIds,
    loading,
    error,
  };
};
