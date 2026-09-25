import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertTitle, Typography } from '../ui';
import { DownloadPauseStatus } from '../../types/downloadPause';

export const STORAGE_LIMITS_SETTINGS_PATH = '/settings/storage-limits';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface DownloadPauseAlertProps {
  status: DownloadPauseStatus;
  onDismiss?: () => void;
  /** Omit the settings link when already rendered on the settings page. */
  hideSettingsLink?: boolean;
  className?: string;
}

/**
 * Explains that downloads are paused by a storage limit, why, and what
 * happens next. Renders nothing while downloads are running.
 */
export const DownloadPauseAlert: React.FC<DownloadPauseAlertProps> = ({ status, onDismiss, hideSettingsLink = false, className }) => {
  if (!status.paused) {
    return null;
  }

  return (
    <Alert severity="error" onClose={onDismiss} className={className} data-testid="download-pause-alert">
      <AlertTitle>Downloads are paused</AlertTitle>
      {status.reasons.map((reason) => (
        <Typography key={reason.type} variant="body2">
          {capitalize(reason.text)}.
        </Typography>
      ))}
      <Typography variant="body2" className="mt-1">
        New downloads are refused and queued downloads wait until storage is back within your limits,
        then start automatically.
        {!hideSettingsLink && (
          <>
            {' '}
            <Link className="underline font-medium" to={STORAGE_LIMITS_SETTINGS_PATH}>
              Storage limit settings
            </Link>
          </>
        )}
      </Typography>
    </Alert>
  );
};

export default DownloadPauseAlert;
