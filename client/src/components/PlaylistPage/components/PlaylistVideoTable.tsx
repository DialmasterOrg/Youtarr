import React from 'react';
import { PlaylistSortOrder } from '../../../hooks/usePlaylistDetail';
import {
  Checkbox,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '../../ui';
import { PlaylistVideo } from '../../../types/playlist';
import { formatDurationClock } from '../../../utils';
import { Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon } from '../../../lib/icons';
import { isSelectable, statusLabel, PlaylistVideoDates, toDownloadFileProps } from './playlistVideoHelpers';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import WatchedChip from '../../shared/WatchedChip';
import { REMOVAL_TOOLTIP_CLASS } from '../../shared/RemovalDescription';

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 67;

interface PlaylistVideoTableProps {
  sortOrder?: PlaylistSortOrder;
  videos: PlaylistVideo[];
  onIgnore: (ytId: string) => void;
  onUnignore: (ytId: string) => void;
  onVideoClick: (video: PlaylistVideo) => void;
  pendingId?: string | null;
  isSelected: (ytId: string) => boolean;
  onToggle: (ytId: string) => void;
  onSelectAll: (ytIds: string[]) => void;
  onClearSelection: () => void;
}

const PlaylistVideoTable: React.FC<PlaylistVideoTableProps> = ({
  sortOrder = 'asc',
  videos,
  onIgnore,
  onUnignore,
  onVideoClick,
  pendingId,
  isSelected,
  onToggle,
  onSelectAll,
  onClearSelection,
}) => {
  const selectableIds = videos.filter(isSelectable).map((v) => v.youtube_id);
  const selectedCount = selectableIds.filter(isSelected).length;
  const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length;
  const someSelected = selectedCount > 0 && selectedCount < selectableIds.length;

  // Fixed columns stay narrow so the title column keeps room down to
  // PlaylistVideoList's MIN_TABLE_WIDTH; the title column takes the rest.
  return (
    <Table size="small" className="table-fixed">
      <TableHead>
        <TableRow>
          <TableCell component="th" className="w-[48px]">
            <Checkbox
              indeterminate={someSelected}
              checked={allSelected}
              onChange={(e) => (e.target.checked ? onSelectAll(selectableIds) : onClearSelection())}
              aria-label="Select all videos"
            />
          </TableCell>
          <TableCell component="th" className="w-[48px]">#</TableCell>
          <TableCell component="th" className="w-[140px]">Thumbnail</TableCell>
          <TableCell component="th">Title</TableCell>
          <TableCell component="th" className="w-[112px]">Dates</TableCell>
          <TableCell component="th" className="w-[72px] whitespace-nowrap">Duration</TableCell>
          <TableCell component="th" className="w-[120px] whitespace-nowrap">Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {videos.map((v) => {
          const label = v.title || v.youtube_id;
          const isPending = pendingId === v.youtube_id;
          const status = statusLabel(v);
          const selectable = isSelectable(v);
          return (
            <TableRow
              key={`${v.playlist_id}-${v.youtube_id}`}
              hover
              onClick={() => onVideoClick(v)}
              className="cursor-pointer"
              aria-label={`Open ${label}`}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-0.5">
                  {selectable && (
                    <Checkbox
                      checked={isSelected(v.youtube_id)}
                      onChange={() => onToggle(v.youtube_id)}
                      aria-label={`Select ${label}`}
                    />
                  )}
                  {v.ignored ? (
                    <Tooltip title="Include this video in this playlist's downloads and server sync again">
                      <IconButton
                        size="sm"
                        color="warning"
                        aria-label={`Include ${label}`}
                        onClick={() => onUnignore(v.youtube_id)}
                        disabled={isPending}
                      >
                        <CheckCircleOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip
                      title={
                        v.downloaded
                          ? 'Exclude from this playlist: removed from synced server playlists and M3U files; the file stays on disk'
                          : 'Exclude from this playlist: skipped when downloading this playlist'
                      }
                    >
                      <IconButton
                        size="sm"
                        className="text-muted-foreground"
                        aria-label={`Exclude ${label}`}
                        onClick={() => onIgnore(v.youtube_id)}
                        disabled={isPending}
                      >
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
              <TableCell>{v.position}</TableCell>
              <TableCell>
                <div
                  className="relative inline-block overflow-hidden bg-[var(--media-placeholder-background)] rounded-[var(--radius-thumb)]"
                  style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                >
                  {v.thumbnail && (
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="block object-cover rounded-[var(--radius-thumb)]"
                      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                      loading="lazy"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Typography variant="body2" className="line-clamp-2 whitespace-normal">
                  {label}
                </Typography>
                <Typography variant="caption" className="block mt-0.5 text-muted-foreground line-clamp-1">
                  {v.channel_name || '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <PlaylistVideoDates video={v} sortOrder={sortOrder} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDurationClock(v.duration) || '-'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  {v.downloaded ? (
                    <>
                      <DownloadFormatIndicator {...toDownloadFileProps(v)} orientation="vertical" />
                      {v.ignored && (
                        <Chip label={status.label} color={status.color} size="small" />
                      )}
                    </>
                  ) : status.tooltip ? (
                    <Tooltip title={status.tooltip} enterTouchDelay={0} className={REMOVAL_TOOLTIP_CLASS}>
                      <Chip label={status.label} color={status.color} size="small" />
                    </Tooltip>
                  ) : (
                    <Chip label={status.label} color={status.color} size="small" />
                  )}
                  <WatchedChip watchedBy={v.watched_by || []} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default PlaylistVideoTable;
