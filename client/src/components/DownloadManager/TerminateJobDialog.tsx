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
      <DialogTitle>
        <WarningIcon
          size={20}
          color="var(--warning)"
          className="shrink-0"
          data-testid="WarningIcon"
        />
        Confirm Download Termination
      </DialogTitle>

      <DialogContent>
        <div className="space-y-4">
          <Alert severity="warning">
            <Typography variant="body2">
              You are about to terminate the currently running download job.
            </Typography>
          </Alert>

          <div>
            <Typography variant="body2" color="text.secondary" className="mb-2">
              This action will:
            </Typography>
            <ul className="list-disc pl-5 space-y-1.5">
              <Typography component="li" variant="body2" color="text.secondary">
                Stop the entire running job, including the video currently downloading - no further videos from this job will be downloaded
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
          </div>

          <Alert severity="info">
            <Typography variant="body2">
              The job will show as &quot;Terminated&quot; in your download history with a list of completed videos.
            </Typography>
          </Alert>
        </div>
      </DialogContent>

      <DialogActions>
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
          startIcon={<StopIcon data-testid="StopIcon" />}
        >
          Terminate Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TerminateJobDialog;
