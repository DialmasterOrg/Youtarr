import React from 'react';
import { Box, Button, FormControlLabel, Switch, Typography } from '../../ui';
import { Refresh as RefreshIcon, Download as DownloadIcon } from '../../../lib/icons';
import InfoHint from './InfoHint';

interface LibraryDownloadsGroupProps {
  autoDownload: boolean;
  onToggleAutoDownload: (enabled: boolean) => void;
  togglePending: boolean;
  newCount: number | null;
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
  onRefresh,
  onDownloadAll,
  onOpenSettings,
  actionRunning,
  refreshing,
}) => {
  const downloadLabel =
    newCount === null
      ? 'Download new'
      : newCount === 1
        ? 'Download 1 new'
        : `Download ${newCount} new`;

  return (
    <Box
      className="flex-1 min-w-[250px] rounded-[var(--radius-ui)] p-4 flex flex-col gap-4"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <Typography variant="overline" color="text.secondary">
          Library &amp; Downloads
        </Typography>
        <InfoHint label="About library and downloads">
          <div>
            <p className="mb-2">
              <strong>Refresh from YouTube</strong> re-checks YouTube for new, removed, or
              changed videos. It does not download anything. Large playlists can take about
              a minute.
            </p>
            <p>
              <strong>Download</strong> queues videos not yet downloaded. You confirm settings
              and see the count before it starts.
            </p>
          </div>
        </InfoHint>
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

      <div className="flex items-center gap-2">
        <FormControlLabel
          control={
            <Switch
              checked={autoDownload}
              disabled={togglePending}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              color="primary"
            />
          }
          label="Auto-download new videos"
        />
        <InfoHint label="About auto-download">
          Videos added to this playlist on YouTube download automatically on the next scheduled
          run, no matter where in the playlist they&apos;re added. Use the &quot;Recently added
          first&quot; sort to see them.
        </InfoHint>
      </div>

      <div>
        <Button variant="outlined" size="sm" onClick={onOpenSettings} disabled={actionRunning}>
          Download settings
        </Button>
      </div>
    </Box>
  );
};

export default LibraryDownloadsGroup;
