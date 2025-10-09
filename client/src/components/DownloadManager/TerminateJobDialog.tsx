import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import {
  Stop as StopIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        Confirm Download Termination
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              You are about to terminate the currently running download job.
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action will:
          </Typography>
          <Box component="ul" sx={{ ml: 2, mb: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Stop the current download after completing the current video
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Save all videos that have already been downloaded
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Clean up any partial downloads in progress
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              NOT affect any queued jobs (they will continue after this one)
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 1 }}>
            <Typography variant="body2">
              The job will show as "Terminated" in your download history with a list of completed videos.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
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
