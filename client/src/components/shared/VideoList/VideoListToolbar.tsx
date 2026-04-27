import React, { useState } from 'react';
import {
  Badge,
  Button,
  Menu,
  MenuItem,
  TextField,
  ListItemIcon,
  ListItemText,
} from '../../ui';
import {
  Search as SearchIcon,
  ListFilter as FilterListIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Check as CheckIcon,
} from '../../../lib/icons';
import VideoListViewToggle from './VideoListViewToggle';
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

function SortButton({ sort }: { sort: SortConfig }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const active = sort.options.find((o) => o.key === sort.activeKey);
  const label = active ? active.label : 'Sort';
  const DirectionIcon = sort.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className="text-foreground border-border hover:bg-muted hover:border-foreground"
        endIcon={<DirectionIcon size={14} />}
        data-testid="video-list-sort-button"
      >
        Sort: {label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {sort.options.map((option) => {
          const isActive = option.key === sort.activeKey;
          return (
            <MenuItem
              key={option.key}
              onClick={() => {
                if (isActive) {
                  sort.onChange(option.key, sort.direction === 'asc' ? 'desc' : 'asc');
                } else {
                  sort.onChange(option.key, 'desc');
                }
                setAnchorEl(null);
              }}
            >
              <ListItemText>{option.label}</ListItemText>
              {isActive && (
                <ListItemIcon style={{ marginLeft: 8, minWidth: 'auto' }}>
                  {sort.direction === 'asc' ? (
                    <ArrowUpIcon size={14} />
                  ) : (
                    <ArrowDownIcon size={14} />
                  )}
                </ListItemIcon>
              )}
              {!isActive && (
                <ListItemIcon style={{ marginLeft: 8, minWidth: 'auto', opacity: 0 }}>
                  <CheckIcon size={14} />
                </ListItemIcon>
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
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
      className={
        filtersButtonActive
          ? undefined
          : 'text-foreground border-border hover:bg-muted hover:border-foreground'
      }
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
          {sort && <SortButton sort={sort} />}
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
      {sort && <SortButton sort={sort} />}
      {toolbarExtras}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {rightActions}
      </div>
    </div>
  );
}

export default VideoListToolbar;
