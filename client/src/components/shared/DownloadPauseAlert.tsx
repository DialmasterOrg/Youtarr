import React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertTitle, Typography } from '../ui';
import { DownloadPauseStatus } from '../../types/downloadPause';

export const STORAGE_LIMITS_SETTINGS_PATH = '/settings/storage-limits';
const MAINTENANCE_SETTINGS_PATH = '/settings/maintenance';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// What has to change before held downloads start, by which kinds of reason hold them.
function describeWait(library: boolean, storage: boolean): string {
  if (library && storage) return 'the downloads folder is available again and storage is back within your limits';
  if (library) return 'the downloads folder is available again';
  return 'storage is back within your limits';
}

interface DownloadPauseAlertProps {
  status: DownloadPauseStatus;
  onDismiss?: () => void;
  /** Omit the settings link when already rendered on the settings page. */
  hideSettingsLink?: boolean;
  className?: string;
}

/**
 * Explains that downloads are paused (by a storage limit, or because the
 * downloads folder looks unavailable), why, and what happens next. Renders
 * nothing while downloads are running.
 */
export const DownloadPauseAlert: React.FC<DownloadPauseAlertProps> = ({ status, onDismiss, hideSettingsLink = false, className }) => {
  if (!status.paused) {
    return null;
  }

  const library = status.reasons.some((reason) => reason.type === 'library');
  const storage = status.reasons.some((reason) => reason.type !== 'library');

  return (
    <Alert severity="error" onClose={onDismiss} className={className} data-testid="download-pause-alert">
      <AlertTitle>Downloads are paused</AlertTitle>
      {status.reasons.map((reason) => (
        <Typography key={reason.type} variant="body2">
          {capitalize(reason.text)}.
        </Typography>
      ))}
      <Typography variant="body2" className="mt-1">
        New downloads are refused and queued downloads wait until {describeWait(library, storage || !library)},
        then start automatically. A download job that was already running is allowed to finish.
        {library && (
          <>
            {' '}Check that the drive or network share is mounted and that the volume mapping in your Docker
            setup points at your library.{' '}
            <Link className="underline font-medium" to={MAINTENANCE_SETTINGS_PATH}>
              Maintenance
            </Link>
          </>
        )}
        {storage && !hideSettingsLink && (
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
