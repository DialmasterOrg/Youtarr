import { useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../../utils/requestError';

// Callers show this after their own "Failed to delete videos:", so it reads as
// the reason, not as a second statement of the failure.
const DELETE_ERROR = 'The request failed. Please try again.';

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

  // `toFailed` builds the per-video failures for a request that failed as a whole.
  const runDelete = async (
    data: { videoIds: number[] } | { youtubeIds: string[] },
    token: string | null,
    toFailed: (error: string) => DeletionResult['failed']
  ): Promise<DeletionResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.delete<DeletionResult>('/api/videos', {
        headers: {
          'x-access-token': token || '',
        },
        data,
      });

      setLoading(false);
      return response.data;
    } catch (err: unknown) {
      const errorMessage = serverErrorMessage(err, DELETE_ERROR);
      setError(errorMessage);
      setLoading(false);

      return { success: false, deleted: [], failed: toFailed(errorMessage) };
    }
  };

  const deleteVideos = (videoIds: number[], token: string | null): Promise<DeletionResult> =>
    runDelete({ videoIds }, token, (error) => videoIds.map((id) => ({ videoId: id, error })));

  const deleteVideosByYoutubeIds = (youtubeIds: string[], token: string | null): Promise<DeletionResult> =>
    runDelete({ youtubeIds }, token, (error) => youtubeIds.map((id) => ({ youtubeId: id, error })));

  return {
    deleteVideos,
    deleteVideosByYoutubeIds,
    loading,
    error,
  };
};
