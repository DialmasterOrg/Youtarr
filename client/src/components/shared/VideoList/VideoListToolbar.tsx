import React from 'react';
import { Badge, Button, TextField } from '../../ui';
import { Search as SearchIcon, ListFilter as FilterListIcon } from '../../../lib/icons';
import VideoListViewToggle from './VideoListViewToggle';
import VideoListSortButton from './VideoListSortButton';
import { VideoListViewMode, SortConfig } from './types';
import { VideoListState } from './hooks/useVideoListState';

export interface VideoListToolbarProps {
  state: VideoListState;
  viewModes: VideoListViewMode[];
  searchPlaceholder?: string;
  filtersButtonActive?: boolean;
  filtersBadgeCount?: number;
  onFiltersClick?: () => void;
  sort?: SortConfig;
  toolbarExtras?: React.ReactNode;
  rightActions?: React.ReactNode;
  isMobile: boolean;
}

function VideoListToolbar({
  state,
  viewModes,
  searchPlaceholder = 'Search videos...',
  filtersButtonActive = false,
  filtersBadgeCount = 0,
  onFiltersClick,
  sort,
  toolbarExtras,
  rightActions,
  isMobile,
}: VideoListToolbarProps) {
  const filtersButton = onFiltersClick ? (
    <Button
      variant={filtersButtonActive ? 'contained' : 'outlined'}
      color={filtersButtonActive ? 'primary' : 'inherit'}
      size="small"
      onClick={onFiltersClick}
      startIcon={
        <Badge
          badgeContent={filtersBadgeCount}
          color="primary"
          invisible={filtersBadgeCount === 0}
        >
          <FilterListIcon size={16} />
        </Badge>
      }
      className={filtersButtonActive ? undefined : 'hover:border-foreground'}
      data-testid="video-list-filters-button"
    >
      Filters
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={state.searchInput}
          onChange={(e) => state.setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon size={16} data-testid="SearchIcon" />,
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <VideoListViewToggle value={state.viewMode} modes={viewModes} onChange={state.setViewMode} />
          {filtersButton}
          {sort && <VideoListSortButton sort={sort} />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {rightActions}
          </div>
        </div>
        {toolbarExtras && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {toolbarExtras}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={state.searchInput}
        onChange={(e) => state.setSearchInput(e.target.value)}
        InputProps={{
          startAdornment: <SearchIcon size={16} data-testid="SearchIcon" />,
        }}
        style={{ flex: '1 1 240px', minWidth: 220 }}
      />
      <VideoListViewToggle value={state.viewMode} modes={viewModes} onChange={state.setViewMode} />
      {filtersButton}
      {sort && <VideoListSortButton sort={sort} />}
      {toolbarExtras}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {rightActions}
      </div>
    </div>
  );
}

export default VideoListToolbar;
