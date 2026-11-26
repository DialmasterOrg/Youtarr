import React, { useState } from 'react';
import { Grid } from '../../ui';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { VideoListViewMode } from '../../shared/VideoList';
import VideoCard from '../VideoCard';
import VideoListItem from '../VideoListItem';
import VideoTableView from '../VideoTableView';
import { ChannelVideoSelection } from '../hooks/useChannelVideoSelection';
import { ChannelVideoSortBy, ChannelVideoSortOrder } from '../hooks/useChannelVideoQuery';

interface ChannelVideosContentProps {
  viewMode: VideoListViewMode;
  videos: ChannelVideo[];
  isMobile: boolean;
  selection: Pick<
    ChannelVideoSelection,
    | 'checkedBoxes'
    | 'selectedForDeletion'
    | 'selectionMode'
    | 'onCheckChange'
    | 'onDeletionChange'
    | 'selectAll'
    | 'clearAll'
  >;
  sortBy: ChannelVideoSortBy;
  sortOrder: ChannelVideoSortOrder;
  onSortChange: (newSortBy: ChannelVideoSortBy) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip: (message: string) => void;
  onVideoClick: (video: ChannelVideo) => void;
}

// The channel's videos in the chosen layout: cards, list rows or a table.
function ChannelVideosContent({
  viewMode,
  videos,
  isMobile,
  selection,
  sortBy,
  sortOrder,
  onSortChange,
  onToggleIgnore,
  onToggleProtection,
  onMobileTooltip,
  onVideoClick,
}: ChannelVideosContentProps) {
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const { checkedBoxes, selectedForDeletion, selectionMode, onCheckChange, onDeletionChange } = selection;

  if (viewMode === 'grid') {
    return (
      <Grid container spacing={2}>
        {videos.map((video) => (
          <VideoCard
            key={video.youtube_id}
            video={video}
            isMobile={isMobile}
            checkedBoxes={checkedBoxes}
            hoveredVideo={hoveredVideo}
            selectedForDeletion={selectedForDeletion}
            selectionMode={selectionMode}
            onCheckChange={onCheckChange}
            onHoverChange={setHoveredVideo}
            onDeletionChange={onDeletionChange}
            onToggleIgnore={onToggleIgnore}
            onToggleProtection={onToggleProtection}
            onMobileTooltip={onMobileTooltip}
            onVideoClick={onVideoClick}
          />
        ))}
      </Grid>
    );
  }

  if (viewMode === 'list') {
    return (
      <div>
        {videos.map((video) => (
          <VideoListItem
            key={video.youtube_id}
            video={video}
            checkedBoxes={checkedBoxes}
            selectedForDeletion={selectedForDeletion}
            selectionMode={selectionMode}
            onCheckChange={onCheckChange}
            onDeletionChange={onDeletionChange}
            onToggleIgnore={onToggleIgnore}
            onToggleProtection={onToggleProtection}
            onMobileTooltip={onMobileTooltip}
            onVideoClick={onVideoClick}
          />
        ))}
      </div>
    );
  }

  return (
    <VideoTableView
      videos={videos}
      checkedBoxes={checkedBoxes}
      selectedForDeletion={selectedForDeletion}
      selectionMode={selectionMode}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onCheckChange={onCheckChange}
      onSelectAll={selection.selectAll}
      onClearSelection={selection.clearAll}
      onSortChange={onSortChange}
      onDeletionChange={onDeletionChange}
      onToggleIgnore={onToggleIgnore}
      onToggleProtection={onToggleProtection}
      onMobileTooltip={onMobileTooltip}
      onVideoClick={onVideoClick}
    />
  );
}

export default ChannelVideosContent;
