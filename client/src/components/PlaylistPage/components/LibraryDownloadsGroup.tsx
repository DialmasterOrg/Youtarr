import React from 'react';
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from '../../ui';
import { Refresh as RefreshIcon, Download as DownloadIcon } from '../../../lib/icons';
import { InfoTooltip } from '../../shared/InfoTooltip';
import { Playlist } from '../../../types/playlist';
import { MAX_PLAYLIST_VIDEOS } from '../playlistConstants';

interface LibraryDownloadsGroupProps {
  autoDownload: boolean;
  onToggleAutoDownload: (enabled: boolean) => void;
  togglePending: boolean;
  newCount: number | null;
  hasFollowingBaseline?: boolean;
  setupError?: Playlist['auto_download_setup_error'];
  followingExistingCount?: number | null;
  followingRequestedCount?: number | null;
  // Undownloaded videos the playlist's download filters skip.
  filteredCount?: number | null;
  // Why the filters could not be evaluated; set while automatic picks are held.
  filterError?: string | null;
  onChooseExisting?: () => void;
  onRefresh: () => void;
  onDownloadAll: () => void;
  onOpenSettings: () => void;
  actionRunning: boolean;
  refreshing: boolean;
}

const LibraryDownloadsGroup: React.FC<LibraryDownloadsGroupProps> = ({
  autoDownload,
  onToggleAutoDownload,
  togglePending,
  newCount,
  hasFollowingBaseline,
  setupError,
  followingExistingCount,
  followingRequestedCount,
  filteredCount,
  filterError,
  onChooseExisting,
  onRefresh,
  onDownloadAll,
  onOpenSettings,
  actionRunning,
  refreshing,
}) => {
  const downloadLabel =
    newCount === null
      ? 'Download all undownloaded'
      : newCount === 1
        ? 'Download 1 video'
        : `Download all ${newCount} videos`;

  return (
    <Box
      className="flex-1 min-w-[250px] rounded-[var(--radius-ui)] p-4 flex flex-col gap-4"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <Typography variant="overline" color="text.secondary">
          Library &amp; Downloads
        </Typography>
        <InfoTooltip label="About library and downloads" text={
          <div>
            <p className="mb-2">
              <strong>Refresh from YouTube</strong> re-checks the entire playlist on YouTube
              for new, removed, or changed videos. It does not download anything. Large
              playlists can take a few minutes.
            </p>
            <p>
              <strong>Download all</strong> queues every eligible video not previously downloaded. You confirm settings
              and see the count before it starts. Videos skipped by this playlist&apos;s download filters are left
              out; select them in the list to download them anyway.
            </p>
          </div>
        } />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="contained"
          size="sm"
          onClick={onRefresh}
          disabled={actionRunning}
          loading={refreshing}
          startIcon={<RefreshIcon size={16} />}
        >
          {refreshing ? 'Refreshing...' : 'Refresh from YouTube'}
        </Button>
        <Button
          variant="contained"
          size="sm"
          color="warning"
          onClick={onDownloadAll}
          disabled={actionRunning || newCount === 0}
          startIcon={<DownloadIcon size={16} />}
        >
          {downloadLabel}
        </Button>
      </div>

      {onChooseExisting && <Button variant="outlined" size="sm" onClick={onChooseExisting} disabled={actionRunning || togglePending}>Choose existing videos</Button>}

      <div className="flex items-center gap-2">
        <FormControlLabel
          control={
            <Switch
              checked={autoDownload}
              disabled={togglePending || actionRunning}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              color="primary"
            />
          }
          label="Auto-download new videos"
        />
        <InfoTooltip label="About auto-download" text={<>
          After setup, Youtarr downloads newly discovered entries wherever they appear in this
          playlist. Selecting existing videos queues the full selection immediately. Each scheduled run can queue up to
          your limit in new discoveries, plus the same number of older saved selections to retry.
          Older retries take turns, starting with those tried least recently. Pausing preserves tracking and saved selections.
        </>} />
      </div>

      {hasFollowingBaseline && (
        <p className="text-xs text-muted-foreground">
          {autoDownload ? 'Following new additions.' : 'Following paused. Resume to catch up on new additions.'}
          {followingExistingCount != null && followingExistingCount > 0 && ` ${followingExistingCount} older undownloaded videos require manual selection.`}
        </p>
      )}

      {followingRequestedCount != null && followingRequestedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {followingRequestedCount} selected {followingRequestedCount === 1 ? 'video is' : 'videos are'} not downloaded yet.
          {autoDownload
            ? ' Check Download History for download progress and saved playlist retries.'
            : ' Automatic retries are paused.'}
        </p>
      )}

      {filterError && (
        <Alert severity="warning">
          This playlist&apos;s title filter could not be checked, so no video counts as a match. Automatic downloads
          and Download all are on hold until it is fixed in Playlist settings. Videos you select yourself still
          download. ({filterError})
        </Alert>
      )}

      {!filterError && filteredCount != null && filteredCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {`${filteredCount} undownloaded ${filteredCount === 1 ? 'video is' : 'videos are'} skipped by this playlist's download filters. Select them in the list to download them anyway.`}
        </p>
      )}

      {!hasFollowingBaseline && (autoDownload || setupError) && (
        <Alert severity="warning">
          {setupError === 'PLAYLIST_TOO_LARGE'
            ? `Auto-download is off. Automatic following supports up to ${MAX_PLAYLIST_VIDEOS.toLocaleString()} entries. You can still choose tracked videos manually.`
            : autoDownload
              ? 'Waiting for a complete starting snapshot from YouTube. No automatic downloads can start yet; Youtarr will retry on scheduled runs.'
              : 'Auto-download setup is incomplete. YouTube did not provide a complete starting snapshot. Retry setup when you are ready.'}
          <Button variant="text" size="sm" onClick={() => onToggleAutoDownload(true)} disabled={actionRunning || togglePending}>
            Retry following setup
          </Button>
        </Alert>
      )}

      <div>
        <Button variant="outlined" size="sm" onClick={onOpenSettings} disabled={actionRunning}>
          Playlist settings
        </Button>
      </div>
    </Box>
  );
};

export default LibraryDownloadsGroup;
