import { useState, useEffect, useCallback, useRef } from 'react';

// Event name for notifying other components when yt-dlp is updated
export const YTDLP_UPDATED_EVENT = 'ytdlp-updated';

export interface YtDlpVersionInfo {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export type YtDlpUpdateStatus = 'idle' | 'checking' | 'updating' | 'success' | 'error';

interface UseYtDlpUpdateResult {
  versionInfo: YtDlpVersionInfo;
  updateStatus: YtDlpUpdateStatus;
  checkingVersion: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  checkLatestVersion: () => Promise<void>;
  performUpdate: () => Promise<void>;
  clearMessages: () => void;
}

export function useYtDlpUpdate(token: string | null): UseYtDlpUpdateResult {
  const [versionInfo, setVersionInfo] = useState<YtDlpVersionInfo>({
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
  });
  const [updateStatus, setUpdateStatus] = useState<YtDlpUpdateStatus>('idle');
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const checkLatestVersion = useCallback(async () => {
    if (!token) {
      return;
    }

    setCheckingVersion(true);
    setUpdateStatus('checking');
    clearMessages();

    try {
      const response = await fetch('/api/ytdlp/latest-version', {
        headers: {
          'x-access-token': token,
        },
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to fetch version information');
      }

      const data = await response.json();

      if (!mountedRef.current) return;

      setVersionInfo({
        currentVersion: data.currentVersion,
        latestVersion: data.latestVersion,
        updateAvailable: data.updateAvailable,
      });
      setUpdateStatus('idle');
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Failed to check version');
      setUpdateStatus('error');
    } finally {
      if (mountedRef.current) {
        setCheckingVersion(false);
      }
    }
  }, [token, clearMessages]);

  const performUpdate = useCallback(async () => {
    if (!token) {
      return;
    }

    setUpdateStatus('updating');
    clearMessages();

    try {
      const response = await fetch('/api/ytdlp/update', {
        method: 'POST',
        headers: {
          'x-access-token': token,
        },
      });

      const data = await response.json();

      if (!mountedRef.current) return;

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Update failed');
      }

      setSuccessMessage(data.message);
      setUpdateStatus('success');

      window.dispatchEvent(new CustomEvent(YTDLP_UPDATED_EVENT));

      await checkLatestVersion();
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Update failed');
      setUpdateStatus('error');
    }
  }, [token, clearMessages, checkLatestVersion]);

  useEffect(() => {
    if (token) {
      checkLatestVersion();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    versionInfo,
    updateStatus,
    checkingVersion,
    errorMessage,
    successMessage,
    checkLatestVersion,
    performUpdate,
    clearMessages,
  };
}
