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
  DeleteForever as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface DeleteVideosDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  videoCount: number;
}

const DeleteVideosDialog: React.FC<DeleteVideosDialogProps> = ({
  open,
  onClose,
  onConfirm,
  videoCount
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
        Confirm Video Deletion
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              You are about to permanently delete {videoCount} {videoCount === 1 ? 'video' : 'videos'} from disk.
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action will:
          </Typography>
          <Box component="ul" sx={{ ml: 2, mb: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Remove the video {videoCount === 1 ? 'file' : 'files'} and associated metadata from your disk
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Mark the {videoCount === 1 ? 'video' : 'videos'} as removed in the database
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Free up storage space on your system
            </Typography>
          </Box>

          <Alert severity="error" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              This action cannot be undone!
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary">
            You can re-download deleted videos later if needed.
          </Typography>
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
          color="error"
          startIcon={<DeleteIcon />}
        >
          Delete {videoCount === 1 ? 'Video' : 'Videos'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteVideosDialog;
