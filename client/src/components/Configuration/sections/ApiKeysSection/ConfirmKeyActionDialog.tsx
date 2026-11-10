import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '../../../ui';

interface ConfirmKeyActionDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  busyLabel?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}

export default function ConfirmKeyActionDialog({
  open,
  title,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
  children,
}: ConfirmKeyActionDialogProps) {
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>
          {busy && busyLabel ? busyLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
