import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Playlist, PlaylistVideo } from '../types/playlist';

export interface DownloadOverrideSettings {
  resolution?: string;
  allowRedownload?: boolean;
  subfolder?: string | null;
  audioFormat?: string | null;
  rating?: string | null;
  skipVideoFolder?: boolean;
}

export type PlaylistSortOrder = 'asc' | 'desc' | 'recent';
export type PlaylistDownloadState = 'all' | 'downloaded' | 'not_downloaded';

const DEFAULT_PAGE_SIZE = 50;

interface UsePlaylistDetailParams {
  token: string | null;
  playlistId: string | null;
  pageSize?: number;
  sortOrder?: PlaylistSortOrder;
  downloadState?: PlaylistDownloadState;
}

interface PlaylistDetailResponse {
  playlist: Playlist;
  not_downloaded_count?: number;
  // Downloaded items lacking the file type the playlist syncs as (mp3 for
  // MP3 Only playlists, video otherwise); media server sync leaves them out.
  unsyncable_count?: number;
}

interface PlaylistVideosResponse {
  total: number;
  videos: PlaylistVideo[];
}

function authHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { 'x-access-token': token } : undefined;
}

function mergeUniqueById(existing: PlaylistVideo[], incoming: PlaylistVideo[]): PlaylistVideo[] {
  const seen = new Set(existing.map((v) => v.id));
  const merged = [...existing];
  for (const video of incoming) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push(video);
  }
  return merged;
}

export const usePlaylistDetail = ({
  token,
  playlistId,
  pageSize = DEFAULT_PAGE_SIZE,
  sortOrder = 'asc',
  downloadState = 'all',
}: UsePlaylistDetailParams) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [notDownloadedCount, setNotDownloadedCount] = useState<number | null>(null);
  const [unsyncableCount, setUnsyncableCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!(token && playlistId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks the highest video page currently loaded; a request-id guard drops
  // stale responses when a sort change or reset races with an in-flight fetch.
  const pageRef = useRef(1);
  const requestIdRef = useRef(0);

  const loadInitial = useCallback(async () => {
    if (!token || !playlistId) {
      setPlaylist(null);
      setVideos([]);
      setVideoTotal(0);
      setNotDownloadedCount(null);
      setUnsyncableCount(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    pageRef.current = 1;
    setLoading(true);
    setError(null);

    const headers = authHeaders(token);

    try {
      const [playlistRes, videosRes] = await Promise.all([
        axios.get<PlaylistDetailResponse>(`/api/playlists/${playlistId}`, { headers }),
        axios.get<PlaylistVideosResponse>(`/api/playlists/${playlistId}/videos`, {
          headers,
          // 'all' is the server default; no need to send it.
          params: { page: 1, pageSize, sortOrder, ...(downloadState !== 'all' && { downloadState }) },
        }),
      ]);
      if (requestId !== requestIdRef.current) return;
      setPlaylist(playlistRes.data.playlist || null);
      setNotDownloadedCount(
        typeof playlistRes.data.not_downloaded_count === 'number'
          ? playlistRes.data.not_downloaded_count
          : null
      );
      setUnsyncableCount(
        typeof playlistRes.data.unsyncable_count === 'number'
          ? playlistRes.data.unsyncable_count
          : null
      );
      setVideos(videosRes.data.videos || []);
      setVideoTotal(videosRes.data.total || 0);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
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
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [token, playlistId, pageSize, sortOrder, downloadState]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const hasMore = videos.length < videoTotal;

  const loadMore = useCallback(async () => {
    if (!token || !playlistId) return;
    if (loading || loadingMore) return;
    if (videos.length >= videoTotal) return;

    const requestId = requestIdRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);

    try {
      const res = await axios.get<PlaylistVideosResponse>(
        `/api/playlists/${playlistId}/videos`,
        {
          headers: authHeaders(token),
          params: { page: nextPage, pageSize, sortOrder, ...(downloadState !== 'all' && { downloadState }) },
        }
      );
      // A reset (sort change / refetch) happened mid-flight; discard this page.
      if (requestId !== requestIdRef.current) return;
      pageRef.current = nextPage;
      setVideos((prev) => mergeUniqueById(prev, res.data.videos || []));
      setVideoTotal(res.data.total || 0);
    } catch {
      // Keep the videos already loaded; a failed "load more" should not wipe them.
    } finally {
      setLoadingMore(false);
    }
  }, [token, playlistId, pageSize, sortOrder, downloadState, loading, loadingMore, videos.length, videoTotal]);

  // Refreshes only playlist meta + the not-downloaded count without reloading
  // the (paginated) video list, so scroll position is preserved.
  const refetchMeta = useCallback(async () => {
    if (!token || !playlistId) return;
    try {
      const res = await axios.get<PlaylistDetailResponse>(
        `/api/playlists/${playlistId}`,
        { headers: authHeaders(token) }
      );
      setPlaylist(res.data.playlist || null);
      setNotDownloadedCount(
        typeof res.data.not_downloaded_count === 'number'
          ? res.data.not_downloaded_count
          : null
      );
      setUnsyncableCount(
        typeof res.data.unsyncable_count === 'number'
          ? res.data.unsyncable_count
          : null
      );
    } catch {
      // Keep existing meta on failure.
    }
  }, [token, playlistId]);

  const markVideoIgnored = useCallback((youtubeId: string, ignored: boolean) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.youtube_id === youtubeId
          ? { ...v, ignored, ignored_at: ignored ? new Date().toISOString() : null }
          : v
      )
    );
  }, []);

  // Updates the row in place after the user deletes a video's local file, so
  // the (paginated) list reflects the deletion without losing scroll position.
  const markVideoDeleted = useCallback((youtubeId: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.youtube_id === youtubeId
          ? { ...v, downloaded: false, previously_downloaded: true }
          : v
      )
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/refresh`,
      {},
      { headers: authHeaders(token) }
    );
    await loadInitial();
  }, [token, playlistId, loadInitial]);

  const sync = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/sync`,
      {},
      { headers: authHeaders(token) }
    );
    await loadInitial();
  }, [token, playlistId, loadInitial]);

  const regenerateM3U = useCallback(async () => {
    if (!token || !playlistId) return;
    await axios.post(
      `/api/playlists/${playlistId}/regenerate-m3u`,
      {},
      { headers: authHeaders(token) }
    );
  }, [token, playlistId]);

  const triggerDownload = useCallback(
    async (videoIds?: string[], overrideSettings?: DownloadOverrideSettings) => {
      if (!token || !playlistId) return;
      const body: { videoIds?: string[]; overrideSettings?: DownloadOverrideSettings } = {};
      if (videoIds && videoIds.length > 0) body.videoIds = videoIds;
      if (overrideSettings) body.overrideSettings = overrideSettings;
      await axios.post(
        `/api/playlists/${playlistId}/download`,
        body,
        { headers: authHeaders(token) }
      );
    },
    [token, playlistId]
  );

  return {
    playlist,
    videos,
    videoTotal,
    notDownloadedCount,
    unsyncableCount,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch: loadInitial,
    refetchMeta,
    markVideoIgnored,
    markVideoDeleted,
    refresh,
    sync,
    regenerateM3U,
    triggerDownload,
  };
};
