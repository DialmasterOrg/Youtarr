import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert
} from '../ui';
import {
  Trash2 as DeleteIcon,
  Warning as WarningIcon
} from '../../lib/icons';

interface DeleteVideosDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  videoCount: number;
  // Selected videos excluded from deletion because their file is already missing
  skippedCount?: number;
}

const DeleteVideosDialog: React.FC<DeleteVideosDialogProps> = ({
  open,
  onClose,
  onConfirm,
  videoCount,
  skippedCount = 0
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <span className="flex items-center gap-2">
          <WarningIcon size={20} data-testid="WarningIcon" />
          Confirm Video Deletion
        </span>
      </DialogTitle>

      <DialogContent>
        <div style={{ paddingTop: 8 }}>
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            <Typography variant="body2">
              You are about to permanently delete {videoCount} {videoCount === 1 ? 'video' : 'videos'} from disk.
            </Typography>
          </Alert>

          {skippedCount > 0 && (
            <Alert severity="info" style={{ marginBottom: 16 }}>
              <Typography variant="body2">
                {skippedCount === 1
                  ? '1 selected video will not be affected because its file is already missing from disk.'
                  : `${skippedCount} selected videos will not be affected because their files are already missing from disk.`}
              </Typography>
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>
            This action will:
          </Typography>
          <ul style={{ marginLeft: 16, marginBottom: 16 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Remove the video {videoCount === 1 ? 'file' : 'files'} and associated metadata from your disk
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Mark the {videoCount === 1 ? 'video' : 'videos'} as removed in the database
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Free up storage space on your system
            </Typography>
          </ul>

          <Alert severity="error" style={{ marginBottom: 8 }}>
            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
              This action cannot be undone!
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary">
            You can re-download deleted videos later if needed.
          </Typography>
        </div>
      </DialogContent>

      <DialogActions style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
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
          startIcon={<DeleteIcon size={16} data-testid="DeleteForeverIcon" />}
        >
          Delete {videoCount === 1 ? 'Video' : 'Videos'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteVideosDialog;
