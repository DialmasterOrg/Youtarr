import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '../ui';
import { Stop as StopIcon, Warning as WarningIcon } from '../../lib/icons';

interface TerminateJobDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const TerminateJobDialog: React.FC<TerminateJobDialogProps> = ({
  open,
  onClose,
  onConfirm
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WarningIcon size={20} color="var(--warning)" />
        Confirm Download Termination
      </DialogTitle>

      <DialogContent>
        <div style={{ paddingTop: 8 }}>
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            <Typography variant="body2">
              You are about to terminate the currently running download job.
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>
            This action will:
          </Typography>
          <ul style={{ marginLeft: 16, marginBottom: 16 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Stop the current download, terminating the download currently in progress.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Save all videos that have already been downloaded
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Clean up the partial video download in progress
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              NOT affect any queued jobs (they will continue after this one)
            </Typography>
          </ul>

          <Alert severity="info" style={{ marginBottom: 8 }}>
            <Typography variant="body2">
              The job will show as &quot;Terminated&quot; in your download history with a list of completed videos.
            </Typography>
          </Alert>
        </div>
      </DialogContent>

      <DialogActions style={{ padding: '0 24px 16px' }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          autoFocus
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="outlined"
          color="warning"
          startIcon={<StopIcon />}
        >
          Terminate Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TerminateJobDialog;
