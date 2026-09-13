import React, { useEffect, useRef, useState } from 'react';
import { PlaylistSortOrder } from '../../../hooks/usePlaylistDetail';
import { TableContainer, Typography } from '../../ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PlaylistVideo } from '../../../types/playlist';
import PlaylistVideoTable from './PlaylistVideoTable';
import PlaylistVideoCard from './PlaylistVideoCard';

// Account for the sidebar and page gutters, not just the viewport breakpoint.
const MIN_TABLE_WIDTH = 1200;

interface PlaylistVideoListProps {
  sortOrder?: PlaylistSortOrder;
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
  sortOrder = 'asc',
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
  const isNarrowViewport = useMediaQuery('(max-width: 1279px)');
  const listRef = useRef<HTMLDivElement>(null);
  const [isNarrowList, setIsNarrowList] = useState<boolean | null>(null);
  const showEmpty = !loading && videos.length === 0;

  useEffect(() => {
    const element = listRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const updateWidth = (width: number) => {
      if (width > 0) setIsNarrowList(width < MIN_TABLE_WIDTH);
    };
    updateWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => updateWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [showEmpty]);

  if (showEmpty) {
    return (
      <div className="flex justify-center items-center py-6">
        <Typography color="text.secondary">
          No videos yet. Trigger a refresh to fetch from YouTube.
        </Typography>
      </div>
    );
  }

  if (isNarrowList ?? isNarrowViewport) {
    return (
      <div ref={listRef}>
        {videos.map((v) => (
          <PlaylistVideoCard
            key={`${v.playlist_id}-${v.youtube_id}`}
            video={v}
            sortOrder={sortOrder}
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
    <div ref={listRef}>
      <TableContainer>
        <PlaylistVideoTable
          videos={videos}
          sortOrder={sortOrder}
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
    </div>
  );
};

export default PlaylistVideoList;
