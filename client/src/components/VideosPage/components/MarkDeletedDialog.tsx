import React from 'react';
import { Typography } from '../../ui';
import { FileX as MarkDeletedIcon } from 'lucide-react';
import ConfirmDialog from '../../shared/ConfirmDialog';

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
  <ConfirmDialog
    open={open}
    tone="warning"
    title={<><MarkDeletedIcon size={20} className="shrink-0" />Mark as deleted</>}
    confirmLabel={`Mark ${count} as deleted`}
    confirmDisabled={pending || count === 0}
    onCancel={onClose}
    onConfirm={onConfirm}
  >
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
  </ConfirmDialog>
);

export default MarkDeletedDialog;
