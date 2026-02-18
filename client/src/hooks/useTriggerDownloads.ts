import { useState, useCallback } from 'react';

interface DownloadOverrideSettings {
  resolution: string;
  allowRedownload?: boolean;
  subfolder?: string | null;
  audioFormat?: string | null;
  rating?: string | null;
}

interface TriggerDownloadsParams {
  urls: string[];
  overrideSettings?: DownloadOverrideSettings;
  channelId?: string | null;
}

interface UseTriggerDownloadsResult {
  triggerDownloads: (params: TriggerDownloadsParams) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

export function useTriggerDownloads(token: string | null): UseTriggerDownloadsResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const triggerDownloads = useCallback(
    async ({ urls, overrideSettings, channelId }: TriggerDownloadsParams): Promise<boolean> => {
      if (!token) {
        setError(new Error('No authentication token provided'));
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const requestBody: any = { urls };

        if (overrideSettings) {
          requestBody.overrideSettings = {
            resolution: overrideSettings.resolution,
            allowRedownload: overrideSettings.allowRedownload,
            subfolder: overrideSettings.subfolder,
            audioFormat: overrideSettings.audioFormat,
            rating: overrideSettings.rating
          };
        }

        if (channelId) {
          requestBody.channelId = channelId;
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

        return true;
      } catch (err) {
        console.error('Error triggering downloads:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return {
    triggerDownloads,
    loading,
    error,
  };
}
