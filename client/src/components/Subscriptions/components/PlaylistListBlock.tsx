import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Chip,
  CircularProgress,
  List,
  Tooltip,
  Typography,
} from '../../ui';
import { FileDownload as FileDownloadIcon, Delete as DeleteIcon } from '../../../lib/icons';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Playlist } from '../../../types/playlist';
import { formatDownloadPercent, formatVideoTotal, playlistCountParts } from '../../../utils/playlistCounts';
import PlaylistCountsInfo from '../../shared/PlaylistCountsInfo';
import { SHARED_CHIP_RADIUS } from '../../shared/chipStyles';
import { DownloadFormatConfigIndicator } from './chips';

// Playlist | Downloaded | Total Videos | Auto-download | remove button
const PLAYLIST_LIST_DESKTOP_TEMPLATE = 'minmax(0, 1fr) 120px 100px 180px 32px';
const DESKTOP_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: PLAYLIST_LIST_DESKTOP_TEMPLATE,
  columnGap: 16,
  alignItems: 'center',
};

const HEADER_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

interface PlaylistListBlockProps {
  playlists: Playlist[];
  total: number;
  loading: boolean;
  onDelete: (playlist: Playlist) => void;
}

const PlaylistThumbnail: React.FC<{ playlist: Playlist }> = ({ playlist }) => (
  <img
    src={playlist.thumbnail || 'https://i.ytimg.com/vi/placeholder/hqdefault.jpg'}
    alt=""
    style={{
      width: 96,
      height: 54,
      objectFit: 'cover',
      borderRadius: 'var(--radius-thumb)',
      background: 'var(--muted)',
      flexShrink: 0,
    }}
    loading="lazy"
  />
);

const PlaylistTitle: React.FC<{ playlist: Playlist }> = ({ playlist }) => (
  <>
    <Typography variant="body2" className="line-clamp-1" style={{ fontWeight: 600 }}>
      {playlist.title}
    </Typography>
    <Typography variant="caption" color="text.secondary" className="line-clamp-1">
      {playlist.uploader || '-'}
    </Typography>
  </>
);

const AutoDownloadIndicator: React.FC<{ enabled: boolean; isMobile: boolean }> = ({ enabled, isMobile }) => {
  if (!enabled) {
    // Off is shown by the chip's absence; screen readers still hear it.
    return <span className="sr-only">Auto-download off</span>;
  }
  return (
    <Tooltip title="Auto-download is on">
      <span className="inline-flex flex-shrink-0" role="img" aria-label="Auto-download on">
        <Chip
          label={isMobile ? 'Auto' : 'Auto-download'}
          size="small"
          variant="filled"
          color="primary"
          icon={<FileDownloadIcon size={12} />}
          style={{ fontSize: '0.7rem', height: 24, borderRadius: SHARED_CHIP_RADIUS }}
        />
      </span>
    </Tooltip>
  );
};

const RemoveButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Tooltip title="Remove playlist">
    <button
      type="button"
      className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, flexShrink: 0 }}
      onClick={(event) => {
        // The whole row is a RouterLink; keep the click from navigating.
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      aria-label="Remove playlist"
    >
      <DeleteIcon size={20} />
    </button>
  </Tooltip>
);

// Numbers stand alone in their columns; screen readers also hear the unit.
const DownloadedCell: React.FC<{ playlist: Playlist }> = ({ playlist }) => {
  const downloaded = playlist.downloaded_count;
  const percent = typeof downloaded === 'number'
    ? formatDownloadPercent(downloaded, playlist.video_count)
    : null;
  return (
    <Typography variant="body2" className="text-right tabular-nums">
      {typeof downloaded === 'number' ? downloaded.toLocaleString() : '-'}
      {percent && <span className="text-muted-foreground"> ({percent})</span>}
      <span className="sr-only"> downloaded</span>
    </Typography>
  );
};

const TotalCell: React.FC<{ playlist: Playlist }> = ({ playlist }) => (
  <Typography variant="body2" className="text-right tabular-nums">
    {formatVideoTotal(playlist.video_count)}
    <span className="sr-only"> videos</span>
  </Typography>
);

const DesktopColumnHeader: React.FC = () => (
  <div className="px-2 py-1 text-muted-foreground" style={DESKTOP_GRID_STYLE}>
    <Typography variant="caption" style={HEADER_LABEL_STYLE}>Playlist</Typography>
    <div className="flex items-center justify-end gap-1">
      <Typography variant="caption" style={HEADER_LABEL_STYLE}>Downloaded</Typography>
      <PlaylistCountsInfo />
    </div>
    <Typography variant="caption" className="text-right" style={HEADER_LABEL_STYLE}>Total Videos</Typography>
    <Typography variant="caption" style={HEADER_LABEL_STYLE}>Auto-download</Typography>
    <div />
  </div>
);

const DesktopRow: React.FC<{ playlist: Playlist; onDelete: () => void }> = ({ playlist, onDelete }) => (
  <div style={DESKTOP_GRID_STYLE}>
    <div className="flex items-center gap-3 min-w-0">
      <PlaylistThumbnail playlist={playlist} />
      <div className="min-w-0">
        <PlaylistTitle playlist={playlist} />
      </div>
    </div>
    <DownloadedCell playlist={playlist} />
    <TotalCell playlist={playlist} />
    <div className="flex items-center gap-2">
      <AutoDownloadIndicator enabled={playlist.auto_download} isMobile={false} />
      <DownloadFormatConfigIndicator audioFormat={playlist.audio_format} />
    </div>
    <RemoveButton onClick={onDelete} />
  </div>
);

const MobileRow: React.FC<{ playlist: Playlist; onDelete: () => void }> = ({ playlist, onDelete }) => (
  <div className="flex items-center gap-3">
    <PlaylistThumbnail playlist={playlist} />
    <div className="flex-1 min-w-0">
      <PlaylistTitle playlist={playlist} />
      {/* Separate parts so a narrow row wraps between them instead of cutting one off. */}
      <Typography variant="caption" color="text.secondary" className="flex flex-wrap gap-x-1">
        {playlistCountParts(playlist.video_count, playlist.downloaded_count).map((part, index) => (
          <span key={part} className="whitespace-nowrap">
            {index > 0 && '• '}
            {part}
          </span>
        ))}
      </Typography>
    </div>
    <DownloadFormatConfigIndicator audioFormat={playlist.audio_format} />
    <AutoDownloadIndicator enabled={playlist.auto_download} isMobile />
    <RemoveButton onClick={onDelete} />
  </div>
);

const PlaylistListBlock: React.FC<PlaylistListBlockProps> = ({ playlists, total, loading, onDelete }) => {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (loading && playlists.length === 0) {
    return (
      <div className="flex justify-center items-center py-6">
        <CircularProgress />
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex justify-center items-center py-6">
        <Typography color="text.secondary">
          No playlist subscriptions yet. Use the Playlist button above to subscribe to one.
        </Typography>
      </div>
    );
  }

  const Row = isMobile ? MobileRow : DesktopRow;

  return (
    <>
      <div className="flex items-center gap-1">
        <Typography variant="body2" color="text.secondary">
          Total playlists: {total}
        </Typography>
        {/* On desktop the explanation sits in the Downloaded column header. */}
        {isMobile && <PlaylistCountsInfo />}
      </div>
      <List disablePadding>
        {!isMobile && <DesktopColumnHeader />}
        {playlists.map((p) => (
          <RouterLink
            key={p.id}
            to={`/playlist/${p.playlist_id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="px-2 py-2 hover:bg-muted/40 rounded-[var(--radius-ui)]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <Row playlist={p} onDelete={() => onDelete(p)} />
            </div>
          </RouterLink>
        ))}
      </List>
    </>
  );
};

export default PlaylistListBlock;
