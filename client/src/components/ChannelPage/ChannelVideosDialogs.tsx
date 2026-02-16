import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';

export interface ChannelVideosDialogsProps {
  token: string | null;
  downloadDialogOpen: boolean;
  refreshConfirmOpen: boolean;
  deleteDialogOpen: boolean;
  fetchAllError: string | null;
  mobileTooltip: string | null;
  successMessage: string | null;
  errorMessage: string | null;
  videoCount: number;
  missingVideoCount: number;
  selectedForDeletion: number;
  defaultResolution: string;
  defaultResolutionSource: 'channel' | 'global';
  defaultAudioFormat?: string | null;
  defaultAudioFormatSource?: 'channel' | 'global';
  selectedTab: string;
  tabLabel: string;
  channelId?: string | null;
  onDownloadDialogClose: () => void;
  onDownloadConfirm: (settings: DownloadSettings | null) => void;
  onRefreshCancel: () => void;
  onRefreshConfirm: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onFetchAllErrorClose: () => void;
  onMobileTooltipClose: () => void;
  onSuccessMessageClose: () => void;
  onErrorMessageClose: () => void;
}

function ChannelVideosDialogs({
  token,
  downloadDialogOpen,
  channelId,
  refreshConfirmOpen,
  deleteDialogOpen,
  fetchAllError,
  mobileTooltip,
  successMessage,
  errorMessage,
  videoCount,
  missingVideoCount,
  selectedForDeletion,
  defaultResolution,
  defaultResolutionSource,
  defaultAudioFormat,
  defaultAudioFormatSource,
  selectedTab,
  tabLabel,
  onDownloadDialogClose,
  onDownloadConfirm,
  onRefreshCancel,
  onRefreshConfirm,
  onDeleteCancel,
  onDeleteConfirm,
  onFetchAllErrorClose,
  onMobileTooltipClose,
  onSuccessMessageClose,
  onErrorMessageClose,
}: ChannelVideosDialogsProps) {
  const [defaultRating, setDefaultRating] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const fetchSettings = async () => {
      if (!channelId || !token) return;
      try {
        const resp = await fetch(`/api/channels/${channelId}/settings`, {
          headers: { 'x-access-token': token },
          signal: controller.signal,
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (Object.prototype.hasOwnProperty.call(data, 'default_rating')) {
          setDefaultRating(data.default_rating ?? null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    };

    fetchSettings();
    return () => { controller.abort(); };
  }, [channelId, token]);
  return (
    <>
      {/* Download Settings Dialog */}
      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={onDownloadDialogClose}
        onConfirm={onDownloadConfirm}
        videoCount={videoCount}
        missingVideoCount={missingVideoCount}
        defaultResolution={defaultResolution}
        defaultResolutionSource={defaultResolutionSource}
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
        defaultRating={defaultRating}
        mode="manual"
        token={token}
      />

      {/* Load More Confirmation Dialog */}
      <Dialog
        open={refreshConfirmOpen}
        onClose={onRefreshCancel}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">
          Load More {tabLabel}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            This will load up to 5000 additional videos from this channel&apos;s &apos;{tabLabel}&apos; tab on YouTube. <i>This can take quite some time to complete, depending on the size of the channel and your internet connection!</i>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onRefreshCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={onRefreshConfirm} color="primary" variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={onDeleteCancel}
        onConfirm={onDeleteConfirm}
        videoCount={selectedForDeletion}
      />

      {/* Fetch All Error Snackbar */}
      <Snackbar
        open={fetchAllError !== null}
        autoHideDuration={6000}
        onClose={onFetchAllErrorClose}
      >
        <Alert onClose={onFetchAllErrorClose} severity="error">
          {fetchAllError}
        </Alert>
      </Snackbar>

      {/* Mobile Tooltip Snackbar */}
      <Snackbar
        open={mobileTooltip !== null}
        autoHideDuration={8000}
        onClose={onMobileTooltipClose}
      >
        <Alert onClose={onMobileTooltipClose} severity="info">
          {mobileTooltip}
        </Alert>
      </Snackbar>

      {/* Success Message Snackbar */}
      <Snackbar
        open={successMessage !== null}
        autoHideDuration={6000}
        onClose={onSuccessMessageClose}
      >
        <Alert onClose={onSuccessMessageClose} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Message Snackbar */}
      <Snackbar
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={onErrorMessageClose}
      >
        <Alert onClose={onErrorMessageClose} severity="error">
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ChannelVideosDialogs;
