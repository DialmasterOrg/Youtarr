import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Slide, Typography } from '../ui';
import { Download as DownloadIcon } from '../../lib/icons';

const DISMISSED_VERSION_STORAGE_KEY = 'dismissedUpdateVersion';

interface UpdateAvailableBannerProps {
  show: boolean;
  serverVersion?: string;
}

const readDismissedVersion = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DISMISSED_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const UpdateAvailableBanner: React.FC<UpdateAvailableBannerProps> = ({ show, serverVersion }) => {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(readDismissedVersion);

  useEffect(() => {
    setDismissedVersion(readDismissedVersion());
  }, [serverVersion]);

  const handleDismiss = useCallback(() => {
    if (!serverVersion) return;
    try {
      window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, serverVersion);
    } catch {
      // Storage may be unavailable (private mode, quota); still hide for this session.
    }
    setDismissedVersion(serverVersion);
  }, [serverVersion]);

  const isDismissedForThisVersion = Boolean(serverVersion && dismissedVersion === serverVersion);
  const visible = show && !isDismissedForThisVersion;

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 z-[1300] flex justify-center px-3 pb-3 pointer-events-none"
        style={{
          bottom: 'calc(var(--mobile-nav-total-offset, 0px) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Alert
          severity="info"
          icon={<DownloadIcon className="h-4 w-4" />}
          variant="outlined"
          onClose={handleDismiss}
          className="w-full max-w-[560px] items-center gap-2 px-3.5 py-1.5 pointer-events-auto rounded-ui shadow-soft bg-card border-info"
        >
          <Typography variant="body2" className="text-center leading-tight">
            {serverVersion ? (
              <>
                <strong>Youtarr {serverVersion}</strong> is available. Pull the latest image to update.
              </>
            ) : (
              <>A new Youtarr version is available. Pull the latest image to update.</>
            )}
          </Typography>
        </Alert>
      </div>
    </Slide>
  );
};

export { DISMISSED_VERSION_STORAGE_KEY };
export default UpdateAvailableBanner;
