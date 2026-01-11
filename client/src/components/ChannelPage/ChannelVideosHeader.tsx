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
import { getVideoStatus } from '../../utils/videoStatus';
import { ChannelVideo } from '../../types/ChannelVideo';

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
  deleteLoading: boolean;
  paginatedVideos: ChannelVideo[];
  autoDownloadsEnabled: boolean;
  selectedTab: string;
  onViewModeChange: (event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => void;
  onSearchChange: (query: string) => void;
  onHideDownloadedChange: (hide: boolean) => void;
  onAutoDownloadChange: (enabled: boolean) => void;
  onRefreshClick: () => void;
  onDownloadClick: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteClick: () => void;
  onBulkIgnoreClick: () => void;
  onInfoIconClick: (tooltip: string) => void;
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
  deleteLoading,
  paginatedVideos,
  autoDownloadsEnabled,
  selectedTab,
  onViewModeChange,
  onSearchChange,
  onHideDownloadedChange,
  onAutoDownloadChange,
  onRefreshClick,
  onDownloadClick,
  onSelectAll,
  onClearSelection,
  onDeleteClick,
  onBulkIgnoreClick,
  onInfoIconClick,
}: ChannelVideosHeaderProps) {
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
          sx={{ ml: 0.5, p: 0.5 }}
          onClick={handleClick}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      );
    }

    return (
      <Tooltip title={message} arrow placement="top">
        <IconButton size="small" sx={{ ml: 0.5, p: 0.5 }} onClick={(e) => e.stopPropagation()}>
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
            disabled={fetchingAllVideos}
            startIcon={<RefreshIcon />}
          >
            {fetchingAllVideos ? 'Loading...' : 'Load More'}
          </Button>
        </Box>

        {/* Auto-download setting for this tab */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoDownloadsEnabled}
                onChange={(e) => onAutoDownloadChange(e.target.checked)}
                size="small"
              />
            }
            label="Enable Channel Downloads for this tab"
            sx={{
              '& .MuiFormControlLabel-label': {
                fontSize: isMobile ? '0.75rem' : '1rem',
                marginRight: -1,
              }
            }}
          />
          {renderInfoIcon(autoDownloadTooltip)}
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
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={onDownloadClick}
              disabled={checkedBoxes.length === 0}
            >
              Download {checkedBoxes.length > 0 ? `${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'Video' : 'Videos'}` : 'Selected'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={onSelectAll}
              disabled={checkedBoxes.length === 0 && paginatedVideos.filter(v => {
                const status = getVideoStatus(v);
                return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
              }).length === 0}
            >
              Select All This Page
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={onClearSelection}
              disabled={checkedBoxes.length === 0}
            >
              Clear
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              startIcon={<BlockIcon />}
              onClick={onBulkIgnoreClick}
              disabled={checkedBoxes.length === 0}
            >
              Ignore Selected
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={onDeleteClick}
              disabled={selectedForDeletion.length === 0 || deleteLoading}
            >
              Delete {selectedForDeletion.length > 0 ? `${selectedForDeletion.length}` : 'Selected'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Progress bar */}
      {fetchingAllVideos && <LinearProgress />}
    </Box>
  );
}

export default ChannelVideosHeader;
