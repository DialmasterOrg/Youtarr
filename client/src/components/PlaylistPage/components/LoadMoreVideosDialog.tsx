import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '../../ui';

interface LoadMoreVideosDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const LoadMoreVideosDialog: React.FC<LoadMoreVideosDialogProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Load More Videos</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          This will load up to 5000 videos from this playlist on YouTube.{' '}
          <i>
            This can take quite some time to complete, depending on the size of
            the playlist and your internet connection!
          </i>
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mt-2">
          Private, members-only, and deleted videos can&apos;t be accessed, so
          they are never loaded; you may end up with fewer videos than YouTube
          reports for the playlist.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onConfirm}>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoadMoreVideosDialog;
