import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { EpisodeAssignment, VideoEpisode } from '../../../types/titleShows';
import { serverMessageOf, toRequestError } from '../Reorganize/reorganizeErrors';

export interface UseVideoEpisodeResult {
  data: VideoEpisode | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /**
   * Assign the episode, mark "Not an episode" or return to automatic
   * classification. Throws a ReorganizeRequiredError when the downloaded file
   * has to move, else an Error with the server's message.
   */
  assign: (assignment: EpisodeAssignment) => Promise<void>;
}

/** A video's title show episode (GET/PUT /api/videos/:youtubeId/episode). */
export function useVideoEpisode(youtubeId: string | null, token: string | null): UseVideoEpisodeResult {
  const [data, setData] = useState<VideoEpisode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const url = youtubeId ? `/api/videos/${encodeURIComponent(youtubeId)}/episode` : null;

  const refetch = useCallback(async () => {
    if (!url || !token) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<VideoEpisode>(url, { headers: { 'x-access-token': token } });
      if (seq === requestSeq.current) setData(response.data);
    } catch (err) {
      if (seq === requestSeq.current) setError(serverMessageOf(err, 'Failed to load the episode'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [url, token]);

  useEffect(() => {
    setData(null);
    void refetch();
  }, [refetch]);

  const assign = useCallback(async (assignment: EpisodeAssignment) => {
    if (!url || !token) throw new Error('Not signed in');
    const seq = ++requestSeq.current;
    try {
      const response = await axios.put<VideoEpisode>(url, assignment, { headers: { 'x-access-token': token } });
      if (seq === requestSeq.current) setData(response.data);
    } catch (err) {
      throw toRequestError(err, 'Failed to save the episode');
    }
  }, [url, token]);

  return { data, loading, error, refetch, assign };
}

export default useVideoEpisode;
