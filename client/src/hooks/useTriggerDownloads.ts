import { useVideoActivity } from '../providers/VideoActivityProvider';
import { useState, useCallback, useRef } from 'react';
import { DownloadOverrideSettings } from '../types/downloadOverrideSettings';

interface TriggerDownloadsParams {
  urls: string[];
  overrideSettings?: DownloadOverrideSettings;
  channelId?: string | null;
  videoChannelMap?: Record<string, string>;
}

// A failure carries the text to show: the server's reason, or the fallback.
export type TriggerDownloadsResult = { ok: true } | { ok: false; message: string };

interface UseTriggerDownloadsResult {
  // null means a concurrent submission was ignored; callers should leave their UI alone.
  triggerDownloads: (params: TriggerDownloadsParams) => Promise<TriggerDownloadsResult | null>;
  loading: boolean;
  error: Error | null;
}

const QUEUE_FAILED_MESSAGE = 'Failed to queue downloads. Please try again.';

// allowOverlap is for a caller that guards its own double submit and must not
// have a second submission dropped.
export function useTriggerDownloads(
  token: string | null,
  { allowOverlap = false }: { allowOverlap?: boolean } = {}
): UseTriggerDownloadsResult {
  const { refresh } = useVideoActivity();
  const submitting = useRef(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const triggerDownloads = useCallback(
    async ({ urls, overrideSettings, channelId, videoChannelMap }: TriggerDownloadsParams): Promise<TriggerDownloadsResult | null> => {
      const failed: TriggerDownloadsResult = { ok: false, message: QUEUE_FAILED_MESSAGE };
      if (!token) {
        setError(new Error('No authentication token provided'));
        return failed;
      }

      if (submitting.current && !allowOverlap) return null;
      if (!urls.length) return failed;
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
          const data: { error?: unknown } = await response.json().catch(() => ({}));
          const message = typeof data?.error === 'string' && data.error ? data.error : QUEUE_FAILED_MESSAGE;
          setError(new Error(message));
          return { ok: false, message };
        }

        refresh();
        return { ok: true };
      } catch (err) {
        console.error('Error triggering downloads:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return failed;
      } finally {
        submitting.current = false;
        setLoading(false);
      }
    },
    [token, refresh, allowOverlap]
  );

  return {
    triggerDownloads,
    loading,
    error,
  };
}
