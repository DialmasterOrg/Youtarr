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
  Pagination,
  LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
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
  page: number;
  totalPages: number;
  onViewModeChange: (event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => void;
  onSearchChange: (query: string) => void;
  onHideDownloadedChange: (hide: boolean) => void;
  onRefreshClick: () => void;
  onDownloadClick: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteClick: () => void;
  onPageChange: (event: React.ChangeEvent<unknown>, value: number) => void;
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
  page,
  totalPages,
  onViewModeChange,
  onSearchChange,
  onHideDownloadedChange,
  onRefreshClick,
  onDownloadClick,
  onSelectAll,
  onClearSelection,
  onDeleteClick,
  onPageChange,
}: ChannelVideosHeaderProps) {
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">Channel Videos</Typography>
            {totalCount > 0 && (
              <Chip label={totalCount} size="small" color="primary" />
            )}
            {oldestVideoDate && !isMobile && (
              <Typography variant="caption" color="text.secondary">
                Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
              </Typography>
            )}
          </Box>

          <Button
            onClick={onRefreshClick}
            variant="outlined"
            size="small"
            disabled={fetchingAllVideos}
            startIcon={<RefreshIcon />}
          >
            {fetchingAllVideos ? 'Refreshing...' : 'Refresh'}
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
            sx={{ flexGrow: 1, minWidth: 200 }}
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
                return status === 'never_downloaded' || status === 'missing';
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

        {/* Pagination - Always visible at top */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={onPageChange}
              color="primary"
              size={isMobile ? 'small' : 'medium'}
              siblingCount={isMobile ? 0 : 1}
            />
          </Box>
        )}
      </Box>

      {/* Progress bar */}
      {fetchingAllVideos && <LinearProgress />}
    </Box>
  );
}

export default ChannelVideosHeader;
