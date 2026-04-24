import { useCallback, useState } from 'react';
import axios from 'axios';
import {
  ConfigState,
  SnackbarState,
  YouTubeApiKeyStatus,
  YouTubeApiKeyTestResult,
} from '../types';

interface UseYouTubeApiKeyParams {
  token: string | null;
  apiKey: string;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

const CODE_TO_STATUS: Record<string, YouTubeApiKeyStatus> = {
  KEY_INVALID: 'invalid',
  KEY_RESTRICTED: 'key_restricted',
  API_NOT_ENABLED: 'api_not_enabled',
  QUOTA_EXCEEDED: 'quota_exhausted',
  RATE_LIMITED: 'rate_limited',
  NETWORK_ERROR: 'network_error',
  SERVER_ERROR: 'network_error',
  UNKNOWN: 'invalid',
};

export function useYouTubeApiKey({
  token,
  apiKey,
  setInitialConfig,
  setSnackbar,
}: UseYouTubeApiKeyParams) {
  const [status, setStatus] = useState<YouTubeApiKeyStatus>('not_tested');
  const [lastValidatedAt, setLastValidatedAt] = useState<Date | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);

  const testKey = useCallback(async () => {
    if (!apiKey) {
      setSnackbar({
        open: true,
        message: 'Enter a YouTube API key before testing.',
        severity: 'warning',
      });
      return;
    }

    setStatus('testing');
    try {
      const response = await axios.post<YouTubeApiKeyTestResult>(
        '/testYoutubeApiKey',
        { apiKey },
        { headers: { 'x-access-token': token || '' } }
      );
      const data = response.data;

      if (data.ok) {
        setStatus('valid');
        setLastValidatedAt(new Date());
        setLastReason(null);
        setInitialConfig((prev) => (prev ? { ...prev, youtubeApiKey: apiKey } : prev));
        setSnackbar({
          open: true,
          message: 'YouTube API key is valid. Saved automatically.',
          severity: 'success',
        });
      } else {
        const nextStatus = (data.code && CODE_TO_STATUS[data.code]) || 'invalid';
        setStatus(nextStatus);
        setLastReason(data.reason || null);
        setSnackbar({
          open: true,
          message: data.reason || 'Could not validate the YouTube API key.',
          severity: 'error',
        });
      }
    } catch {
      setStatus('network_error');
      setSnackbar({
        open: true,
        message: 'Network error while validating the key. Check your server logs.',
        severity: 'error',
      });
    }
  }, [apiKey, token, setInitialConfig, setSnackbar]);

  const clear = useCallback(() => {
    setStatus('not_tested');
    setLastValidatedAt(null);
    setLastReason(null);
  }, []);

  return { status, lastValidatedAt, lastReason, testKey, clear };
}
