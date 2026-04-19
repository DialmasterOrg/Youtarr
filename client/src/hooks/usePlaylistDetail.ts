import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Playlist, PlaylistVideo } from '../types/playlist';

interface UsePlaylistDetailParams {
  token: string | null;
  playlistId: string | null;
  videoPage?: number;
  videoPageSize?: number;
}

interface PlaylistDetailResponse {
  playlist: Playlist;
}

interface PlaylistVideosResponse {
  total: number;
  videos: PlaylistVideo[];
}

function authHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { 'x-access-token': token } : undefined;
}

export const usePlaylistDetail = ({
  token,
  playlistId,
  videoPage = 1,
  videoPageSize = 50,
}: UsePlaylistDetailParams) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [loading, setLoading] = useState(!!(token && playlistId));
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylist = useCallback(async () => {
    if (!token || !playlistId) {
      setPlaylist(null);
      setVideos([]);
      setVideoTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const headers = authHeaders(token);

    try {
      const [playlistRes, videosRes] = await Promise.all([
        axios.get<PlaylistDetailResponse>(`/api/playlists/${playlistId}`, { headers }),
        axios.get<PlaylistVideosResponse>(`/api/playlists/${playlistId}/videos`, {
          headers,
          params: { page: videoPage, pageSize: videoPageSize },
        }),
      ]);
      setPlaylist(playlistRes.data.playlist || null);
      setVideos(videosRes.data.videos || []);
      setVideoTotal(videosRes.data.total || 0);
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404) {
        setError('Playlist not found');
      } else {
        const message =
          (axios.isAxiosError(err) && err.response?.data?.error) ||
          'Failed to load playlist';
        setError(typeof message === 'string' ? message : 'Failed to load playlist');
      }
    } finally {
      setLoading(false);
    }
  }, [token, playlistId, videoPage, videoPageSize]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const refresh = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/refresh`,
      {},
      { headers: authHeaders(token) }
    );
    await fetchPlaylist();
  }, [token, playlistId, fetchPlaylist]);

  const sync = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/sync`,
      {},
      { headers: authHeaders(token) }
    );
    await fetchPlaylist();
  }, [token, playlistId, fetchPlaylist]);

  const regenerateM3U = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/regenerate-m3u`,
      {},
      { headers: authHeaders(token) }
    );
  }, [token, playlistId]);

  const triggerDownload = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/download`,
      {},
      { headers: authHeaders(token) }
    );
  }, [token, playlistId]);

  return {
    playlist,
    videos,
    videoTotal,
    loading,
    error,
    refetch: fetchPlaylist,
    refresh,
    sync,
    regenerateM3U,
    triggerDownload,
  };
};
