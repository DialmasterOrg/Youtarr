import { useEffect, useState } from 'react';
import axios from 'axios';
import { VideoData } from '../../../types/VideoData';

export interface UseVideoByYoutubeIdResult {
  video: VideoData | null;
  notFound: boolean;
  loadError: string | null;
}

const IDLE_RESULT: UseVideoByYoutubeIdResult = { video: null, notFound: false, loadError: null };

// Loads the one video that matches a YouTube ID, for example from a link in a
// notification. A video that cleanup deleted is still returned until the trash
// is emptied, so "not found" is rare.
export function useVideoByYoutubeId(
  token: string | null,
  youtubeId: string | null
): UseVideoByYoutubeIdResult {
  const [result, setResult] = useState<UseVideoByYoutubeIdResult>(IDLE_RESULT);

  useEffect(() => {
    if (!token || !youtubeId) {
      setResult(IDLE_RESULT);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await axios.get<VideoData>(
          `/api/videos/${encodeURIComponent(youtubeId)}`,
          { headers: { 'x-access-token': token } }
        );
        if (cancelled) return;
        setResult({ video: response.data, notFound: false, loadError: null });
      } catch (error: unknown) {
        if (cancelled) return;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // An ID that does not look like a YouTube ID (400) is also a link to nothing.
        if (status === 404 || status === 400) {
          setResult({ video: null, notFound: true, loadError: null });
          return;
        }
        console.error('Failed to fetch video by YouTube ID:', error);
        setResult({ video: null, notFound: false, loadError: 'Failed to load the video.' });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token, youtubeId]);

  return result;
}
