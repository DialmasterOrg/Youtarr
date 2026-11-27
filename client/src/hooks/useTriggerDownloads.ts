import { useVideoActivity } from '../providers/VideoActivityProvider';
import { useState, useCallback, useRef } from 'react';
import { DownloadOverrideSettings } from '../types/downloadOverrideSettings';

interface TriggerDownloadsParams {
  urls: string[];
  overrideSettings?: DownloadOverrideSettings;
  channelId?: string | null;
  videoChannelMap?: Record<string, string>;
}

interface UseTriggerDownloadsResult {
  // null means a concurrent submission was ignored; callers should leave their UI alone.
  triggerDownloads: (params: TriggerDownloadsParams) => Promise<boolean | null>;
  loading: boolean;
  error: Error | null;
}

export function useTriggerDownloads(token: string | null): UseTriggerDownloadsResult {
  const { refresh } = useVideoActivity();
  const submitting = useRef(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const triggerDownloads = useCallback(
    async ({ urls, overrideSettings, channelId, videoChannelMap }: TriggerDownloadsParams): Promise<boolean | null> => {
      if (!token) {
        setError(new Error('No authentication token provided'));
        return false;
      }

      if (submitting.current) return null;
      if (!urls.length) return false;
      submitting.current = true;
      setLoading(true);
      setError(null);

      try {
        const requestBody: any = { urls };

        if (overrideSettings) {
          requestBody.overrideSettings = overrideSettings;
        }

        if (channelId) {
          requestBody.channelId = channelId;
        }

        if (videoChannelMap && Object.keys(videoChannelMap).length > 0) {
          requestBody.videoChannelMap = videoChannelMap;
        }

        const response = await fetch('/triggerspecificdownloads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': token,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to trigger downloads: ${response.statusText}`);
        }

        refresh();
        return true;
      } catch (err) {
        console.error('Error triggering downloads:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        submitting.current = false;
        setLoading(false);
      }
    },
    [token, refresh]
  );

  return {
    triggerDownloads,
    loading,
    error,
  };
}
