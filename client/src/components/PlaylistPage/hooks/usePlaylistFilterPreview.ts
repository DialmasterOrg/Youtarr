import { useCallback, useRef, useState } from 'react';
import axios from 'axios';

/** A playlist's download filters; durations are in seconds. */
export interface PlaylistFilterValues {
  title_filter_regex: string | null;
  min_duration: number | null;
  max_duration: number | null;
}

/** Whether any download filter is set; a blank title pattern counts as none. */
export function hasDownloadFilters(filters: PlaylistFilterValues): boolean {
  return filters.min_duration != null || filters.max_duration != null || Boolean(filters.title_filter_regex?.trim());
}

export interface PlaylistFilterPreviewVideo {
  youtube_id: string;
  title: string | null;
  duration: number | null;
  matches: boolean;
}

export interface PlaylistFilterPreview {
  totalCount: number;
  matchCount: number;
  // Discoveries since the starting point that would download automatically;
  // null when the playlist has no starting point yet.
  waitingCount: number | null;
  // The server lists only the most recently discovered videos.
  truncated: boolean;
  videos: PlaylistFilterPreviewVideo[];
}

interface UsePlaylistFilterPreviewParams {
  token: string | null;
  playlistId: string;
}

const GENERIC_ERROR = 'Could not preview the filters. Please try again.';

function previewErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return GENERIC_ERROR;
  const status = err.response?.status;
  if (status === 404) return 'This playlist no longer exists.';
  const message = err.response?.data?.error;
  return status === 400 && typeof message === 'string' ? message : GENERIC_ERROR;
}

/**
 * Asks the server what proposed download filters would do to a playlist,
 * without saving them. A response is dropped when clearPreview superseded it,
 * so an edited filter never shows stale results. Only one request runs at a
 * time and `loading` stays true until it settles, even after clearPreview:
 * the server keeps evaluating a superseded request, and each one is a regex
 * worker.
 */
export function usePlaylistFilterPreview({ token, playlistId }: UsePlaylistFilterPreviewParams) {
  const [preview, setPreview] = useState<PlaylistFilterPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const runPreview = useCallback(
    async (filters: PlaylistFilterValues): Promise<void> => {
      if (!token || inFlightRef.current) return;
      const requestId = ++requestIdRef.current;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.post<PlaylistFilterPreview>(
          `/api/playlists/${playlistId}/filter-preview`,
          filters,
          { headers: { 'x-access-token': token } }
        );
        if (requestId !== requestIdRef.current) return;
        setPreview(data);
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        setPreview(null);
        setError(previewErrorMessage(err));
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [token, playlistId]
  );

  const clearPreview = useCallback(() => {
    requestIdRef.current += 1;
    setPreview(null);
    setError(null);
  }, []);

  return { preview, loading, error, runPreview, clearPreview };
}
