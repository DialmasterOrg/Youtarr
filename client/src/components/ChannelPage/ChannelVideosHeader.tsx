import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Tooltip,
  Chip,
  LinearProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import InfoIcon from '@mui/icons-material/Info';
import ChecklistIcon from '@mui/icons-material/Checklist';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getVideoStatus } from '../../utils/videoStatus';
import { ChannelVideo } from '../../types/ChannelVideo';
import { RATING_OPTIONS } from '../../utils/ratings';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { ActionBar } from '../shared/ActionBar';
import { intentStyles } from '../../utils/intentStyles';

type ViewMode = 'table' | 'grid' | 'list';

interface ChannelVideosHeaderProps {
  isMobile: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  hideDownloaded: boolean;
  totalCount: number;
  oldestVideoDate: string | null;
  fetchingAllVideos: boolean;
  checkedBoxes: string[];
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  deleteLoading: boolean;
  paginatedVideos: ChannelVideo[];
  autoDownloadsEnabled: boolean;
  selectedTab: string;
  maxRating: string;
  onViewModeChange: (event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => void;
  onSearchChange: (query: string) => void;
  onHideDownloadedChange: (hide: boolean) => void;
  onRefreshClick: () => void;
  onDownloadClick: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteClick: () => void;
  onBulkIgnoreClick: () => void;
  onInfoIconClick: (tooltip: string) => void;
  onMaxRatingChange: (value: string) => void;
  // Filter-related props (desktop only)
  activeFilterCount?: number;
  filtersExpanded?: boolean;
  onFiltersExpandedChange?: (expanded: boolean) => void;
}

function ChannelVideosHeader({
  isMobile,
  viewMode,
  searchQuery,
  hideDownloaded,
  totalCount,
  oldestVideoDate,
  fetchingAllVideos,
  checkedBoxes,
  selectedForDeletion,
  selectionMode,
  deleteLoading,
  paginatedVideos,
  autoDownloadsEnabled,
  selectedTab,
  maxRating,
  onViewModeChange,
  onSearchChange,
  onHideDownloadedChange,
  onRefreshClick,
  onDownloadClick,
  onSelectAll,
  onClearSelection,
  onDeleteClick,
  onBulkIgnoreClick,
  onInfoIconClick,
  onMaxRatingChange,
  activeFilterCount = 0,
  filtersExpanded = false,
  onFiltersExpandedChange,
}: ChannelVideosHeaderProps) {
  const { themeMode } = useThemeEngine();
  const renderInfoIcon = (message: string) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobile) {
        onInfoIconClick(message);
      }
    };

    if (isMobile) {
      return (
        <IconButton
          size="small"
          sx={{ ml: 0.5, p: 0.5, color: 'var(--foreground)' }}
          onClick={handleClick}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      );
    }

    return (
      <Tooltip title={message} arrow placement="top">
        <IconButton size="small" sx={{ ml: 0.5, p: 0.5, color: 'var(--foreground)' }} onClick={(e) => e.stopPropagation()}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  const autoDownloadTooltip = "Enable this if you want videos from this tab to automatically download when scheduled channel downloads occur, or when you trigger channel downloads from the Manage Downloads page";

  const dateTooltipBase = "Publish dates come from yt-dlp and may be approximate when YouTube only provides relative times. Videos remain sorted to match YouTube.";
  const dateTooltipText = selectedTab === 'shorts'
    ? "Shorts do not expose publish dates via yt-dlp, so dates are hidden. " + dateTooltipBase
    : dateTooltipBase;

  const selectableDownloadCount = paginatedVideos.filter((video) => {
    const status = getVideoStatus(video);
    return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
  }).length;
  const selectableDeleteCount = paginatedVideos.filter((video) => video.added && !video.removed).length;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} data-testid="channel-videos-header">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {totalCount > 0 && (
              <Chip label={totalCount + ' ' + (totalCount === 1 ? 'item' : 'items')} size="small" color="primary" />
            )}
            {oldestVideoDate && selectedTab !== 'shorts' && !isMobile && (
              <Typography variant="caption" color="text.secondary">
                Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
              </Typography>
            )}
            {renderInfoIcon(dateTooltipText)}
          </Box>

          <Button
            onClick={onRefreshClick}
            variant="outlined"
            size="small"
            color="inherit"
            disabled={fetchingAllVideos}
            startIcon={<RefreshIcon />}
            className={intentStyles.base}
          >
            {fetchingAllVideos ? 'Loading...' : 'Load More'}
          </Button>
        </Box>

        {/* Search and filters */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search videos..."
            size="small"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 200, width: isMobile ? '50%' : 'auto' }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Max Rating</InputLabel>
            <Select
              value={maxRating}
              label="Max Rating"
              onChange={(event) => onMaxRatingChange(event.target.value)}
            >
              {RATING_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* View mode toggle - mobile shows list/grid, desktop shows table/grid */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={onViewModeChange}
            size="small"
          >
            {!isMobile && (
              <ToggleButton value="table">
                <Tooltip title="Table View">
                  <TableChartIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            )}
            <ToggleButton value="grid">
              <Tooltip title="Grid View">
                <ViewModuleIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            {isMobile && (
              <ToggleButton value="list">
                <Tooltip title="List View">
                  <ViewListIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            )}
          </ToggleButtonGroup>

          {!isMobile && (
            <FormControlLabel
            control={
                <Switch
                checked={hideDownloaded}
                onChange={(e) => onHideDownloadedChange(e.target.checked)}
                size="small"
                />
            }
            label="Hide Downloaded"
            />
          )}
        </Box>

        {/* Action buttons for desktop */}
        {!isMobile && (
          <ActionBar variant={themeMode} sx={{ mt: 2 }}>
            {onFiltersExpandedChange && (
              <Button
                variant={filtersExpanded ? 'contained' : 'outlined'}
                size="small"
                startIcon={
                  <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
                    <FilterListIcon />
                  </Badge>
                }
                onClick={() => onFiltersExpandedChange(!filtersExpanded)}
                className={intentStyles.base}
              >
                Filters
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={onDownloadClick}
              disabled={checkedBoxes.length === 0}
              className={intentStyles.success}
            >
              Download {checkedBoxes.length > 0 ? `${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'Video' : 'Videos'}` : 'Selected'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              onClick={onSelectAll}
              disabled={
                selectionMode === 'delete'
                  ? selectableDeleteCount === 0
                  : checkedBoxes.length === 0 && selectableDownloadCount === 0
              }
              startIcon={<ChecklistIcon />}
              className={intentStyles.base}
            >
              Select All This Page
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={onClearSelection}
              disabled={checkedBoxes.length === 0}
              startIcon={<ClearIcon />}
            >
              Clear
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              startIcon={<BlockIcon />}
              onClick={onBulkIgnoreClick}
              disabled={checkedBoxes.length === 0}
              className={intentStyles.warning}
            >
              Ignore Selected
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              startIcon={<DeleteIcon />}
              onClick={onDeleteClick}
              disabled={selectedForDeletion.length === 0 || deleteLoading}
              className={intentStyles.danger}
            >
              Delete {selectedForDeletion.length > 0 ? `${selectedForDeletion.length}` : 'Selected'}
            </Button>
          </ActionBar>
        )}

        {/* Action buttons for mobile */}
        {isMobile && (
          <ActionBar variant={themeMode} compact sx={{ mt: 2 }}>
            <IconButton
              size="small"
              onClick={onSelectAll}
              disabled={
                selectionMode === 'delete'
                  ? selectableDeleteCount === 0
                  : checkedBoxes.length === 0 && selectableDownloadCount === 0
              }
              className={intentStyles.base}
              aria-label="Select all this page"
            >
              <ChecklistIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={onClearSelection}
              disabled={checkedBoxes.length === 0}
              className={intentStyles.base}
              aria-label="Clear selection"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </ActionBar>
        )}
      </Box>

      {/* Progress bar */}
      {fetchingAllVideos && <LinearProgress />}
    </Box>
  );
}

export default ChannelVideosHeader;
