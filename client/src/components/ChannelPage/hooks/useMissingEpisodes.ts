import { useEffect, useState } from 'react';
import axios from 'axios';
import { MissingEpisodes } from '../../../types/titleShows';
import { serverMessageOf } from '../../shared/Reorganize/reorganizeErrors';

export interface UseMissingEpisodesResult {
  data: MissingEpisodes | null;
  loading: boolean;
  error: string | null;
}

/** A title show's episodes that aren't downloaded, and the numbers missing from its seasons. */
export function useMissingEpisodes(channelId: string | undefined, showId: number | null, token: string | null): UseMissingEpisodesResult {
  const [data, setData] = useState<MissingEpisodes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!channelId || showId === null || !token) return undefined;
    let cancelled = false;
    setLoading(true);
    axios.get<MissingEpisodes>(
      `/api/channels/${encodeURIComponent(channelId)}/tv/shows/${showId}/missing`,
      { headers: { 'x-access-token': token } }
    )
      .then((response) => { if (!cancelled) setData(response.data); })
      .catch((err) => { if (!cancelled) setError(serverMessageOf(err, 'Failed to load the missing episodes')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId, showId, token]);

  return { data, loading, error };
}

export default useMissingEpisodes;
