import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '../../ui';
import { FileX as MarkDeletedIcon } from 'lucide-react';

interface MarkDeletedDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  // Missing videos in the selection: the ones that will be marked.
  count: number;
  // Selected videos that are not missing, left unchanged.
  skippedCount: number;
  pending: boolean;
}

const videos = (n: number) => (n === 1 ? 'video' : 'videos');

// Confirms turning missing videos into deleted ones. The record is kept; only
// how the Videos page treats it changes.
const MarkDeletedDialog: React.FC<MarkDeletedDialogProps> = ({
  open,
  onClose,
  onConfirm,
  count,
  skippedCount,
  pending,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>
      <MarkDeletedIcon size={20} className="shrink-0" />
      Mark as deleted
    </DialogTitle>

    <DialogContent>
      <div className="space-y-3">
        <Typography component="p" variant="body2">
          {count} missing {videos(count)} will be marked as deleted and hidden by default.
        </Typography>
        {skippedCount > 0 && (
          <Typography component="p" variant="body2" color="text.secondary">
            {skippedCount} selected {videos(skippedCount)} {skippedCount === 1 ? 'is' : 'are'} not missing and will not change.
          </Typography>
        )}
        <Typography component="p" variant="body2" color="text.secondary">
          The record is kept, so the video can still be re-downloaded; if its file turns up again, the rescan marks it downloaded.
        </Typography>
      </div>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose} variant="contained" color="primary" autoFocus>
        Cancel
      </Button>
      <Button onClick={onConfirm} variant="outlined" color="warning" disabled={pending || count === 0}>
        Mark {count} as deleted
      </Button>
    </DialogActions>
  </Dialog>
);

export default MarkDeletedDialog;
