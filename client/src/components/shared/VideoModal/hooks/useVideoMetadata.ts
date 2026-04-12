import { useState, useEffect } from 'react';
import axios from 'axios';
import { VideoExtendedMetadata } from '../types';

interface UseVideoMetadataReturn {
  metadata: VideoExtendedMetadata | null;
  loading: boolean;
  error: string | null;
}

export const useVideoMetadata = (
  youtubeId: string,
  token: string | null
): UseVideoMetadataReturn => {
  const [metadata, setMetadata] = useState<VideoExtendedMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!youtubeId || !token) {
      return;
    }

    let cancelled = false;

    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get<VideoExtendedMetadata>(
          `/api/videos/${youtubeId}/metadata`,
          { headers: { 'x-access-token': token } }
        );

        if (!cancelled) {
          setMetadata(response.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errorMessage =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            (err instanceof Error ? err.message : 'Failed to fetch video metadata');
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [youtubeId, token]);

  return { metadata, loading, error };
};
