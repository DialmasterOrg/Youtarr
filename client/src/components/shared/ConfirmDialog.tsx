import React, { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '../ui';

// What confirming does, which decides the buttons. 'danger' removes or
// invalidates something for good and 'warning' changes something that can be
// put back: for both, Cancel is the filled, focused button and the action is
// outlined. 'default' is a harmless confirm: plain Cancel, filled action.
export type ConfirmTone = 'default' | 'warning' | 'danger';

const ACTION_COLOR = { default: 'primary', warning: 'warning', danger: 'error' } as const;

interface ConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel?: string;
  tone?: ConfirmTone;
  // The action is running: both buttons lock and the dialog stays open.
  busy?: boolean;
  busyLabel?: string;
  confirmDisabled?: boolean;
  confirmIcon?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  busyLabel,
  confirmDisabled = false,
  confirmIcon,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const bodyId = useId();
  const cautious = tone !== 'default';

  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} fullWidth aria-describedby={bodyId}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent id={bodyId}>{children}</DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          disabled={busy}
          variant={cautious ? 'contained' : undefined}
          autoFocus={cautious}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant={cautious ? 'outlined' : 'contained'}
          color={ACTION_COLOR[tone]}
          disabled={confirmDisabled || busy}
          startIcon={confirmIcon}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
