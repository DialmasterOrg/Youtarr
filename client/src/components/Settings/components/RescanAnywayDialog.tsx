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
  // The library check's message naming the folder that looks empty, or null.
  folderMessage: string | null;
}

// Confirms a rescan that skips the unmounted-drive check: the escape for a
// downloads folder (or subfolder) the user emptied on purpose.
const RescanAnywayDialog: React.FC<RescanAnywayDialogProps> = ({ open, onClose, onConfirm, pending, folderMessage }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Rescan anyway</DialogTitle>

    <DialogContent>
      <div className="space-y-3">
        <Typography variant="body2" className="break-words">
          {folderMessage ?? 'The downloads folder looks empty.'} Youtarr is not marking the videos stored there
          missing, in case a drive or network share is unmounted. Only continue if you removed the files yourself.
          If a drive or network share is unmounted, mount it instead.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every downloaded video whose file is not found will be marked missing. You can then mark them as deleted
          from this card.
        </Typography>
        <Alert severity="warning">
          Nothing on disk is touched, but with a drive unmounted this would mark every video on it missing.
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
