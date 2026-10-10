import React, { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '../../../ui';
import { Loader2, Play } from '../../../../lib/icons';
import { ScheduleField } from '../../schedules';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { isTaskRunning } from './scheduleDisplay';

interface RunNowControlProps {
  field: ScheduleField;
  status: ScheduleTaskStatus | undefined;
  pending: boolean;
  onRun: () => void;
}

// The Run now button for one task, with the confirmation some tasks need.
// Icon-only on phones; why it is disabled is shown by the caller.
export function RunNowControl({ field, status, pending, onRun }: RunNowControlProps) {
  const [confirming, setConfirming] = useState(false);
  if (!status) return null;

  const running = isTaskRunning(status);
  const disabled = pending || running || !status.runNow.available;
  const label = running ? 'Running...' : pending ? 'Starting...' : 'Run now';
  const ariaLabel = running
    ? `${field.label} is running`
    : pending
      ? `Starting ${field.label}`
      : `Run ${field.label} now`;
  const confirm = field.runNowConfirm;
  const titleId = `${field.key}-run-now-title`;
  const Icon = running || pending ? Loader2 : Play;

  const handleClick = () => {
    if (confirm) setConfirming(true);
    else onRun();
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        disabled={disabled}
        onClick={handleClick}
        aria-label={ariaLabel}
        className="w-9 px-0 sm:w-28 sm:px-3"
      >
        <Icon className={`h-4 w-4 sm:hidden ${running || pending ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {confirm && (
        <Dialog open={confirming} onClose={() => setConfirming(false)} aria-labelledby={titleId}>
          <DialogTitle id={titleId}>{confirm.title}</DialogTitle>
          <DialogContent>
            <DialogContentText>{confirm.body}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirming(false);
                onRun();
              }}
            >
              {confirm.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
