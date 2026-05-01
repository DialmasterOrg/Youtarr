import React, { useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Button,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  List,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Typography,
  ListItemText,
  Grow,
  IconButton,
} from './ui';
import {
  Add as AddIcon,
  HelpOutline as HelpOutlineIcon,
  FilterAlt as FilterAltIcon,
  SortByAlpha as SortByAlphaIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  TableChart as TableChartIcon,
  ViewList as ViewListIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
  Upload as UploadIcon,
} from '../lib/icons';
import { Undo2 as UndoIcon, FolderOpen as FolderSpecialIcon } from 'lucide-react';
import { MOBILE_NAV_SAFE_GAP } from './layout/navLayoutConstants';
import useMediaQuery from '../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import WebSocketContext, { Message } from '../contexts/WebSocketContext';
import { useConfig } from '../hooks/useConfig';
import { Channel } from '../types/Channel';
import { useChannelList } from './Subscriptions/hooks/useChannelList';
import { useChannelMutations } from './Subscriptions/hooks/useChannelMutations';
import ChannelCard from './Subscriptions/components/ChannelCard';
import ChannelListRow, { CHANNEL_LIST_DESKTOP_TEMPLATE } from './Subscriptions/components/ChannelListRow';
import {
  channelMatchesFilter,
  DEFAULT_SUBFOLDER_KEY,
  normalizeSubFolderKey,
  formatSubFolderLabel,
} from '../utils/channelHelpers';
import HelpDialog from './Subscriptions/HelpDialog';
import PendingSaveBanner from './Subscriptions/components/PendingSaveBanner';
import {
  INFINITE_SCROLL_FETCH_SIZE,
  VideoListPaginationBar,
  useListPageSize,
  type PageSize,
} from './shared/VideoList';
import ActiveImportBanner from './Subscriptions/components/ActiveImportBanner';
import SubscriptionsFilter, { SubscriptionsFilterValue } from './Subscriptions/components/SubscriptionsFilter';
import AddPlaylistDialog from './Subscriptions/components/AddPlaylistDialog';
import PlaylistListBlock from './Subscriptions/components/PlaylistListBlock';
import { useActiveImport } from '../hooks/useActiveImport';
import { usePlaylistList } from '../hooks/usePlaylistList';

type ViewMode = 'list' | 'grid';
type SortOrder = 'asc' | 'desc';

interface SubscriptionsProps {
  token: string | null;
}

const Subscriptions: React.FC<SubscriptionsProps> = ({ token }) => {
  const websocketContext = useContext(WebSocketContext);
  if (!websocketContext) {
    throw new Error('WebSocketContext not found');
  }

  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { config } = useConfig(token);
  const useInfiniteScroll = config.channelVideosHotLoad ?? false;
  const globalPreferredResolution = config.preferredResolution || '1080';
  const { activeImport } = useActiveImport(token);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSubFolder, setSelectedSubFolder] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<SubscriptionsFilterValue>('all');
  const [addPlaylistOpen, setAddPlaylistOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);
  const [filterValue, setFilterValue] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [regexPopoverAnchor, setRegexPopoverAnchor] = useState<{ el: HTMLElement; regex: string } | null>(null);
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileActionsAnchorEl, setMobileActionsAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [pageSize, setPageSize] = useListPageSize('youtarr.channelManager.pageSize');
  const effectivePageSize = useInfiniteScroll ? INFINITE_SCROLL_FETCH_SIZE : pageSize;

  const handlePageSizeChange = useCallback((newSize: PageSize) => {
    setPageSize(newSize);
    setPage(1);
  }, [setPageSize]);

  // Senior State Architect: Memoize params to kill identity-based re-fetch loops
  const channelListParams = useMemo(() => ({
    token,
    page,
    pageSize: effectivePageSize,
    searchTerm: filterValue,
    sortOrder,
    subFolder: selectedSubFolder || undefined,
    append: useInfiniteScroll,
  }), [token, page, effectivePageSize, filterValue, sortOrder, selectedSubFolder, useInfiniteScroll]);

  const {
    channels: serverChannels,
    total,
    totalPages,
    loading,
    error,
    refetch,
    subFolders: apiSubFolders,
  } = useChannelList(channelListParams);

  const {
    playlists,
    total: playlistTotal,
    loading: playlistsLoading,
  } = usePlaylistList({ token, page: 1, pageSize: 100 });

  const {
    pendingAdditions,
    deletedChannels,
    isAddingChannel,
    isSaving,
    addChannel,
    queueChannelForDeletion,
    undoChanges,
    saveChanges,
    hasPendingChanges,
  } = useChannelMutations({
    token,
    onRefresh: refetch,
  });

  const deletedSet = useMemo(() => new Set(deletedChannels), [deletedChannels]);

  const matchesSubFolderSelection = useCallback(
    (channel: Channel) => {
      if (!selectedSubFolder) {
        return true;
      }
      return normalizeSubFolderKey(channel.sub_folder) === selectedSubFolder;
    },
    [selectedSubFolder]
  );

  const filteredPendingAdditions = useMemo(
    () =>
      pendingAdditions.filter(
        (channel) =>
          channelMatchesFilter(channel.uploader || '', channel.url, filterValue) &&
          matchesSubFolderSelection(channel)
      ),
    [pendingAdditions, filterValue, matchesSubFolderSelection]
  );

  const visibleServerChannels = useMemo(
    () => serverChannels.filter((channel) => !deletedSet.has(channel.url)),
    [serverChannels, deletedSet]
  );

  const displayChannels = useMemo(
    () => [...filteredPendingAdditions, ...visibleServerChannels],
    [filteredPendingAdditions, visibleServerChannels]
  );

  const pendingAdditionSet = useMemo(
    () => new Set(pendingAdditions.map((channel) => channel.url)),
    [pendingAdditions]
  );
  const hasPendingAdditions = pendingAdditions.length > 0;

  const pageCount = Math.max(totalPages, 1);
  const hasNextPage = page < pageCount;

  const showDesktopListColumns = !isMobile && viewMode === 'list';
  const listColumnLabels = ['Channel', 'Quality / Folder', 'Auto downloads', 'Filters'];
  const folderControlActive = Boolean(selectedSubFolder);
  const availableFolderOptions = useMemo(() => {
    const folderSet = new Set<string>([DEFAULT_SUBFOLDER_KEY]);
    (apiSubFolders || []).forEach((folder) => folderSet.add(folder));
    pendingAdditions.forEach((channel) => folderSet.add(normalizeSubFolderKey(channel.sub_folder)));
    return Array.from(folderSet).sort((a, b) => {
      if (a === DEFAULT_SUBFOLDER_KEY) return -1;
      if (b === DEFAULT_SUBFOLDER_KEY) return 1;
      return a.localeCompare(b);
    });
  }, [apiSubFolders, pendingAdditions]);
  const folderTooltip = selectedSubFolder
    ? `Filtering by ${formatSubFolderLabel(selectedSubFolder)}` :
    'Filter or group by folder';
  let listRowIndex = 0;

  useEffect(() => {
    setPage(1);
  }, [filterValue, sortOrder, viewMode, isMobile, selectedSubFolder]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [useInfiniteScroll]);

  useEffect(() => {
    if (!useInfiniteScroll) {
      return;
    }
    if (!loadMoreRef.current || loading || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 240px 0px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loading, hasNextPage, useInfiniteScroll]);

  const handleMessage = useCallback(() => {
    if (!hasPendingChanges) {
      refetch();
    }
  }, [hasPendingChanges, refetch]);

  const messageFilter = useCallback((message: Message) => {
    return (
      message.destination === 'broadcast' &&
      message.source === 'channel' &&
      message.type === 'channelsUpdated'
    );
  }, []);

  useEffect(() => {
    websocketContext.subscribe(messageFilter, handleMessage);
    return () => {
      websocketContext.unsubscribe(handleMessage);
    };
  }, [websocketContext, messageFilter, handleMessage]);

  const handleAddChannel = async () => {
    if (!newChannelUrl.trim()) return;
    const result = await addChannel(newChannelUrl);
    if (!result.success) {
      setDialogMessage(result.message || 'Failed to add channel');
      setDialogOpen(true);
      return;
    }

    setNewChannelUrl('');
    if (result.message) {
      setDialogMessage(result.message);
      setDialogOpen(true);
    }
  };

  const handleSaveChanges = async () => {
    const result = await saveChanges();
    if (result.message) {
      setDialogMessage(result.message);
      setDialogOpen(true);
    }
  };

  const handleDeleteClick = (channel: Channel) => {
    setChannelToDelete(channel);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (channelToDelete) {
      queueChannelForDeletion(channelToDelete);
    }
    setChannelToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleRegexClick = useCallback((event: React.MouseEvent<HTMLElement>, regex: string) => {
    event.stopPropagation();
    setRegexPopoverAnchor({ el: event.currentTarget, regex });
  }, []);

  const handleRegexClose = () => {
    setRegexPopoverAnchor(null);
  };

  const handleFilterIconClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isMobile) {
      setMobileActionsAnchorEl(null);
      setMobileFilterOpen((prev) => !prev);
      return;
    }

    const anchorEl = event.currentTarget;
    setFilterAnchorEl((prev) => (prev ? null : anchorEl));
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
  };

  const clearFilter = () => {
    setFilterValue('');
    setFilterAnchorEl(null);
    setMobileFilterOpen(false);
  };

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, next: ViewMode | null) => {
    if (next) {
      setViewMode(next);
    }
  };

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleFolderMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFolderMenuAnchor(event.currentTarget);
  };

  const handleFolderMenuClose = () => {
    setFolderMenuAnchor(null);
  };

  const handleSubFolderSelect = (value: string | null) => {
    setSelectedSubFolder(value);
    setFolderMenuAnchor(null);
  };

  const handleMobileActionsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileFilterOpen(false);
    setMobileActionsAnchorEl(event.currentTarget);
  };
  const handleMobileActionsClose = () => setMobileActionsAnchorEl(null);

  const handleNavigate = (channel: Channel) => {
    if (!channel.channel_id) return;
    navigate(`/channel/${channel.channel_id}`);
  };

  const handleOpenSubscriptions = () => {
    navigate('/subscriptions/imports');
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: 0 }}>
        <CardHeader
          title="Channels & Playlists"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tooltip title="Learn how channel downloads work" disableTouchListener>
                <IconButton aria-label="Learn how channel downloads work" onClick={() => setHelpDialogOpen(true)}>
                  <HelpOutlineIcon size={18} />
                </IconButton>
              </Tooltip>
            </div>
          }
          className="px-0 pt-0"
        />
        <Divider />
        <div
          style={{
            padding: '8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <ActiveImportBanner activeImport={activeImport} />

          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} alignItems="center" style={{ marginBottom: isMobile ? 8 : 16 }}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                size="small"
                label="Add a new channel"
                placeholder="Paste a channel URL or @handle"
                value={newChannelUrl}
                onChange={(e) => setNewChannelUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isAddingChannel && newChannelUrl.trim()) {
                      handleAddChannel();
                    }
                  }
                }}
                disabled={isAddingChannel}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Grid container spacing={1.5}>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={isAddingChannel ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    onClick={handleAddChannel}
                    disabled={isAddingChannel || !newChannelUrl.trim()}
                  >
                    {isAddingChannel ? 'Adding…' : 'Channel'}
                  </Button>
                </Grid>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setAddPlaylistOpen(true)}
                  >
                    Playlist
                  </Button>
                </Grid>
                <Grid item xs={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={handleOpenSubscriptions}
                  >
                    Import
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <SubscriptionsFilter
            value={typeFilter}
            onChange={setTypeFilter}
            counts={{ channels: total, playlists: playlistTotal }}
          />

          {/* ── Mobile toolbar: view toggle + filter + actions ── */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {/* Grid / List view toggle */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-ui)', overflow: 'hidden', flexShrink: 0 }}>
                <Button
                  variant={viewMode === 'list' ? 'contained' : 'ghost'}
                  size="sm"
                  aria-label="List view"
                  style={{ borderRadius: 0, borderRight: '1px solid var(--border)', padding: '5px 10px' }}
                  onClick={() => handleViewChange(null as any, 'list')}
                >
                  <ViewListIcon size={18} />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'contained' : 'ghost'}
                  size="sm"
                  aria-label="Grid view"
                  style={{ borderRadius: 0, padding: '5px 10px' }}
                  onClick={() => handleViewChange(null as any, 'grid')}
                >
                  <TableChartIcon size={18} />
                </Button>
              </div>

              {/* Filter button */}
              <Button
                variant={filterValue ? 'contained' : 'outlined'}
                size="sm"
                startIcon={<FilterAltIcon size={16} />}
                onClick={handleFilterIconClick}
                className="intent-base"
              >
                Filters{filterValue ? ' •' : ''}
              </Button>

              {/* Actions button */}
              <Button
                variant="outlined"
                size="sm"
                endIcon={<MoreVertIcon size={16} />}
                onClick={handleMobileActionsOpen}
                className="intent-base"
                style={{ marginLeft: 'auto' }}
              >
                Actions
              </Button>

              {/* Mobile actions menu — opens upward above nav bar */}
              <Menu
                anchorEl={mobileActionsAnchorEl}
                open={Boolean(mobileActionsAnchorEl)}
                onClose={handleMobileActionsClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <MenuItem onClick={() => { handleSortToggle(); handleMobileActionsClose(); }}>
                  <ListItemText
                    primary={sortOrder === 'asc' ? 'Sort Z → A' : 'Sort A → Z'}
                    secondary={sortOrder === 'asc' ? 'Currently A → Z' : 'Currently Z → A'}
                  />
                </MenuItem>
                {availableFolderOptions.length > 1 && [
                  <Divider key="folder-divider" style={{ margin: '4px 0' }} />,
                  <MenuItem key="folder-all" selected={!selectedSubFolder} onClick={() => { handleSubFolderSelect(null); handleMobileActionsClose(); }}>
                    <ListItemText primary="All folders" secondary="Show every channel" />
                  </MenuItem>,
                  ...availableFolderOptions.map((folder) => (
                    <MenuItem
                      key={folder}
                      selected={selectedSubFolder === folder}
                      onClick={() => { handleSubFolderSelect(folder); handleMobileActionsClose(); }}
                    >
                      <ListItemText primary={formatSubFolderLabel(folder)} />
                    </MenuItem>
                  )),
                ]}
              </Menu>
            </div>
          )}

          {/* ── Desktop toolbar ── */}
          {!isMobile && (
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => handleViewChange(null as any, 'list')}
                  aria-label="List view"
                  style={{ background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'var(--primary-foreground)' : 'inherit', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }}
                >
                  <ViewListIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewChange(null as any, 'grid')}
                  aria-label="Grid view"
                  style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? 'var(--primary-foreground)' : 'inherit', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }}
                >
                  <TableChartIcon size={18} />
                </button>
              </div>

              <Tooltip title={`Sort alphabetically (${sortOrder === 'asc' ? 'A → Z' : 'Z → A'})`}>
                <button aria-label={`Sort alphabetically (${sortOrder === 'asc' ? 'A → Z' : 'Z → A'})`} className="icon-btn" type="button" onClick={handleSortToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SortByAlphaIcon size={18} />
                    {sortOrder === 'asc' ?
                      <ArrowUpwardIcon size={14} style={{ transform: 'scale(0.75,1)', marginLeft: -8 }} /> :
                      <ArrowDownwardIcon size={14} style={{ transform: 'scale(0.75,1)', marginLeft: -8 }} />}
                  </div>
                </button>
              </Tooltip>

              <Tooltip title="Filter by channel name">
                <button
                  aria-label="Filter by channel name"
                  className={`icon-btn${filterValue ? ' icon-btn-primary' : ''}`}
                  type="button"
                  onClick={handleFilterIconClick}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: filterValue ? 'var(--primary)' : 'inherit', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}
                >
                  <FilterAltIcon size={18} />
                </button>
              </Tooltip>

              <Tooltip title={folderTooltip}>
                <button
                  aria-label={folderTooltip}
                  className={`icon-btn${folderControlActive ? ' icon-btn-primary' : ''}`}
                  type="button"
                  onClick={handleFolderMenuOpen}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: folderControlActive ? 'var(--primary)' : 'inherit', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}
                >
                  <FolderSpecialIcon size={18} />
                </button>
              </Tooltip>
            </div>

            <Typography variant="body2" color="text.secondary">
              {(folderControlActive && filterValue) ? `Total matching channels: ${total}` : `Total channels: ${total}`}
            </Typography>
          </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {typeFilter === 'playlists' ? (
              <PlaylistListBlock playlists={playlists} loading={playlistsLoading} />
            ) : (
              <>
                <VideoListPaginationBar
                  placement="top"
                  hasContent={displayChannels.length > 0}
                  useInfiniteScroll={useInfiniteScroll}
                  page={page}
                  totalPages={pageCount}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  isMobile={isMobile}
                />
                {loading && displayChannels.length > 0 && !useInfiniteScroll && (
                  <LinearProgress height={2} style={{ marginBottom: 4 }} />
                )}
                {loading && displayChannels.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 24, paddingBottom: 24 }}>
                <CircularProgress />
              </div>
            ) : displayChannels.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 24 }}>
                <Typography color="text.secondary">No channels found. Try adjusting your filter.</Typography>
              </div>
            ) : (
              <div style={{ paddingBottom: useInfiniteScroll ? 8 : 0 }}>
                {viewMode === 'list' ? (
                  <List disablePadding>
                    {showDesktopListColumns && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: CHANNEL_LIST_DESKTOP_TEMPLATE,
                          columnGap: 16,
                          padding: '4px 16px',
                          color: 'var(--muted-foreground)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {listColumnLabels.map((label) => (
                          <Typography key={label} variant="caption" style={{ fontWeight: 600 }}>
                            {label}
                          </Typography>
                        ))}
                        <div />
                      </div>
                    )}
                    {displayChannels.map((channel) => {
                      const rowIndex = listRowIndex;
                      listRowIndex += 1;
                      return (
                        <ChannelListRow
                          key={channel.channel_id || channel.url}
                          channel={channel}
                          isMobile={isMobile}
                          globalPreferredResolution={globalPreferredResolution}
                          onNavigate={() => handleNavigate(channel)}
                          onDelete={() => handleDeleteClick(channel)}
                          onRegexClick={handleRegexClick}
                          isPendingAddition={pendingAdditionSet.has(channel.url)}
                          rowIndex={rowIndex}
                        />
                      );
                    })}
                  </List>
                ) : (
                  <Grid container spacing={2}>
                      {displayChannels.map((channel) => (
                        <Grid item xs={12} sm={6} md={4} key={channel.channel_id || channel.url}>
                          <ChannelCard
                            channel={channel}
                            isMobile={isMobile}
                            globalPreferredResolution={globalPreferredResolution}
                            onNavigate={() => handleNavigate(channel)}
                            onDelete={() => handleDeleteClick(channel)}
                            onRegexClick={handleRegexClick}
                            isPendingAddition={pendingAdditionSet.has(channel.url)}
                          />
                        </Grid>
                      ))}
                    </Grid>
                )}
              </div>
            )}

                {useInfiniteScroll ? (
                  <>
                    <div
                      ref={loadMoreRef}
                      style={{
                        height: 24,
                        width: '100%',
                      }}
                    />
                    {loading && hasNextPage && (
                      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
                        <CircularProgress size={20} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {loading && displayChannels.length > 0 && (
                      <LinearProgress height={2} style={{ marginTop: 4 }} />
                    )}
                    <VideoListPaginationBar
                      placement="bottom"
                      hasContent={displayChannels.length > 0}
                      useInfiniteScroll={useInfiniteScroll}
                      page={page}
                      totalPages={pageCount}
                      onPageChange={setPage}
                      pageSize={pageSize}
                      onPageSizeChange={handlePageSizeChange}
                      isMobile={isMobile}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Menu anchorEl={folderMenuAnchor} open={Boolean(folderMenuAnchor)} onClose={handleFolderMenuClose}>
        <MenuItem selected={!selectedSubFolder} onClick={() => handleSubFolderSelect(null)}>
          <ListItemText primary="All folders" secondary="Show every channel" />
        </MenuItem>
        <Divider style={{ margin: '4px 0' }} />
        {availableFolderOptions.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="No folders available" />
          </MenuItem>
        ) : (
          availableFolderOptions.map((folder) => (
            <MenuItem
              key={folder}
              selected={selectedSubFolder === folder}
              onClick={() => handleSubFolderSelect(folder)}
            >
              <ListItemText primary={formatSubFolderLabel(folder)} />
            </MenuItem>
          ))
        )}
      </Menu>

      <Popover
        open={!isMobile && Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <div style={{ padding: 16, minWidth: 240 }}>
          <TextField
            label="Filter channels"
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            fullWidth
            autoFocus
          />
          {filterValue && (
            <Button size="small" onClick={clearFilter} style={{ marginTop: 8 }}>
              Clear filter
            </Button>
          )}
        </div>
      </Popover>

      {isMobile && mobileFilterOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileFilterOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1299,
              backgroundColor: 'var(--overlay-backdrop-background)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="channel-filter-sheet-title"
            style={{
              position: 'fixed',
              left: 8,
              right: 8,
              bottom: 'calc(var(--mobile-nav-total-offset, 0px) + 8px)',
              zIndex: 1300,
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-ui)',
              boxShadow: 'var(--shadow-hard)',
              padding: 12,
            }}
          >
            <Typography id="channel-filter-sheet-title" variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
              Filter channels
            </Typography>
            <TextField
              label="Filter channels"
              value={filterValue}
              onChange={(e) => handleFilterChange(e.target.value)}
              fullWidth
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
              <Button size="small" variant="outlined" onClick={clearFilter} disabled={!filterValue}>
                Clear filter
              </Button>
              <Button size="small" onClick={() => setMobileFilterOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setDialogMessage(null); }}>
        <DialogContent>
          <Typography>{dialogMessage || ''}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setDialogMessage(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <PendingSaveBanner show={hasPendingAdditions} />

      <Grow in={hasPendingChanges}>
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? `calc(var(--mobile-nav-total-offset, 0px) + ${MOBILE_NAV_SAFE_GAP}px)` : 72,
            right: isMobile ? 16 : 32,
            zIndex: 1401,
            pointerEvents: hasPendingChanges ? 'auto' : 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={undoChanges}
              disabled={isSaving}
              aria-label="Undo changes"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '6px 16px' : '8px 20px', borderRadius: 28, background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, color: 'var(--foreground)', boxShadow: 'var(--shadow-hard, 0 4px 12px rgba(0,0,0,0.2))' }}
            >
              <UndoIcon size={18} />
              Undo
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              aria-label="Save changes"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '6px 16px' : '8px 20px', borderRadius: 28, background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--primary-foreground)', boxShadow: 'var(--shadow-hard, 0 4px 12px rgba(0,0,0,0.2))' }}
            >
              {isSaving ? <CircularProgress size={18} color="inherit" style={{ marginRight: 4 }} /> : <SaveIcon size={18} style={{ marginRight: 4 }} />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Grow>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Remove channel?</DialogTitle>
        <DialogContent>
          <Typography>
            Removing this channel will stop automatic downloads but won't delete existing videos or history.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <HelpDialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} isMobile={isMobile} />

      <AddPlaylistDialog
        open={addPlaylistOpen}
        token={token}
        onClose={() => setAddPlaylistOpen(false)}
      />

      <Popover
        open={Boolean(regexPopoverAnchor)}
        anchorEl={regexPopoverAnchor?.el}
        onClose={handleRegexClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <div style={{ padding: 16, maxWidth: 400 }}>
          <Typography variant="subtitle2" style={{ marginBottom: 0 }}>
            Title Filter Regex
          </Typography>
          <Typography variant="caption" style={{ marginTop: 0, fontStyle: 'italic' }}>
            Filters videos downloaded for channel downloads.
          </Typography>
          <Typography
            variant="body2"
            style={{
              fontFamily: 'monospace',
              backgroundColor: 'var(--muted)',
              padding: 8,
              borderRadius: 4,
              wordBreak: 'break-all',
            }}
          >
            {regexPopoverAnchor?.regex}
          </Typography>
        </div>
      </Popover>
    </>
  );
};

export default Subscriptions;
