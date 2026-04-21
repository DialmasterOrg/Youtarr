import React from 'react';
import { Box, Grid, Skeleton, Stack, Typography } from '../../ui';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import { VideosViewMode } from '../hooks/useVideosViewMode';
import VideoCard from './VideoCard';
import VideosTable from './VideosTable';
import VideosListMobile from './VideosListMobile';

export interface VideosResultsProps {
  videos: VideoData[];
  loading: boolean;
  viewMode: VideosViewMode;
  isMobile: boolean;
  placeholderCount: number;
  selectedVideos: number[];
  enabledChannels: EnabledChannel[];
  imageErrors: Record<string, boolean>;
  orderBy: 'published' | 'added';
  sortOrder: 'asc' | 'desc';
  deleteDisabled: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleSelect: (videoId: number) => void;
  onSortChange: (newOrderBy: 'published' | 'added') => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onDeleteSingle: (videoId: number) => void;
  onImageError: (youtubeId: string) => void;
}

function GridSkeletons({ count }: { count: number }) {
  return (
    <Grid container spacing={2}>
      {[...Array(count)].map((_, i) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={`grid-skel-${i}`}>
          <Box>
            <Skeleton variant="rectangular" height={160} />
            <Skeleton variant="text" style={{ marginTop: 8 }} />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

function ListMobileSkeletons({ count }: { count: number }) {
  return (
    <Box>
      {[...Array(count)].map((_, i) => (
        <Box
          key={`mobile-skel-${i}`}
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 4px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Skeleton variant="rectangular" width={120} height={68} />
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="40%" />
            <Stack direction="row" spacing={1}>
              <Skeleton variant="rounded" width={60} height={18} />
              <Skeleton variant="rounded" width={60} height={18} />
            </Stack>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function TableSkeletons({ count }: { count: number }) {
  return (
    <Box>
      {[...Array(count)].map((_, i) => (
        <Box
          key={`table-skel-${i}`}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 12,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Skeleton variant="rectangular" width={32} height={32} />
          <Skeleton variant="rectangular" width={144} height={81} />
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton variant="text" width="70%" height={22} />
            <Skeleton variant="text" width="40%" />
            <Stack direction="row" spacing={1}>
              <Skeleton variant="rounded" width={80} height={22} />
              <Skeleton variant="rounded" width={80} height={22} />
              <Skeleton variant="rounded" width={100} height={22} />
            </Stack>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function VideosResults({
  videos,
  loading,
  viewMode,
  isMobile,
  placeholderCount,
  selectedVideos,
  enabledChannels,
  imageErrors,
  orderBy,
  sortOrder,
  deleteDisabled,
  onSelectAll,
  onToggleSelect,
  onSortChange,
  onOpenModal,
  onToggleProtection,
  onDeleteSingle,
  onImageError,
}: VideosResultsProps) {
  if (loading && videos.length === 0) {
    if (viewMode === 'grid') return <GridSkeletons count={placeholderCount} />;
    if (isMobile) return <ListMobileSkeletons count={placeholderCount} />;
    return <TableSkeletons count={placeholderCount} />;
  }

  if (videos.length === 0) {
    return (
      <Box style={{ padding: 32, textAlign: 'center' }}>
        <Typography color="text.secondary">No videos found</Typography>
      </Box>
    );
  }

  if (viewMode === 'grid') {
    return (
      <Grid container spacing={2}>
        {videos.map((video) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={video.id}>
            <VideoCard
              video={video}
              selected={selectedVideos.includes(video.id)}
              enabledChannels={enabledChannels}
              imageErrored={Boolean(imageErrors[video.youtubeId])}
              deleteDisabled={deleteDisabled}
              onToggleSelect={onToggleSelect}
              onOpenModal={onOpenModal}
              onToggleProtection={onToggleProtection}
              onDeleteSingle={onDeleteSingle}
              onImageError={onImageError}
            />
          </Grid>
        ))}
      </Grid>
    );
  }

  // Table view
  if (isMobile) {
    return (
      <VideosListMobile
        videos={videos}
        selectedVideos={selectedVideos}
        enabledChannels={enabledChannels}
        imageErrors={imageErrors}
        onToggleSelect={onToggleSelect}
        onOpenModal={onOpenModal}
        onToggleProtection={onToggleProtection}
        onImageError={onImageError}
      />
    );
  }

  return (
    <VideosTable
      videos={videos}
      selectedVideos={selectedVideos}
      enabledChannels={enabledChannels}
      imageErrors={imageErrors}
      orderBy={orderBy}
      sortOrder={sortOrder}
      deleteDisabled={deleteDisabled}
      onSelectAll={onSelectAll}
      onToggleSelect={onToggleSelect}
      onSortChange={onSortChange}
      onOpenModal={onOpenModal}
      onToggleProtection={onToggleProtection}
      onDeleteSingle={onDeleteSingle}
      onImageError={onImageError}
    />
  );
}

export default VideosResults;
