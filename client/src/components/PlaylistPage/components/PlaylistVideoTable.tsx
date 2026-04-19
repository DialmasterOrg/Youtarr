import React from 'react';
import {
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '../../ui';
import { CalendarToday as CalendarTodayIcon } from '../../../lib/icons';
import { PlaylistVideo } from '../../../types/playlist';
import { formatDurationClock } from '../../../utils';

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 67;

interface PlaylistVideoTableProps {
  videos: PlaylistVideo[];
  loading: boolean;
  onIgnore: (ytId: string) => void;
  onUnignore: (ytId: string) => void;
  onVideoClick: (video: PlaylistVideo) => void;
  pendingId?: string | null;
}

function statusLabel(v: PlaylistVideo): { label: string; color: 'success' | 'default' | 'warning' | 'error' } {
  if (v.ignored) return { label: 'Ignored', color: 'warning' };
  if (v.youtube_removed) return { label: 'Removed on YT', color: 'error' };
  if (v.downloaded) return { label: 'Downloaded', color: 'success' };
  return { label: 'Tracked', color: 'default' };
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const trimmed = value.trim();
  // yt-dlp dates can come back as YYYYMMDD; surface those as-is rather than
  // letting Date() return Invalid Date.
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? trimmed : d.toLocaleDateString();
}

const PlaylistVideoTable: React.FC<PlaylistVideoTableProps> = ({
  videos,
  loading,
  onIgnore,
  onUnignore,
  onVideoClick,
  pendingId,
}) => {
  if (!loading && videos.length === 0) {
    return (
      <div className="flex justify-center items-center py-6">
        <Typography color="text.secondary">
          No videos yet. Trigger a refresh to fetch from YouTube.
        </Typography>
      </div>
    );
  }

  return (
    <TableContainer>
      <Table size="small" className="table-fixed">
        <TableHead>
          <TableRow>
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
            return (
              <TableRow
                key={`${v.playlist_id}-${v.youtube_id}`}
                hover
                onClick={() => onVideoClick(v)}
                className="cursor-pointer"
                aria-label={`Open ${v.title || v.youtube_id}`}
              >
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
                  {v.published_at ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarTodayIcon size={12} />
                      {formatDate(v.published_at)}
                    </span>
                  ) : (
                    'N/A'
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDurationClock(v.duration) || '-'}
                </TableCell>
                <TableCell>
                  <Chip label={status.label} color={status.color} size="small" />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  {v.ignored ? (
                    <Button
                      size="sm"
                      variant="outlined"
                      onClick={() => onUnignore(v.youtube_id)}
                      disabled={isPending}
                    >
                      Unignore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outlined"
                      onClick={() => onIgnore(v.youtube_id)}
                      disabled={isPending}
                    >
                      Ignore
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PlaylistVideoTable;
