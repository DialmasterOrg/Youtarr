import { useState, useEffect, useCallback } from 'react';

export interface AppConfig {
  channelAutoDownload: boolean;
  channelDownloadFrequency: string;
  channelFilesToDownload: number;
  preferredResolution: string;
  videoCodec: string;
  initialSetup: boolean;
  plexApiKey: string;
  youtubeOutputDirectory: string;
  plexYoutubeLibraryId: string;
  plexIP: string;
  plexPort: string;
  uuid: string;
  sponsorblockEnabled: boolean;
  sponsorblockAction: 'remove' | 'mark';
  sponsorblockCategories: {
    sponsor: boolean;
    intro: boolean;
    outro: boolean;
    selfpromo: boolean;
    preview: boolean;
    filler: boolean;
    interaction: boolean;
    music_offtopic: boolean;
  };
  sponsorblockApiUrl: string;
  downloadSocketTimeoutSeconds: number;
  downloadThrottledRate: string;
  downloadRetryCount: number;
  enableStallDetection: boolean;
  stallDetectionWindowSeconds: number;
  stallDetectionRateThreshold: string;
  cookiesEnabled: boolean;
  customCookiesUploaded: boolean;
  writeChannelPosters: boolean;
  writeVideoNfoFiles: boolean;
  notificationsEnabled: boolean;
  notificationService: string;
  discordWebhookUrl: string;
  autoRemovalEnabled: boolean;
  autoRemovalFreeSpaceThreshold: string;
  autoRemovalVideoAgeThreshold: string;
}

interface UseConfigResult {
  config: Partial<AppConfig>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useConfig(token: string | null): UseConfigResult {
  const [config, setConfig] = useState<Partial<AppConfig>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/getconfig', {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch config:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
  };
}
