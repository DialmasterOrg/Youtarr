import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '../ui';

export interface AddChannelDialogProps {
  open: boolean;
  onClose: () => void;
  channelName: string;
  channelUrl: string;
}

export default function AddChannelDialog({ open, onClose, channelName, channelUrl }: AddChannelDialogProps) {
  const navigate = useNavigate();

  const handleConfirm = () => {
    onClose();
    navigate('/subscriptions', { state: { addChannelUrl: channelUrl } });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add channel?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Add &quot;{channelName}&quot; to your channels? You will be taken to the Channels page to review and save.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>Add channel</Button>
      </DialogActions>
    </Dialog>
  );
}
