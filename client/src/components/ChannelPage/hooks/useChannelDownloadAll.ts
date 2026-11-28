import { useState, useCallback } from 'react';
import axios from 'axios';
import { DownloadOverrideSettings } from '../../../types/downloadOverrideSettings';
import { serverErrorMessage } from '../../../utils/requestError';

export interface DownloadAllPreview {
  count: number;
  totalDurationSeconds: number;
  missingDurations: number;
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
    overrideSettings?: DownloadOverrideSettings
  ) => Promise<number | null>;
  resetPreview: () => void;
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
        setError(serverErrorMessage(err, 'Failed to load the download preview'));
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
      overrideSettings?: DownloadOverrideSettings
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
        setError(serverErrorMessage(err, 'Failed to start the download'));
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
