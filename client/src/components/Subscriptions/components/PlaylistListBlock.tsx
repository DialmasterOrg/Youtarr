import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  CircularProgress,
  List,
  Tooltip,
  Typography,
} from '../../ui';
import { Download as DownloadIcon, Delete as DeleteIcon } from '../../../lib/icons';
import { Playlist } from '../../../types/playlist';
import { DownloadFormatConfigIndicator } from './chips';

interface PlaylistListBlockProps {
  playlists: Playlist[];
  loading: boolean;
  onDelete: (playlist: Playlist) => void;
}

const PlaylistListBlock: React.FC<PlaylistListBlockProps> = ({ playlists, loading, onDelete }) => {
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

  return (
    <List disablePadding>
      {playlists.map((p) => {
        const thumb =
          p.thumbnail ||
          `https://i.ytimg.com/vi/placeholder/hqdefault.jpg`;
        return (
          <RouterLink
            key={p.id}
            to={`/playlist/${p.playlist_id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="flex items-center gap-3 px-2 py-2 hover:bg-muted/40 rounded-[var(--radius-ui)]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <img
                src={thumb}
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
              <div className="flex-1 min-w-0">
                <Typography variant="body2" className="line-clamp-1" style={{ fontWeight: 600 }}>
                  {p.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" className="line-clamp-1">
                  {p.uploader || '-'} • {p.video_count} videos
                </Typography>
              </div>
              <DownloadFormatConfigIndicator audioFormat={p.audio_format} />
              <Tooltip
                title={
                  p.auto_download
                    ? 'Auto-download is on'
                    : 'Auto-download is off'
                }
              >
                <span
                  className="flex items-center flex-shrink-0"
                  role="img"
                  aria-label={
                    p.auto_download
                      ? 'Auto-download on'
                      : 'Auto-download off'
                  }
                >
                  <DownloadIcon
                    size={18}
                    className={
                      p.auto_download
                        ? 'text-success'
                        : 'text-muted-foreground opacity-40'
                    }
                  />
                </span>
              </Tooltip>
              <Tooltip title="Remove playlist">
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', display: 'inline-flex', alignItems: 'center', padding: 4, flexShrink: 0 }}
                  onClick={(event) => {
                    // The whole row is a RouterLink; keep the click from navigating.
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(p);
                  }}
                  aria-label="Remove playlist"
                >
                  <DeleteIcon size={20} />
                </button>
              </Tooltip>
            </div>
          </RouterLink>
        );
      })}
    </List>
  );
};

export default PlaylistListBlock;
