import React from 'react';
import { Typography } from '../../../ui';
import { formatDateTimeInZone } from '../../../../utils/formatters';
import { ScheduleRun, ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { describeDurationPhrase, finishedRunOf } from './scheduleDisplay';

const STATUS_LABELS: Record<ScheduleRun['status'], string> = {
  running: 'in progress',
  success: 'completed',
  error: 'failed',
  skipped: 'skipped',
  interrupted: 'interrupted',
};

function describeRun(run: ScheduleRun, timeZone: string | null | undefined): string {
  const duration = describeDurationPhrase(run);
  const status = duration ? `${STATUS_LABELS[run.status]} ${duration}` : STATUS_LABELS[run.status];
  const trigger = run.trigger === 'scheduled' ? '' : ` (${run.trigger})`;
  return `${formatDateTimeInZone(run.startedAt, timeZone)}, ${status}${trigger}`;
}

function describeLastRun(run: ScheduleRun | null, timeZone: string | null | undefined): string {
  if (!run) return 'Last run: never';
  const message = run.message ? `: ${run.message}` : '';
  return `Last run: ${describeRun(run, timeZone)}${message}`;
}

interface ScheduleRunStatusProps {
  status: ScheduleTaskStatus | undefined;
  timeZone?: string | null;
}

// The live state of one schedule: whether it is armed, when it fires next, and
// how its last run ended and how long it took, with times in the server's
// zone. When the last run did not finish (skipped, interrupted, still going),
// the newest run that did is shown for its length. Renders nothing until the
// status has loaded.
export function ScheduleRunStatus({ status, timeZone }: ScheduleRunStatusProps) {
  if (!status) return null;
  const finished = finishedRunOf(status);
  const previous = finished && finished.id !== status.lastRun?.id ? finished : null;

  return (
    <div className="space-y-1 text-sm">
      {status.error && !status.active && (
        <Typography variant="body2" role="alert" className="text-destructive">
          Not scheduled: {status.error}
        </Typography>
      )}
      {status.error && status.active && (
        <Typography variant="body2" role="alert" className="text-warning">
          The saved schedule was not applied: {status.error} The previous schedule {status.expression} is still active.
        </Typography>
      )}
      {status.running ? (
        <Typography variant="body2">Running now</Typography>
      ) : status.active && status.nextRunAt ? (
        <Typography variant="body2">Next run: {formatDateTimeInZone(status.nextRunAt, timeZone)}</Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">{describeLastRun(status.lastRun, timeZone)}</Typography>
      {previous && (
        <Typography variant="body2" color="text.secondary">
          Previous run: {describeRun(previous, timeZone)}
        </Typography>
      )}
    </div>
  );
}
