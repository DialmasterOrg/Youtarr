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
  Select,
  Badge,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
} from '../ui';
import { Search as SearchIcon, LayoutGrid as ViewModuleIcon, Rows as TableChartIcon, Download as DownloadIcon, RefreshCw as RefreshIcon, Trash2 as DeleteIcon, Ban as BlockIcon, Info as InfoIcon, X as ClearIcon, ListFilter as FilterListIcon, MoreVert as MoreVertIcon } from '../../lib/icons';
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
  autoDownloadsEnabled?: boolean;
  onAutoDownloadToggle?: (enabled: boolean) => void;
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
  autoDownloadsEnabled,
  onAutoDownloadToggle,
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
  const toggleActionsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setActionsAnchorEl((prev) => (prev ? null : event.currentTarget));
  };

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
        {isMobile ? (
          <>
            {/* Mobile: search bar on its own full-width row */}
            <TextField
              placeholder="Search videos..."
              size="small"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon size={16} data-testid="SearchIcon" />,
              }}
              style={{ width: '100%', marginBottom: 8 }}
            />
            {/* Mobile: rating on next row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FormControl style={{ flex: 1, minWidth: 120 }}>
                <Select
                  size="small"
                  value={maxRating}
                  displayEmpty
                  onChange={(event) => onMaxRatingChange(event.target.value)}
                >
                  {RATING_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search videos..."
              size="small"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon size={16} data-testid="SearchIcon" />,
              }}
              style={{ flex: '1 1 auto', minWidth: 200 }}
            />

            <FormControl style={{ minWidth: 150 }}>
              <Select
                size="small"
                value={maxRating}
                displayEmpty
                onChange={(event) => onMaxRatingChange(event.target.value)}
              >
                {RATING_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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

            {onAutoDownloadToggle && (
              <FormControlLabel
                control={
                  <Switch
                    checked={!!autoDownloadsEnabled}
                    onChange={(e) => onAutoDownloadToggle(e.target.checked)}
                    size="small"
                    aria-label="Enable Channel Downloads"
                  />
                }
                label="Enable Channel Downloads"
              />
            )}

          </div>
        )}

        {/* Action buttons for desktop */}
        {!isMobile && (
          <ActionBar variant={themeMode} style={{ marginTop: 10 }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', flexShrink: 0, alignSelf: 'center' }}>
              <button
                value="table"
                onClick={(e) => onViewModeChange(e, 'table')}
                style={{ padding: '6px 8px', background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? 'white' : 'inherit', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Table View"
                aria-label="Table View"
              >
                <TableChartIcon size={16} />
              </button>
              <button
                value="grid"
                onClick={(e) => onViewModeChange(e, 'grid')}
                style={{ padding: '6px 8px', background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Grid View"
                aria-label="Grid View"
              >
                <ViewModuleIcon size={16} />
              </button>
            </div>

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
              onClick={toggleActionsMenu}
              aria-haspopup="menu"
              aria-expanded={actionsOpen ? 'true' : 'false'}
              aria-controls={actionsOpen ? 'channel-actions-menu' : undefined}
              data-testid="desktop-actions-btn"
              className={intentStyles.base}
            >
              Actions{hasAnySelection && ` (${hasDownloadSelection ? checkedBoxes.length : selectedForDeletion.length})`}
            </Button>

            <Menu
              id="channel-actions-menu"
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
                style={{ color: 'var(--info)' }}
              >
                <ListItemText>Select All (Downloaded)</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onSelectAllNotDownloaded();
                  closeActionsMenu();
                }}
                disabled={selectableDownloadCount === 0}
                style={{ color: 'var(--warning)' }}
              >
                <ListItemText>Select All (Not Downloaded)</ListItemText>
              </MenuItem>

              {hasAnySelection && (
                <>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      onClearSelection();
                      closeActionsMenu();
                    }}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <ClearIcon size={14} style={{ marginRight: 8 }} />
                    <ListItemText>Clear Selection</ListItemText>
                  </MenuItem>
                  <Divider />
                </>
              )}

              {(hasDownloadSelection || hasMixedSelection) && (
                <MenuItem
                  onClick={() => {
                    onDownloadClick();
                    closeActionsMenu();
                  }}
                  disabled={!hasDownloadSelection}
                  style={{ color: 'var(--success)' }}
                >
                  <DownloadIcon size={14} style={{ marginRight: 8, color: 'var(--success)' }} />
                  <ListItemText>Download Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}

              {(hasDeleteSelection || hasMixedSelection) && hasDownloadSelection && <Divider />}

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
                  style={{ color: 'var(--warning)' }}
                >
                  <BlockIcon size={14} style={{ marginRight: 8, color: 'var(--warning)' }} />
                  <ListItemText>Ignore Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </ActionBar>
        )}

        {/* Mobile action bar: view toggle + filters + actions */}
        {isMobile && (
          <ActionBar variant={themeMode} style={{ marginTop: 8 }}>
            {/* Grid/List view toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', flexShrink: 0, alignSelf: 'center' }}>
              <button
                value="grid"
                onClick={(e) => onViewModeChange(e, 'grid')}
                style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'inherit', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Grid View"
                aria-label="Grid View"
              >
                <ViewModuleIcon size={16} />
              </button>
              <button
                value="list"
                onClick={(e) => onViewModeChange(e, 'list')}
                style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="List View"
                aria-label="List View"
              >
                <LayoutList size={16} />
              </button>
            </div>
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
              onClick={toggleActionsMenu}
              aria-haspopup="menu"
              aria-expanded={actionsOpen ? 'true' : 'false'}
              aria-controls={actionsOpen ? 'channel-actions-menu-mobile' : undefined}
              className={intentStyles.base}
            >
              Actions{hasAnySelection && ` (${hasDownloadSelection ? checkedBoxes.length : selectedForDeletion.length})`}
            </Button>
            <Menu
              id="channel-actions-menu-mobile"
              anchorEl={actionsAnchorEl}
              open={actionsOpen}
              onClose={closeActionsMenu}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { onSelectAllDownloaded(); closeActionsMenu(); }} disabled={selectableDeleteCount === 0} style={{ color: 'var(--info)' }}>
                <ListItemText>Select All (Downloaded)</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { onSelectAllNotDownloaded(); closeActionsMenu(); }} disabled={selectableDownloadCount === 0} style={{ color: 'var(--warning)' }}>
                <ListItemText>Select All (Not Downloaded)</ListItemText>
              </MenuItem>
              {hasAnySelection && (
                <>
                  <Divider />
                  <MenuItem onClick={() => { onClearSelection(); closeActionsMenu(); }} style={{ color: 'var(--muted-foreground)' }}>
                    <ClearIcon size={14} style={{ marginRight: 8 }} />
                    <ListItemText>Clear Selection</ListItemText>
                  </MenuItem>
                  <Divider />
                </>
              )}
              {(hasDownloadSelection || hasMixedSelection) && (
                <MenuItem onClick={() => { onDownloadClick(); closeActionsMenu(); }} disabled={!hasDownloadSelection} style={{ color: 'var(--success)' }}>
                  <DownloadIcon size={14} style={{ marginRight: 8, color: 'var(--success)' }} />
                  <ListItemText>Download Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}
              {(hasDeleteSelection || hasMixedSelection) && hasDownloadSelection && <Divider />}
              {(hasDeleteSelection || hasMixedSelection) && (
                <MenuItem onClick={() => { onDeleteClick(); closeActionsMenu(); }} disabled={!hasDeleteSelection || deleteLoading} style={{ color: 'var(--destructive)' }}>
                  <DeleteIcon size={14} style={{ marginRight: 8 }} />
                  <ListItemText>Delete Selected ({selectedForDeletion.length})</ListItemText>
                </MenuItem>
              )}
              {hasDownloadSelection && (
                <MenuItem onClick={() => { onBulkIgnoreClick(); closeActionsMenu(); }} style={{ color: 'var(--warning)' }}>
                  <BlockIcon size={14} style={{ marginRight: 8, color: 'var(--warning)' }} />
                  <ListItemText>Ignore Selected ({checkedBoxes.length})</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </ActionBar>
        )}
      </div>

      {/* Progress bar */}
      {fetchingAllVideos && <LinearProgress />}
    </div>
  );
}

export default ChannelVideosHeader;
