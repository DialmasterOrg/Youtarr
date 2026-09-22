import React from 'react';
import { Typography } from '../../../ui';
import { formatDateTimeInZone } from '../../../../utils/formatters';
import { ScheduleRun, ScheduleTaskStatus } from '../../hooks/useScheduleStatus';

const STATUS_LABELS: Record<ScheduleRun['status'], string> = {
  running: 'in progress',
  success: 'completed',
  error: 'failed',
  skipped: 'skipped',
  interrupted: 'interrupted',
};

function describeLastRun(run: ScheduleRun | null, timeZone: string | null | undefined): string {
  if (!run) return 'Last run: never';
  const trigger = run.trigger === 'scheduled' ? '' : ` (${run.trigger})`;
  const message = run.message ? `: ${run.message}` : '';
  return `Last run: ${formatDateTimeInZone(run.startedAt, timeZone)}, ${STATUS_LABELS[run.status]}${trigger}${message}`;
}

interface ScheduleRunStatusProps {
  status: ScheduleTaskStatus | undefined;
  timeZone?: string | null;
}

// The live state of one schedule: whether it is armed, when it fires next, and
// how its last run ended, with times in the server's zone. Renders nothing
// until the status has loaded.
export function ScheduleRunStatus({ status, timeZone }: ScheduleRunStatusProps) {
  if (!status) return null;

  return (
    <div className="space-y-1 mb-4 text-sm">
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
    </div>
  );
}
