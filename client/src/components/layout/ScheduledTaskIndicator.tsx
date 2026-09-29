import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip } from '../ui';
import { AccessTime } from '../../lib/icons';
import { useRunningScheduledTasks } from '../../hooks/useRunningScheduledTasks';

const ICON_SIZE = 20;

interface ScheduledTaskIndicatorProps {
  token: string | null;
}

// Shown in the header while a scheduled task (other than automatic downloads,
// which have the download indicator) is running; links to Scheduling.
export function ScheduledTaskIndicator({ token }: ScheduledTaskIndicatorProps) {
  const { running } = useRunningScheduledTasks(token);
  const navigate = useNavigate();

  if (running.length === 0) {
    return null;
  }

  const prefix = running.length === 1 ? 'Scheduled task running' : 'Scheduled tasks running';
  const label = `${prefix}: ${running.map((task) => task.label).join(', ')}`;

  return (
    <Tooltip title={label} placement="bottom" arrow>
      <IconButton aria-label={label} color="primary" className="mr-1" onClick={() => navigate('/settings/scheduling')}>
        <span className="relative inline-flex items-center justify-center">
          <AccessTime size={ICON_SIZE} aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5" aria-hidden="true">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping-slow motion-reduce:animate-none"
              data-testid="scheduled-task-pulse"
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        </span>
      </IconButton>
    </Tooltip>
  );
}
