import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Playlist } from '../../../types/Playlist';

interface UsePlaylistListParams {
  token: string | null;
  page: number;
  pageSize: number;
  searchTerm: string;
  sortOrder: 'asc' | 'desc';
  subFolder?: string;
}

interface PlaylistListResponse {
  playlists: Playlist[];
  total: number;
  totalPages: number;
  subFolders?: Array<string | null>;
}

export const usePlaylistList = ({
  token,
  page,
  pageSize,
  searchTerm,
  sortOrder,
  subFolder,
}: UsePlaylistListParams) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subFolders, setSubFolders] = useState<string[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchPlaylists = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page,
        pageSize,
        search: searchTerm,
        sortBy: 'uploader',
        sortOrder: sortOrder.toUpperCase(),
      };

      if (subFolder !== undefined) {
        params.subFolder = subFolder;
      }

      const response = await axios.get<PlaylistListResponse>('/getplaylists', {
        params,
        headers: {
          'x-access-token': token,
        },
      });

      if (isMountedRef.current) {
        setPlaylists(response.data.playlists || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 0);
        setSubFolders((response.data.subFolders || []).filter((f): f is string => f !== null));
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to load playlists';
      if (isMountedRef.current) {
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [token, page, pageSize, searchTerm, sortOrder, subFolder]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return {
    playlists,
    total,
    totalPages,
    loading,
    error,
    refetch: fetchPlaylists,
    subFolders,
  };
};
