import { ScheduleSummary } from '../Configuration/sections/components/ScheduleSummary';
import { ConfigState } from '../Configuration/types';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Button, CircularProgress, Typography } from '../ui';
import { ConfigurationCard } from '../Configuration/common/ConfigurationCard';
import { useRescanStatus } from '../../hooks/useRescanStatus';
import { formatDateTime } from '../../utils/formatters';
import { REMOVED_VIDEOS_ANCHOR } from '../../utils/videoRemoval';
import RemovedVideosCard from './components/RemovedVideosCard';

interface MaintenanceSectionProps {
  token: string | null;
  config: ConfigState;
}

export function MaintenanceSection({ token, config }: MaintenanceSectionProps) {
  const { running, lastRun, loading, error, triggerRescan } = useRescanStatus(token);
  const persistentError = !running && lastRun?.status === 'error' ? lastRun.errorMessage : null;
  const transientError = error && error !== persistentError ? error : null;
  const { hash } = useLocation();

  // Links from the Videos page land on the deleted and missing videos card.
  useEffect(() => {
    if (hash !== `#${REMOVED_VIDEOS_ANCHOR}`) return;
    document.getElementById(REMOVED_VIDEOS_ANCHOR)?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

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
        {lastRun.libraryCheckSkipped && ' The downloads folder check was skipped.'}
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
    <div className="flex flex-col gap-6">
    <ConfigurationCard title="Rescan files on disk">
      <div className="flex flex-col gap-4">
        <Typography variant="body2" color="text.secondary">
          Use this if you have moved or converted downloaded files outside of Youtarr - for
          example, converting mp4 to mkv. The rescan walks your Youtarr downloads folder
          and updates Youtarr&apos;s view of which files exist and where.
        </Typography>

        <ScheduleSummary scheduleKey="videoRescanFrequency" value={config.videoRescanFrequency} />

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

    <section id={REMOVED_VIDEOS_ANCHOR} aria-label="Deleted and missing videos" className="scroll-mt-24">
      <RemovedVideosCard
        token={token}
        onRescanAnyway={() => triggerRescan({ ignoreLibraryCheck: true })}
        rescanRunning={running}
      />
    </section>
    </div>
  );
}

export default MaintenanceSection;
