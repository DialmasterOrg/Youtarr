import { useCallback, useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../utils/requestError';
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
  restored?: boolean;
  warning?: string;
}

export interface PlaylistSubscribeResult {
  playlist: Playlist;
  warning?: string;
  // True when subscribing re-enabled a previously removed playlist, which
  // keeps its old settings instead of the ones submitted with the request.
  restored: boolean;
}

type AuthHeaders = Record<string, string>;

const SYNC_KEY_BY_SERVER: Record<MediaServerType, keyof Playlist> = {
  plex: 'sync_to_plex',
  jellyfin: 'sync_to_jellyfin',
  emby: 'sync_to_emby',
};

export const usePlaylistMutations = ({ token }: UsePlaylistMutationsParams) => {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Runs one request with the shared pending and error state. Resolves to
  // `failed` without a session or when the request fails.
  const run = useCallback(
    async <T>(failed: T, fallback: string, request: (headers: AuthHeaders) => Promise<T>): Promise<T> => {
      if (!token) return failed;
      setPending(true);
      setError(null);
      try {
        return await request({ 'x-access-token': token });
      } catch (err: unknown) {
        setError(serverErrorMessage(err, fallback));
        return failed;
      } finally {
        setPending(false);
      }
    },
    [token]
  );

  const fetchPlaylistInfo = useCallback(
    (url: string): Promise<PlaylistPreview | null> =>
      run<PlaylistPreview | null>(null, 'Failed to fetch playlist info', async (headers) => {
        const res = await axios.post<PlaylistPreview>('/api/playlists/addplaylistinfo', { url }, { headers });
        return res.data;
      }),
    [run]
  );

  const subscribe = useCallback(
    (url: string, settings: PlaylistSubscribeSettings = {}): Promise<PlaylistSubscribeResult | null> =>
      run<PlaylistSubscribeResult | null>(null, 'Failed to subscribe to playlist', async (headers) => {
        const res = await axios.post<PlaylistResponse>('/api/playlists', { url, settings }, { headers });
        return { playlist: res.data.playlist, restored: Boolean(res.data.restored), ...(res.data.warning && { warning: res.data.warning }) };
      }),
    [run]
  );

  const unsubscribe = useCallback(
    (playlistId: string): Promise<boolean> =>
      run(false, 'Failed to unsubscribe', async (headers) => {
        await axios.delete(`/api/playlists/${playlistId}`, { headers });
        return true;
      }),
    [run]
  );

  const updateSettings = useCallback(
    (playlistId: string, settings: PlaylistSubscribeSettings): Promise<boolean> =>
      run(false, 'Failed to update settings', async (headers) => {
        await axios.put(`/api/playlists/${playlistId}/settings`, settings, { headers });
        return true;
      }),
    [run]
  );

  const patchPlaylist = useCallback(
    (
      playlistId: string,
      patch: Partial<Pick<Playlist, 'enabled' | 'auto_download' | 'sync_to_plex' | 'sync_to_jellyfin' | 'sync_to_emby' | 'public_on_servers'>>
    ): Promise<Playlist | null> =>
      run<Playlist | null>(null, 'Failed to update playlist', async (headers) => {
        const res = await axios.patch<PlaylistResponse>(`/api/playlists/${playlistId}`, patch, { headers });
        return res.data.playlist;
      }),
    [run]
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

  const toggleAutoDownload = useCallback(
    async (playlistId: string, enabled: boolean): Promise<Playlist | null> => {
      return patchPlaylist(playlistId, { auto_download: enabled });
    },
    [patchPlaylist]
  );

  const setVideoIgnored = useCallback(
    (playlistId: string, ytId: string, action: 'ignore' | 'unignore'): Promise<boolean> =>
      run(false, `Failed to ${action} video`, async (headers) => {
        await axios.post(`/api/playlists/${playlistId}/videos/${ytId}/${action}`, {}, { headers });
        return true;
      }),
    [run]
  );

  const ignoreVideo = useCallback(
    (playlistId: string, ytId: string): Promise<boolean> => setVideoIgnored(playlistId, ytId, 'ignore'),
    [setVideoIgnored]
  );

  const unignoreVideo = useCallback(
    (playlistId: string, ytId: string): Promise<boolean> => setVideoIgnored(playlistId, ytId, 'unignore'),
    [setVideoIgnored]
  );

  // Resolves to how many of the videos were newly ignored (the server leaves
  // already ignored ones alone), or null when the request failed.
  const ignoreVideos = useCallback(
    (playlistId: string, ytIds: string[]): Promise<number | null> =>
      run<number | null>(null, 'Failed to ignore videos', async (headers) => {
        const res = await axios.post<{ ignored?: number }>(
          `/api/playlists/${playlistId}/videos/bulk-ignore`,
          { videoIds: ytIds },
          { headers }
        );
        return typeof res.data?.ignored === 'number' ? res.data.ignored : ytIds.length;
      }),
    [run]
  );

  // Called as the playlist page unmounts, so it sets no state. A failure needs
  // no handling: the server runs the waiting refresh itself after its delay.
  const runPendingRefresh = useCallback(
    async (playlistId: string): Promise<void> => {
      if (!token) return;
      try {
        await axios.post(
          `/api/playlists/${playlistId}/run-pending-refresh`,
          {},
          { headers: { 'x-access-token': token } }
        );
      } catch {
        // Covered by the server's own delay.
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
    toggleAutoDownload,
    ignoreVideo,
    unignoreVideo,
    ignoreVideos,
    runPendingRefresh,
  };
};
