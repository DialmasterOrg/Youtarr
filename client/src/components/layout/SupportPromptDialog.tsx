import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '../ui';
import { Heart as HeartIcon } from '../../lib/icons';
import { ABOUT_PAGE_PATH, SupportLinkButtons } from '../shared/SupportLinkButtons';

// Opening any page with ?supportPrompt=preview shows the dialog without
// asking the server or recording anything, for checking it by hand.
const PREVIEW_QUERY_PARAM = 'supportPrompt';
const PREVIEW_QUERY_VALUE = 'preview';

interface SupportPromptDialogProps {
  token: string | null;
}

interface SupportPromptResponse {
  show: boolean;
}

const isPreviewRequested = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(PREVIEW_QUERY_PARAM) === PREVIEW_QUERY_VALUE;
};

const ignoreBackdropClick = () => {};

const SupportPromptDialog: React.FC<SupportPromptDialogProps> = ({ token }) => {
  const [isPreview] = useState<boolean>(isPreviewRequested);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    if (isPreview) {
      setOpen(true);
      return undefined;
    }

    let cancelled = false;
    const headers = { 'x-access-token': token };

    axios
      .get<SupportPromptResponse>('/api/support-prompt', { headers })
      .then((res) => {
        if (cancelled || !res.data.show) return undefined;
        setOpen(true);
        // Recorded on display, not on dismissal, so it can never appear twice.
        return axios.post('/api/support-prompt/shown', null, { headers });
      })
      .catch(() => {
        // The prompt is optional: a failed check or save must never surface as an error.
      });

    return () => {
      cancelled = true;
    };
  }, [token, isPreview]);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      // The prompt is shown once, so a stray click outside must not dismiss it.
      BackdropProps={{ onClick: ignoreBackdropClick }}
    >
      <DialogTitle onClose={handleClose}>
        <HeartIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        Enjoying Youtarr?
      </DialogTitle>

      <DialogContent>
        <div className="flex flex-col gap-3">
          <Typography variant="body2">
            You have downloaded more than 200 videos with Youtarr. Thank you for using it!
          </Typography>
          <Typography variant="body2">
            Youtarr is free and open source, and I build it in my spare time. If it is useful to you, please
            consider supporting its development.
          </Typography>
          <SupportLinkButtons onLinkClick={handleClose} />
          <Typography variant="caption" color="text.secondary">
            This is the only time Youtarr will ask. You can always find these links under{' '}
            <RouterLink to={ABOUT_PAGE_PATH} onClick={handleClose} className="text-primary underline">
              Settings &gt; About
            </RouterLink>
            .
          </Typography>
        </div>
      </DialogContent>

      <DialogActions>
        <Button variant="text" color="inherit" onClick={handleClose}>
          No thanks
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { PREVIEW_QUERY_PARAM, PREVIEW_QUERY_VALUE };
export default SupportPromptDialog;
