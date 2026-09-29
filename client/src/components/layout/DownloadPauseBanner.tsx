import React, { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DownloadPauseAlert, STORAGE_LIMITS_SETTINGS_PATH } from '../shared/DownloadPauseAlert';
import { useDownloadPauseStatus } from '../../hooks/useDownloadPauseStatus';

export const DISMISSED_PAUSE_STORAGE_KEY = 'dismissedDownloadPause';
// Where people look when downloads seem stuck, so the notice always shows there.
const DOWNLOADS_PATH_PREFIX = '/downloads';

const readDismissedPause = (): string | null => {
  try {
    return window.localStorage.getItem(DISMISSED_PAUSE_STORAGE_KEY);
  } catch {
    return null;
  }
};

interface DownloadPauseBannerProps {
  token: string | null;
}

/**
 * App-wide notice shown on every page while storage limits pause downloads.
 * Dismissing hides it for the current pause only; a new pause (different
 * pausedSince) shows it again. It cannot be dismissed on the download pages.
 */
export const DownloadPauseBanner: React.FC<DownloadPauseBannerProps> = ({ token }) => {
  const { data } = useDownloadPauseStatus(token);
  const { pathname } = useLocation();
  const onDownloadsPage = pathname.startsWith(DOWNLOADS_PATH_PREFIX);
  const [dismissedPause, setDismissedPause] = useState<string | null>(readDismissedPause);

  const pausedSince = data?.pausedSince ?? null;
  const handleDismiss = useCallback(() => {
    if (!pausedSince) return;
    try {
      window.localStorage.setItem(DISMISSED_PAUSE_STORAGE_KEY, pausedSince);
    } catch {
      // Storage may be unavailable (private mode, quota); still hide for this session.
    }
    setDismissedPause(pausedSince);
  }, [pausedSince]);

  // The Storage Limits page shows the same alert inside its own section.
  if (!data || !data.paused || pathname.startsWith(STORAGE_LIMITS_SETTINGS_PATH)) {
    return null;
  }
  if (onDownloadsPage) {
    return <DownloadPauseAlert status={data} className="mb-4" />;
  }
  if (pausedSince && dismissedPause === pausedSince) {
    return null;
  }

  return <DownloadPauseAlert status={data} onDismiss={handleDismiss} className="mb-4" />;
};

export default DownloadPauseBanner;
