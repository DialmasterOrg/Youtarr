import React from 'react';
import {
  Button,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '../../ui';
import { PlaylistVideo } from '../../../types/playlist';
import { formatDurationClock } from '../../../utils';
import { isDownloadable, statusLabel, PublishedDate } from './playlistVideoHelpers';

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 67;

interface PlaylistVideoTableProps {
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
  const downloadableIds = videos.filter(isDownloadable).map((v) => v.youtube_id);
  const selectedDownloadable = downloadableIds.filter(isSelected);
  const allSelected =
    downloadableIds.length > 0 && selectedDownloadable.length === downloadableIds.length;
  const someSelected =
    selectedDownloadable.length > 0 && selectedDownloadable.length < downloadableIds.length;

  return (
    <Table size="small" className="table-fixed">
      <TableHead>
        <TableRow>
          <TableCell component="th" className="w-[44px]">
            <Checkbox
              indeterminate={someSelected}
              checked={allSelected}
              onChange={(e) => (e.target.checked ? onSelectAll(downloadableIds) : onClearSelection())}
              aria-label="Select all downloadable videos"
            />
          </TableCell>
          <TableCell component="th" className="w-[60px]">#</TableCell>
          <TableCell component="th" className="w-[140px]">Thumbnail</TableCell>
          <TableCell component="th">Title</TableCell>
          <TableCell component="th" className="w-[18%]">Channel</TableCell>
          <TableCell component="th" className="w-[110px] whitespace-nowrap">Published</TableCell>
          <TableCell component="th" className="w-[90px] whitespace-nowrap">Duration</TableCell>
          <TableCell component="th" className="w-[140px] whitespace-nowrap">Status</TableCell>
          <TableCell component="th" className="w-[120px] whitespace-nowrap" align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {videos.map((v) => {
          const isPending = pendingId === v.youtube_id;
          const status = statusLabel(v);
          const selectable = isDownloadable(v);
          return (
            <TableRow
              key={`${v.playlist_id}-${v.youtube_id}`}
              hover
              onClick={() => onVideoClick(v)}
              className="cursor-pointer"
              aria-label={`Open ${v.title || v.youtube_id}`}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                {selectable && (
                  <Checkbox
                    checked={isSelected(v.youtube_id)}
                    onChange={() => onToggle(v.youtube_id)}
                    aria-label={`Select ${v.title || v.youtube_id}`}
                  />
                )}
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
                  {v.title || v.youtube_id}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" className="text-muted-foreground line-clamp-1">
                  {v.channel_name || '-'}
                </Typography>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <PublishedDate value={v.published_at} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDurationClock(v.duration) || '-'}
              </TableCell>
              <TableCell>
                <Chip label={status.label} color={status.color} size="small" />
              </TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                {v.ignored ? (
                  <Button size="sm" variant="outlined" onClick={() => onUnignore(v.youtube_id)} disabled={isPending}>
                    Unignore
                  </Button>
                ) : (
                  <Button size="sm" variant="outlined" onClick={() => onIgnore(v.youtube_id)} disabled={isPending}>
                    Ignore
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default PlaylistVideoTable;
