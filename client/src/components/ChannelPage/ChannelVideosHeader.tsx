import React from 'react';
import {
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Tooltip,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  Badge,
  Menu,
  MenuItem,
  ListItemText,
} from '../ui';
import { Search as SearchIcon, LayoutGrid as ViewModuleIcon, LayoutGrid as TableChartIcon, List as ViewListIcon, Download as DownloadIcon, RefreshCw as RefreshIcon, Trash2 as DeleteIcon, Ban as BlockIcon, Info as InfoIcon, X as ClearIcon, ListFilter as FilterListIcon, MoreVertical as MoreVertIcon } from '../../lib/icons';
import { LayoutList } from 'lucide-react';
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
  onSelectAllDownloaded: () => void;
  onSelectAllNotDownloaded: () => void;
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
  onSelectAllDownloaded,
  onSelectAllNotDownloaded,
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
  const [actionsAnchorEl, setActionsAnchorEl] = React.useState<null | HTMLElement>(null);
  const actionsOpen = Boolean(actionsAnchorEl);
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
        <button
          style={{ marginLeft: 4, padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--foreground)' }}
          onClick={handleClick}
        >
          <InfoIcon size={16} data-testid="InfoIcon" />
        </button>
      );
    }

    return (
      <Tooltip title={message} arrow placement="top">
        <button style={{ marginLeft: 4, padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--foreground)' }} onClick={(e) => e.stopPropagation()}>
          <InfoIcon size={16} data-testid="InfoIcon" />
        </button>
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
  const hasDownloadSelection = checkedBoxes.length > 0;
  const hasDeleteSelection = selectedForDeletion.length > 0;
  const hasAnySelection = hasDownloadSelection || hasDeleteSelection;
  const hasMixedSelection = hasDownloadSelection && hasDeleteSelection;

  const closeActionsMenu = () => setActionsAnchorEl(null);

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} data-testid="channel-videos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {totalCount > 0 && (
              <Chip label={totalCount + ' ' + (totalCount === 1 ? 'item' : 'items')} size="small" color="primary" />
            )}
            {oldestVideoDate && selectedTab !== 'shorts' && !isMobile && (
              <Typography variant="caption" color="text.secondary">
                Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
              </Typography>
            )}
            {renderInfoIcon(dateTooltipText)}
          </div>
          <Button
            onClick={onRefreshClick}
            variant="outlined"
            size="small"
            color="inherit"
            disabled={fetchingAllVideos}
            startIcon={<RefreshIcon size={16} />}
            className={intentStyles.base}
          >
            {fetchingAllVideos ? 'Loading...' : 'Load More'}
          </Button>
        </div>

        {/* Search and filters */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search videos..."
            size="small"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon size={16} data-testid="SearchIcon" />,
            }}
            style={{ flexGrow: 1, minWidth: 200, width: isMobile ? '50%' : 'auto' }}
          />

          <FormControl style={{ minWidth: 200 }}>
            <InputLabel>Max Rating</InputLabel>
            <Select
              size="small"
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
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {!isMobile && (
              <button
                value="table"
                onClick={(e) => onViewModeChange(e, 'table')}
                className={viewMode === 'table' ? 'Mui-selected' : ''}
                style={{ padding: '6px 8px', background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? 'white' : 'inherit', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Table View"
                aria-label="Table View"
              >
                <TableChartIcon size={16} />
              </button>
            )}
            <button
              value="grid"
              onClick={(e) => onViewModeChange(e, 'grid')}
              className={viewMode === 'grid' ? 'Mui-selected' : ''}
              style={{ padding: '6px 8px', background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'inherit', border: 'none', borderRight: isMobile ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Grid View"
              aria-label="Grid View"
            >
              <ViewModuleIcon size={16} />
            </button>
            {isMobile && (
              <button
                value="list"
                onClick={(e) => onViewModeChange(e, 'list')}
                className={viewMode === 'list' ? 'Mui-selected' : ''}
                style={{ padding: '6px 8px', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="List View"
                aria-label="List View"
              >
                <LayoutList size={16} />
              </button>
            )}
          </div>

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

          <FormControlLabel
            control={<Switch checked={autoDownloadsEnabled} onChange={() => {}} size="small" />}
            label={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                Enable Channel Downloads for this tab
                {renderInfoIcon(autoDownloadTooltip)}
              </div>
            }
          />
        </div>

        {/* Action buttons for desktop */}
        {!isMobile && (
          <ActionBar variant={themeMode} style={{ marginTop: 10 }}>
            {onFiltersExpandedChange && (
              <Button
                variant={filtersExpanded ? 'contained' : 'outlined'}
                size="small"
                startIcon={
                  <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
                    <FilterListIcon size={16} />
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
              endIcon={<MoreVertIcon size={16} />}
              onClick={(event) => setActionsAnchorEl(event.currentTarget)}
              className={intentStyles.base}
            >
              Actions
            </Button>

            <Menu
              anchorEl={actionsAnchorEl}
              open={actionsOpen}
              onClose={closeActionsMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  onSelectAllDownloaded();
                  closeActionsMenu();
                }}
                disabled={selectableDeleteCount === 0}
              >
                <ListItemText>Select All (Downloaded)</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onSelectAllNotDownloaded();
                  closeActionsMenu();
                }}
                disabled={selectableDownloadCount === 0}
              >
                <ListItemText>Select All (Not Downloaded)</ListItemText>
              </MenuItem>

              {hasAnySelection && (
                <>
                  <MenuItem
                    onClick={() => {
                      onClearSelection();
                      closeActionsMenu();
                    }}
                  >
                    <ClearIcon size={14} style={{ marginRight: 8 }} />
                    <ListItemText>Clear Selection</ListItemText>
                  </MenuItem>
                </>
              )}

              {(hasDownloadSelection || hasMixedSelection) && (
                <MenuItem
                  onClick={() => {
                    onDownloadClick();
                    closeActionsMenu();
                  }}
                  disabled={!hasDownloadSelection}
                >
                  <DownloadIcon size={14} style={{ marginRight: 8 }} />
                  <ListItemText>Download Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}

              {(hasDeleteSelection || hasMixedSelection) && (
                <MenuItem
                  onClick={() => {
                    onDeleteClick();
                    closeActionsMenu();
                  }}
                  disabled={!hasDeleteSelection || deleteLoading}
                  style={{ color: 'var(--destructive)' }}
                >
                  <DeleteIcon size={14} style={{ marginRight: 8 }} />
                  <ListItemText>Delete Selected ({selectedForDeletion.length})</ListItemText>
                </MenuItem>
              )}

              {hasDownloadSelection && (
                <MenuItem
                  onClick={() => {
                    onBulkIgnoreClick();
                    closeActionsMenu();
                  }}
                >
                  <BlockIcon size={14} style={{ marginRight: 8 }} />
                  <ListItemText>Ignore Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </ActionBar>
        )}

        {/* Action buttons for mobile intentionally hidden */}
      </div>

      {/* Progress bar */}
      {fetchingAllVideos && <LinearProgress />}
    </div>
  );
}

export default ChannelVideosHeader;
