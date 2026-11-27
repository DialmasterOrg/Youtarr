import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../utils/requestError';
import { Playlist } from '../types/playlist';

interface UsePlaylistListParams {
  token: string | null;
  page?: number;
  pageSize?: number;
}

interface PlaylistListResponse {
  total: number;
  playlists: Playlist[];
}

export const usePlaylistList = ({
  token,
  page = 1,
  pageSize = 25,
}: UsePlaylistListParams) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!token) {
      setPlaylists([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<PlaylistListResponse>('/api/playlists', {
        headers: { 'x-access-token': token },
        params: { page, pageSize },
      });
      setPlaylists(response.data.playlists || []);
      setTotal(response.data.total || 0);
    } catch (err: unknown) {
      setError(serverErrorMessage(err, 'Failed to load playlists'));
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return {
    playlists,
    total,
    loading,
    error,
    refetch: fetchPlaylists,
  };
};
