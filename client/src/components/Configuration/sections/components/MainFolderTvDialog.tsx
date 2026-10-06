import React, { useId } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '../../../ui';

interface MainFolderTvDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

const PARAGRAPHS = [
  'Every channel saved directly in the main folder becomes a TV show. Channels you want to keep as regular videos must move to a subfolder first.',
  "Jellyfin and Emby: each __subfolder inside the main folder appears as an extra show in a TV library pointed at the main folder. They can't be excluded per library.",
  'Plex: Youtarr writes a .plexignore file in the main folder so a Plex TV library there skips the __subfolders.',
  'Choose this if all your content is TV-style, or your Plex TV library already points at the main folder (for example, you use the Plex TV Series filename preset).',
];

export const MainFolderTvDialog: React.FC<MainFolderTvDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  busy = false,
}) => {
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>Use the main folder for TV shows?</DialogTitle>
      <DialogContent>
        {PARAGRAPHS.map((text, index) => (
          <DialogContentText key={text} className={index > 0 ? 'mt-3' : undefined}>
            {text}
          </DialogContentText>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={14} /> : undefined}
        >
          Use for TV shows
        </Button>
      </DialogActions>
    </Dialog>
  );
};
