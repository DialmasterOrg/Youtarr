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
  selectedTab: string;
  tabLabel: string;
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
  downloadDialogOpen,
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
        mode="manual"
      />

      {/* Refresh Confirmation Dialog */}
      <Dialog
        open={refreshConfirmOpen}
        onClose={onRefreshCancel}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">
          Refresh All {tabLabel} Videos
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            This will refresh all &apos;{tabLabel}&apos; videos for this Channel. This may take some time to complete.
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
