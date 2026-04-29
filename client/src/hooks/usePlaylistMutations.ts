import { useCallback, useState } from 'react';
import axios from 'axios';
import {
  MediaServerType,
  Playlist,
  PlaylistPreview,
  PlaylistSubscribeSettings,
} from '../types/playlist';

interface UsePlaylistMutationsParams {
  token: string | null;
}

interface PlaylistResponse {
  playlist: Playlist;
}

const SYNC_KEY_BY_SERVER: Record<MediaServerType, keyof Playlist> = {
  plex: 'sync_to_plex',
  jellyfin: 'sync_to_jellyfin',
  emby: 'sync_to_emby',
};

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

function authHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { 'x-access-token': token } : undefined;
}

export const usePlaylistMutations = ({ token }: UsePlaylistMutationsParams) => {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fetchPlaylistInfo = useCallback(
    async (url: string): Promise<PlaylistPreview | null> => {
      if (!token) return null;
      setPending(true);
      setError(null);
      try {
        const res = await axios.post<PlaylistPreview>(
          '/api/playlists/addplaylistinfo',
          { url },
          { headers: authHeaders(token) }
        );
        return res.data;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to fetch playlist info'));
        return null;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const subscribe = useCallback(
    async (
      url: string,
      settings: PlaylistSubscribeSettings = {}
    ): Promise<Playlist | null> => {
      if (!token) return null;
      setPending(true);
      setError(null);
      try {
        const res = await axios.post<PlaylistResponse>(
          '/api/playlists',
          { url, settings },
          { headers: authHeaders(token) }
        );
        return res.data.playlist;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to subscribe to playlist'));
        return null;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const unsubscribe = useCallback(
    async (playlistId: string): Promise<boolean> => {
      if (!token) return false;
      setPending(true);
      setError(null);
      try {
        await axios.delete(`/api/playlists/${playlistId}`, { headers: authHeaders(token) });
        return true;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to unsubscribe'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const updateSettings = useCallback(
    async (
      playlistId: string,
      settings: PlaylistSubscribeSettings
    ): Promise<boolean> => {
      if (!token) return false;
      setPending(true);
      setError(null);
      try {
        await axios.put(`/api/playlists/${playlistId}/settings`, settings, { headers: authHeaders(token) });
        return true;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to update settings'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const patchPlaylist = useCallback(
    async (
      playlistId: string,
      patch: Partial<Pick<Playlist, 'enabled' | 'auto_download' | 'sync_to_plex' | 'sync_to_jellyfin' | 'sync_to_emby' | 'public_on_servers'>>
    ): Promise<Playlist | null> => {
      if (!token) return null;
      setPending(true);
      setError(null);
      try {
        const res = await axios.patch<PlaylistResponse>(
          `/api/playlists/${playlistId}`,
          patch,
          { headers: authHeaders(token) }
        );
        return res.data.playlist;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to update playlist'));
        return null;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const toggleSyncTarget = useCallback(
    async (
      playlistId: string,
      server: MediaServerType,
      enabled: boolean
    ): Promise<Playlist | null> => {
      const key = SYNC_KEY_BY_SERVER[server];
      return patchPlaylist(playlistId, { [key]: enabled } as Partial<Playlist>);
    },
    [patchPlaylist]
  );

  const togglePublic = useCallback(
    async (playlistId: string, isPublic: boolean): Promise<Playlist | null> => {
      return patchPlaylist(playlistId, { public_on_servers: isPublic });
    },
    [patchPlaylist]
  );

  const ignoreVideo = useCallback(
    async (playlistId: string, ytId: string): Promise<boolean> => {
      if (!token) return false;
      setPending(true);
      setError(null);
      try {
        await axios.post(
          `/api/playlists/${playlistId}/videos/${ytId}/ignore`,
          {},
          { headers: authHeaders(token) }
        );
        return true;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to ignore video'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const unignoreVideo = useCallback(
    async (playlistId: string, ytId: string): Promise<boolean> => {
      if (!token) return false;
      setPending(true);
      setError(null);
      try {
        await axios.post(
          `/api/playlists/${playlistId}/videos/${ytId}/unignore`,
          {},
          { headers: authHeaders(token) }
        );
        return true;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to unignore video'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  return {
    error,
    pending,
    fetchPlaylistInfo,
    subscribe,
    unsubscribe,
    updateSettings,
    patchPlaylist,
    toggleSyncTarget,
    togglePublic,
    ignoreVideo,
    unignoreVideo,
  };
};
