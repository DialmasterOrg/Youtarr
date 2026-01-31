import { useState, useCallback } from 'react';
import axios from 'axios';
import { Playlist } from '../../../types/Playlist';

export const usePlaylistMutations = (token: string | null, onSuccess?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPlaylist = useCallback(async (url: string) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        '/addplaylistinfo',
        { url },
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      if (response.data.status === 'success') {
        // Now enable the playlist
        const playlistId = response.data.playlistInfo.playlist_id;
        await axios.put(
          `/api/playlists/${playlistId}/settings`,
          { enabled: true },
          {
            headers: {
              'x-access-token': token,
            },
          }
        );

        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(response.data.message || 'Failed to add playlist');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to add playlist';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, onSuccess]);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      await axios.delete(`/api/playlists/${playlistId}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to delete playlist';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, onSuccess]);

  const updatePlaylist = useCallback(async (playlistId: string, updates: Partial<Playlist>) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      await axios.put(
        `/api/playlists/${playlistId}/settings`,
        updates,
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to update playlist';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, onSuccess]);

  const fetchPlaylistVideos = useCallback(async (playlistId: string) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      await axios.post(
        `/fetchallplaylistvideos/${playlistId}`,
        {},
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      if (onSuccess) {
        onSuccess();
      }

      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch playlist videos';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, onSuccess]);

  const downloadPlaylist = useCallback(async (playlistId: string) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `/api/playlists/${playlistId}/download`,
        {},
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      if (onSuccess) {
        onSuccess();
      }

      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to queue playlist download';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, onSuccess]);

  return {
    addPlaylist,
    deletePlaylist,
    updatePlaylist,
    fetchPlaylistVideos,
    downloadPlaylist,
    loading,
    error,
  };
};
