import React from 'react';
import { DialogContentText } from '../../../ui';
import ConfirmDialog from '../../../shared/ConfirmDialog';

interface YtdlpChannelApplyDialogProps {
  targetChannel: 'stable' | 'nightly' | null;
  onApply: () => void;
  onClose: () => void;
}

export const YtdlpChannelApplyDialog: React.FC<YtdlpChannelApplyDialogProps> = ({
  targetChannel,
  onApply,
  onClose,
}) => (
  <ConfirmDialog
    open={targetChannel !== null}
    title="Apply yt-dlp channel change now?"
    cancelLabel="Later"
    confirmLabel="Update now"
    onCancel={onClose}
    onConfirm={() => {
      onApply();
      onClose();
    }}
  >
    <DialogContentText>
      {targetChannel === 'nightly'
        ? 'Youtarr will switch yt-dlp to the latest nightly build now. Nightly builds get extractor fixes sooner but may occasionally break.'
        : 'Youtarr will switch yt-dlp back to the latest stable release now. This downgrades from the nightly build to the newest stable version.'}
    </DialogContentText>
    <DialogContentText className="mt-4">
      If you skip this, the change is applied at the next automatic update or app restart.
    </DialogContentText>
  </ConfirmDialog>
);
