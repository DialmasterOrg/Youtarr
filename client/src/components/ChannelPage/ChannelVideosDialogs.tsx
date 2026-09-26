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
} from '../ui';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import { TabDownloadStats } from '../../types/Channel';
import { LOAD_MORE_MAX_VIDEOS } from './components/TabDownloadSummary';

// Load More re-reads the newest LOAD_MORE_MAX_VIDEOS entries of the tab.
// Members-only entries share those slots but are not in YouTube's public
// total, so the out-of-reach count is approximate.
function describeLoadMore(stats: TabDownloadStats | undefined, tabLabel: string): string {
  const limit = LOAD_MORE_MAX_VIDEOS.toLocaleString();
  if (!stats || stats.total === null || stats.loaded === undefined) {
    return `This will load up to the newest ${limit} videos from this channel's '${tabLabel}' tab on YouTube.`;
  }
  const total = stats.total.toLocaleString();
  if (stats.loaded >= stats.total) {
    return `All ${total} public videos on this tab are already loaded. Loading again refreshes the list.`;
  }
  const listed = `YouTube lists ${total} public videos on this tab and ${stats.loaded.toLocaleString()} are loaded.`;
  if (stats.total <= LOAD_MORE_MAX_VIDEOS) {
    return `${listed} Load More will load the full list.`;
  }
  const outOfReach = (stats.total - LOAD_MORE_MAX_VIDEOS).toLocaleString();
  return `${listed} Load More reads only the newest ${limit}, so about ${outOfReach} of the oldest can't be loaded here.`;
}

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
  // Channel page stats for the selected tab; without a YouTube total the
  // Load More dialog falls back to the generic limit.
  tabStats?: TabDownloadStats;
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
  tabStats,
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
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
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
            {describeLoadMore(tabStats, tabLabel)} <i>This can take quite some time to complete, depending on the size of the channel and your internet connection!</i>
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
