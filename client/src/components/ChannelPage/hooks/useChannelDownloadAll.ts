import { useState, useCallback } from 'react';
import axios from 'axios';

export interface DownloadAllPreview {
  count: number;
  totalDurationSeconds: number;
  missingDurations: number;
}

export interface DownloadAllOverrideSettings {
  resolution?: string;
  allowRedownload?: boolean;
  subfolder?: string | null;
  audioFormat?: string | null;
  rating?: string | null;
  skipVideoFolder?: boolean;
}

interface StartDownloadAllResponse {
  status: string;
  queued: number;
}

interface UseChannelDownloadAllResult {
  preview: DownloadAllPreview | null;
  previewLoading: boolean;
  starting: boolean;
  error: string | null;
  fetchPreview: (tabType: string) => Promise<DownloadAllPreview | null>;
  startDownloadAll: (
    tabType: string,
    overrideSettings?: DownloadAllOverrideSettings
  ) => Promise<number | null>;
  resetPreview: () => void;
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

function authHeaders(token: string): Record<string, string> {
  return { 'x-access-token': token };
}

export function useChannelDownloadAll(
  channelId: string | undefined,
  token: string | null
): UseChannelDownloadAllResult {
  const [preview, setPreview] = useState<DownloadAllPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(
    async (tabType: string): Promise<DownloadAllPreview | null> => {
      if (!channelId || !token) return null;

      setPreviewLoading(true);
      setError(null);
      try {
        const res = await axios.get<DownloadAllPreview>(
          `/api/channels/${channelId}/download-all/preview`,
          { params: { tabType }, headers: authHeaders(token) }
        );
        setPreview(res.data);
        return res.data;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to load the download preview'));
        return null;
      } finally {
        setPreviewLoading(false);
      }
    },
    [channelId, token]
  );

  const startDownloadAll = useCallback(
    async (
      tabType: string,
      overrideSettings?: DownloadAllOverrideSettings
    ): Promise<number | null> => {
      if (!channelId || !token) return null;

      setStarting(true);
      setError(null);
      try {
        const res = await axios.post<StartDownloadAllResponse>(
          `/api/channels/${channelId}/download-all`,
          { tabType, overrideSettings },
          { headers: authHeaders(token) }
        );
        return res.data.queued;
      } catch (err: unknown) {
        setError(extractMessage(err, 'Failed to start the download'));
        return null;
      } finally {
        setStarting(false);
      }
    },
    [channelId, token]
  );

  const resetPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return {
    preview,
    previewLoading,
    starting,
    error,
    fetchPreview,
    startDownloadAll,
    resetPreview,
  };
}
