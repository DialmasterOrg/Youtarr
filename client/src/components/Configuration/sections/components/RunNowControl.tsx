import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography,
} from '../../../ui';
import { ScheduleField } from '../../schedules';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { describeRunNowBlock } from './runNowHint';

interface RunNowControlProps {
  field: ScheduleField;
  status: ScheduleTaskStatus | undefined;
  featureOnInForm: boolean;
  pending: boolean;
  error?: string;
  timeZone?: string | null;
  onRun: () => void;
}

export function RunNowControl({ field, status, featureOnInForm, pending, error, timeZone, onRun }: RunNowControlProps) {
  const [confirming, setConfirming] = useState(false);
  if (!status) return null;

  const hint = describeRunNowBlock({
    availability: status.runNow, settingsLabel: field.settingsLabel, featureOnInForm, timeZone,
  });
  const running = status.running || status.runNow.reason === 'running';
  const disabled = pending || running || !status.runNow.available;
  const label = running ? 'Running...' : pending ? 'Starting...' : 'Run now';
  const ariaLabel = running
    ? `${field.label} is running`
    : pending
      ? `Starting ${field.label}`
      : `Run ${field.label} now`;
  const confirm = field.runNowConfirm;
  const titleId = `${field.key}-run-now-title`;

  const handleClick = () => {
    if (confirm) setConfirming(true);
    else onRun();
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="outlined" size="small" disabled={disabled} onClick={handleClick} aria-label={ariaLabel}>
        {label}
      </Button>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint.text}
          {hint.link && (
            <>
              {' '}
              <Link to={hint.link.to} className="underline font-medium">{hint.link.label}</Link>
            </>
          )}
        </Typography>
      )}
      {error && <Typography variant="body2" role="alert" className="text-destructive">{error}</Typography>}
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
    </div>
  );
}
