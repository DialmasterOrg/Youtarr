import React from 'react';
import { CircularProgress, Typography } from '../../ui';
import { formatDateTime } from '../../../utils/formatters';
import { formatRunDuration } from '../../Configuration/sections/components/scheduleDisplay';
import type { RescanLastRun, RescanProgress } from '../../../hooks/useRescanStatus';

interface RescanStatusLineProps {
  running: boolean;
  progress: RescanProgress | null;
  lastRun: RescanLastRun | null;
}

const formatCount = (n: number) => n.toLocaleString('en-US');

function runDuration(run: RescanLastRun): string | null {
  const ms = Date.parse(run.completedAt) - Date.parse(run.startedAt);
  return Number.isFinite(ms) ? formatRunDuration(Math.max(0, ms)) : null;
}

function describeProgress(progress: RescanProgress): string {
  if (progress.phase === 'walk') {
    return `Scanning the downloads folder: ${formatCount(progress.foldersScanned)} folders and `
      + `${formatCount(progress.filesFound)} video files so far.`;
  }
  return `Checking videos against the files found: ${formatCount(progress.videosProcessed)} of ${formatCount(progress.videosTotal)}.`;
}

// What the last run found and changed. A run that stopped before checking
// anything (the downloads folder looked unmounted) has no counts worth showing.
function describeCounts(run: RescanLastRun): string | null {
  if (run.status === 'error' && run.videosScanned === 0) return null;
  const missing = run.videosMissing ?? 0;
  const missingNote = missing > 0 ? ` ${formatCount(missing)} ${missing === 1 ? 'video is' : 'videos are'} missing.` : '';
  return `Found ${formatCount(run.filesFoundOnDisk)} video files on disk for ${formatCount(run.videosScanned)} videos: `
    + `updated ${formatCount(run.videosUpdated)}, marked ${formatCount(run.videosMarkedMissing)} missing.${missingNote}`;
}

// The Maintenance page's one-line rescan status: live progress while a rescan
// runs, otherwise what the last one found, how long it took, and when.
const RescanStatusLine: React.FC<RescanStatusLineProps> = ({ running, progress, lastRun }) => {
  const lastDuration = lastRun ? runDuration(lastRun) : null;

  if (running) {
    return (
      <div className="flex items-start gap-2">
        <CircularProgress size={16} className="mt-0.5 shrink-0" />
        <Typography variant="body2" color="text.secondary">
          Rescan in progress.
          {progress && ` ${describeProgress(progress)}`}
          {lastDuration && ` The last rescan took ${lastDuration}.`}
        </Typography>
      </div>
    );
  }

  if (!lastRun) {
    return (
      <Typography variant="body2" color="text.secondary">
        No rescan has run yet.
      </Typography>
    );
  }

  const counts = describeCounts(lastRun);
  return (
    <Typography variant="body2" color="text.secondary">
      Last rescan: {formatDateTime(lastRun.completedAt)} ({lastRun.trigger}){lastDuration && `, took ${lastDuration}`}.
      {counts && ` ${counts}`}
      {lastRun.status === 'timed-out' && ' It stopped at the time limit, so the next run starts over.'}
      {lastRun.libraryCheckSkipped && ' The downloads folder check was skipped.'}
    </Typography>
  );
};

export default RescanStatusLine;
