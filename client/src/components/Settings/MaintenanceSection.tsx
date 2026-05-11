import React from 'react';
import { Alert, Button, CircularProgress, Typography } from '../ui';
import { ConfigurationCard } from '../Configuration/common/ConfigurationCard';
import { useRescanStatus } from '../../hooks/useRescanStatus';
import { formatDateTime } from '../../utils/formatters';

interface MaintenanceSectionProps {
  token: string | null;
}

export function MaintenanceSection({ token }: MaintenanceSectionProps) {
  const { running, lastRun, loading, error, triggerRescan } = useRescanStatus(token);
  const persistentError = !running && lastRun?.status === 'error' ? lastRun.errorMessage : null;
  const transientError = error && error !== persistentError ? error : null;

  let statusLine: React.ReactNode;
  if (running) {
    statusLine = (
      <div className="flex items-center gap-2">
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Rescan in progress...
        </Typography>
      </div>
    );
  } else if (lastRun) {
    statusLine = (
      <Typography variant="body2" color="text.secondary">
        Last rescan: {formatDateTime(lastRun.completedAt)} ({lastRun.trigger}). Updated{' '}
        {lastRun.videosUpdated} videos, marked {lastRun.videosMarkedMissing} missing.
        {lastRun.status === 'timed-out' && ' (timed out; click to continue)'}
      </Typography>
    );
  } else {
    statusLine = (
      <Typography variant="body2" color="text.secondary">
        No rescan has run yet.
      </Typography>
    );
  }

  return (
    <ConfigurationCard title="Rescan files on disk">
      <div className="flex flex-col gap-4">
        <Typography variant="body2" color="text.secondary">
          Use this if you have moved or converted downloaded files outside of Youtarr - for
          example, converting mp4 to mkv. The rescan walks your Youtarr downloads folder
          and updates Youtarr&apos;s view of which files exist and where.
        </Typography>

        <div>
          <Button
            variant="contained"
            disabled={running || loading}
            onClick={() => {
              void triggerRescan();
            }}
          >
            Rescan files on disk
          </Button>
        </div>

        {statusLine}

        {transientError && (
          <Alert severity="warning">{transientError}</Alert>
        )}

        {persistentError && (
          <Alert severity="warning">{persistentError}</Alert>
        )}
      </div>
    </ConfigurationCard>
  );
}

export default MaintenanceSection;
