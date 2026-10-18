import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '../../ui';

interface RescanAnywayDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}

// Confirms a rescan that skips the unmounted-drive check: the escape for a
// downloads folder the user emptied on purpose.
const RescanAnywayDialog: React.FC<RescanAnywayDialogProps> = ({ open, onClose, onConfirm, pending }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Rescan anyway</DialogTitle>

    <DialogContent>
      <div className="space-y-3">
        <Typography variant="body2">
          Youtarr is not marking videos missing because the downloads folder looks unmounted. Only continue if you
          removed the files yourself and the downloads folder really is empty. If a drive or network share is
          unmounted, mount it instead.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every downloaded video whose file is not found will be marked missing. You can then mark them as deleted
          from this card.
        </Typography>
        <Alert severity="warning">
          Nothing on disk is touched, but with a drive unmounted this would mark your whole library missing.
        </Alert>
      </div>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose} variant="contained" color="primary" autoFocus>
        Cancel
      </Button>
      <Button onClick={onConfirm} variant="outlined" color="warning" disabled={pending}>
        Rescan anyway
      </Button>
    </DialogActions>
  </Dialog>
);

export default RescanAnywayDialog;
