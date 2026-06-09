import React from 'react';
import { TableContainer, Typography } from '../../ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PlaylistVideo } from '../../../types/playlist';
import PlaylistVideoTable from './PlaylistVideoTable';
import PlaylistVideoCard from './PlaylistVideoCard';

interface PlaylistVideoListProps {
  videos: PlaylistVideo[];
  loading: boolean;
  onIgnore: (ytId: string) => void;
  onUnignore: (ytId: string) => void;
  onVideoClick: (video: PlaylistVideo) => void;
  pendingId?: string | null;
  isSelected: (ytId: string) => boolean;
  onToggle: (ytId: string) => void;
  onSelectAll: (ytIds: string[]) => void;
  onClearSelection: () => void;
}

const PlaylistVideoList: React.FC<PlaylistVideoListProps> = ({
  videos,
  loading,
  onIgnore,
  onUnignore,
  onVideoClick,
  pendingId,
  isSelected,
  onToggle,
  onSelectAll,
  onClearSelection,
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (!loading && videos.length === 0) {
    return (
      <div className="flex justify-center items-center py-6">
        <Typography color="text.secondary">
          No videos yet. Trigger a refresh to fetch from YouTube.
        </Typography>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div>
        {videos.map((v) => (
          <PlaylistVideoCard
            key={`${v.playlist_id}-${v.youtube_id}`}
            video={v}
            onIgnore={onIgnore}
            onUnignore={onUnignore}
            onVideoClick={onVideoClick}
            pendingId={pendingId}
            isSelected={isSelected}
            onToggle={onToggle}
          />
        ))}
      </div>
    );
  }

  return (
    <TableContainer>
      <PlaylistVideoTable
        videos={videos}
        onIgnore={onIgnore}
        onUnignore={onUnignore}
        onVideoClick={onVideoClick}
        pendingId={pendingId}
        isSelected={isSelected}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
      />
    </TableContainer>
  );
};

export default PlaylistVideoList;
