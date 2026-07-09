import { useCallback, useState } from 'react';
import axios, { AxiosError } from 'axios';

export interface FilenamePreviewData {
  fileLine: string;
  folderLine: string;
  fileLineLength: number;
  folderLineLength: number;
}

export interface UseFilenamePreviewResult {
  data: FilenamePreviewData | null;
  /** The prefix that produced `data`, or null when no preview has run yet. */
  previewedPrefix: string | null;
  loading: boolean;
  /** yt-dlp's own stderr message on a 400, or a generic message on other errors. */
  error: string | null;
  run: (prefix: string) => Promise<FilenamePreviewData | null>;
  /** True when `data` is non-null AND the active prefix differs from previewedPrefix. */
  isStale: (currentPrefix: string) => boolean;
}

interface ApiErrorBody {
  error?: string;
}

/**
 * Calls POST /api/config/filename-preview to render a videoFilenamePrefix
 * against a canned sample video via yt-dlp. The request is fired by an
 * explicit user action (Preview button), so this hook does not debounce.
 *
 * 400 responses carry yt-dlp's own grammar-error message in `error.response.data.error`;
 * we surface it verbatim so the user sees yt-dlp's diagnostic.
 */
export function useFilenamePreview(token: string | null): UseFilenamePreviewResult {
  const [data, setData] = useState<FilenamePreviewData | null>(null);
  const [previewedPrefix, setPreviewedPrefix] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (prefix: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<FilenamePreviewData>(
        '/api/config/filename-preview',
        { prefix },
        { headers: { 'x-access-token': token || '' } }
      );
      setData(response.data);
      setPreviewedPrefix(prefix);
      return response.data;
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<ApiErrorBody>;
      const apiMessage = axiosErr.response?.data?.error;
      setError(apiMessage || 'Preview failed. Please try again.');
      // Keep prior data; the stale indicator in the UI relies on previewedPrefix
      // matching the most recent successful render, not the most recent attempt.
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const isStale = useCallback(
    (currentPrefix: string) =>
      data !== null && previewedPrefix !== null && currentPrefix !== previewedPrefix,
    [data, previewedPrefix]
  );

  return { data, previewedPrefix, loading, error, run, isStale };
}
