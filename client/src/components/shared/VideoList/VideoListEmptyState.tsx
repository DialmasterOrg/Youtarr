import React from 'react';
import { Typography, Alert } from '../../ui';

export interface VideoListEmptyStateProps {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;
  hasFilters: boolean;
  hasSearch: boolean;
  customEmptyMessage?: React.ReactNode;
  loadingSkeleton?: React.ReactNode;
}

function VideoListEmptyState({
  isLoading,
  isError,
  errorMessage,
  hasFilters,
  hasSearch,
  customEmptyMessage,
  loadingSkeleton,
}: VideoListEmptyStateProps) {
  if (isError) {
    return <Alert severity="error">{errorMessage || 'Failed to load videos. Please try again.'}</Alert>;
  }

  if (isLoading) {
    if (loadingSkeleton) return <>{loadingSkeleton}</>;
    return (
      <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
        <Typography variant="body1" color="text.secondary">
          Loading...
        </Typography>
      </div>
    );
  }

  const message = customEmptyMessage
    ? customEmptyMessage
    : hasFilters || hasSearch
    ? 'No videos found matching your search and filter criteria'
    : 'No videos found';

  return (
    <div
      data-testid="video-list-empty-state"
      style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}
    >
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </div>
  );
}

export default VideoListEmptyState;
