import React, { useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  Grid,
  IconButton,
  List,
  LinearProgress,
  Menu,
  MenuItem,
  Pagination,
  Popover,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Zoom,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewListIcon from '@mui/icons-material/ViewList';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import WebSocketContext, { Message } from '../contexts/WebSocketContext';
import { useConfig } from '../hooks/useConfig';
import { Channel } from '../types/Channel';
import { useChannelList } from './ChannelManager/hooks/useChannelList';
import { useChannelMutations } from './ChannelManager/hooks/useChannelMutations';
import ChannelCard from './ChannelManager/components/ChannelCard';
import ChannelListRow from './ChannelManager/components/ChannelListRow';
import {
  channelMatchesFilter,
  DEFAULT_SUBFOLDER_KEY,
  normalizeSubFolderKey,
  formatSubFolderLabel,
} from '../utils/channelHelpers';
import HelpDialog from './ChannelManager/HelpDialog';
import PendingSaveBanner from './ChannelManager/components/PendingSaveBanner';

type ViewMode = 'list' | 'grid';
type SortOrder = 'asc' | 'desc';

interface ChannelManagerProps {
  token: string | null;
}

const ChannelManager: React.FC<ChannelManagerProps> = ({ token }) => {
  const websocketContext = useContext(WebSocketContext);
  if (!websocketContext) {
    throw new Error('WebSocketContext not found');
  }

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { config } = useConfig(token);
  const globalPreferredResolution = config.preferredResolution || '1080';

  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSubFolder, setSelectedSubFolder] = useState<string | null>(null);
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
  const [showStalledLoading, setShowStalledLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const pageSize = useMemo(() => {
    if (viewMode === 'list') {
      return 25;
    }
    if (isMobile) {
      return 16;
    }
    return 27;
  }, [isMobile, viewMode]);

  const useInfiniteScroll = viewMode === 'list';

  const {
    channels: serverChannels,
    total,
    totalPages,
    loading,
    error,
    refetch,
    subFolders: apiSubFolders,
  } = useChannelList({
    token,
    page,
    pageSize,
    searchTerm: filterValue,
    sortOrder,
    subFolder: selectedSubFolder || undefined,
    append: useInfiniteScroll,
  });

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

  const showSkeletons = loading && displayChannels.length === 0;
  const showInlineLoader = loading && displayChannels.length > 0;

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
    if (!useInfiniteScroll || !loadMoreRef.current || !scrollContainerRef.current) {
      return;
    }
    if (loading || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loading && hasNextPage) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '25% 0px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [useInfiniteScroll, loading, hasNextPage]);

  useEffect(() => {
    if (!loading) {
      setShowStalledLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowStalledLoading(true);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [loading, page, filterValue, sortOrder, selectedSubFolder]);

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
      setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
  };

  const clearFilter = () => {
    setFilterValue('');
    setFilterAnchorEl(null);
  };

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, next: ViewMode | null) => {
    if (next && (!isMobile || next === 'list')) {
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

  const handleNavigate = (channel: Channel) => {
    if (!channel.channel_id) return;
    navigate(`/channel/${channel.channel_id}`);
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Your Channels
          </Typography>
          <Tooltip title="Learn how channel downloads work">
            <IconButton onClick={() => setHelpDialogOpen(true)}>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            overflow: 'hidden',
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} alignItems="center" sx={{ mb: isMobile ? 1 : 2 }}>
            <Grid item xs={12} md={9}>
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
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={isAddingChannel ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                onClick={handleAddChannel}
                disabled={isAddingChannel || !newChannelUrl.trim()}
              >
                {isAddingChannel ? 'Adding…' : 'Add Channel'}
              </Button>
            </Grid>
          </Grid>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!isMobile && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={viewMode}
                  onChange={handleViewChange}
                  aria-label="Channel view mode"
                >
                  <ToggleButton value="list" aria-label="List view">
                    <ViewListIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="grid" aria-label="Grid view">
                    <TableChartIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              )}

              <Tooltip title={`Sort alphabetically (${sortOrder === 'asc' ? 'A → Z' : 'Z → A'})`}>
                <IconButton onClick={handleSortToggle} color="primary" size="small">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SortByAlphaIcon />
                    {sortOrder === 'asc' ?
                      <ArrowUpwardIcon style={{ transform: 'scale(0.75,1)', marginLeft: -8 }} fontSize="small" /> :
                      <ArrowDownwardIcon style={{ transform: 'scale(0.75,1)', marginLeft: -8 }} fontSize="small" />}
                  </Box>
                </IconButton>
              </Tooltip>

              <Tooltip title="Filter by channel name">
                <IconButton
                  onClick={handleFilterIconClick}
                  color={filterValue ? 'primary' : 'default'}
                  size="small"
                >
                  <FilterAltIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={folderTooltip}>
                <IconButton
                  onClick={handleFolderMenuOpen}
                  color={folderControlActive ? 'primary' : 'default'}
                  size="small"
                >
                  <FolderSpecialIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {(folderControlActive && filterValue) ? `Total matching channels: ${total}` : `Total channels: ${total}`}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {showInlineLoader && <LinearProgress sx={{ mb: 1 }} />}
            {showStalledLoading && (
              <Alert
                severity="info"
                sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                action={
                  <Button color="inherit" size="small" onClick={refetch}>
                    Retry
                  </Button>
                }
              >
                Channel sync is taking longer than expected. You can keep waiting or retry the sync.
              </Alert>
            )}
            {showSkeletons ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  px: { xs: 1, md: 2 },
                  py: 2,
                }}
              >
                {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                  <Box
                    key={`channel-skeleton-${index}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '56px 1fr' : '56px 1fr 140px 140px 140px 56px',
                      gap: 2,
                      alignItems: 'center',
                      py: 1,
                      px: 1,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Skeleton variant="circular" width={56} height={56} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Skeleton variant="text" width="60%" height={24} />
                      <Skeleton variant="text" width="40%" height={18} />
                    </Box>
                    {!isMobile && (
                      <>
                        <Skeleton variant="rounded" width="100%" height={28} />
                        <Skeleton variant="rounded" width="100%" height={28} />
                        <Skeleton variant="rounded" width="100%" height={28} />
                        <Skeleton variant="circular" width={32} height={32} />
                      </>
                    )}
                  </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', pt: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Syncing channels...
                  </Typography>
                </Box>
              </Box>
            ) : displayChannels.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No channels found. Try adjusting your filter.</Typography>
              </Box>
            ) : (
              <Box ref={scrollContainerRef} sx={{ flex: 1, overflowY: 'auto', pr: { md: 1 }, pb: 2 }}>
                {viewMode === 'list' ? (
                  <List disablePadding>
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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
                  </Box>
                )}
                {useInfiniteScroll && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
                    <Box ref={loadMoreRef} sx={{ height: 1 }} />
                    {loading && displayChannels.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={20} />
                      </Box>
                    )}
                    {!hasNextPage && displayChannels.length > 0 && (
                      <Typography variant="caption" color="text.secondary" align="center" sx={{ pb: 1 }}>
                        You&apos;re all caught up.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {!useInfiniteScroll && (
              <Box
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  pt: isMobile ? 1 : 1.5,
                  pb: isMobile ? 1 : 1.5,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              >
                <Pagination
                  count={pageCount}
                  page={page}
                  color="primary"
                  onChange={(_, value) => setPage(value)}
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Menu anchorEl={folderMenuAnchor} open={Boolean(folderMenuAnchor)} onClose={handleFolderMenuClose}>
        <MenuItem selected={!selectedSubFolder} onClick={() => handleSubFolderSelect(null)}>
          <ListItemText primary="All folders" secondary="Show every channel" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
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
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Box sx={{ p: 2, minWidth: 240 }}>
          <TextField
            label="Filter channels"
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            fullWidth
            autoFocus
          />
          {filterValue && (
            <Button size="small" onClick={clearFilter} sx={{ mt: 1 }}>
              Clear filter
            </Button>
          )}
        </Box>
      </Popover>

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

      <Zoom in={hasPendingChanges}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 72,
            right: isMobile ? 16 : 32,
            zIndex: (theme) => theme.zIndex.snackbar + 1,
            pointerEvents: 'none',
          }}
        >
          <Stack spacing={1} alignItems="flex-end" sx={{ pointerEvents: 'auto' }}>
            <Fab
              variant="extended"
              color="default"
              size={isMobile ? 'medium' : 'large'}
              onClick={undoChanges}
              disabled={isSaving}
              aria-label="Undo changes"
              sx={{
                color: 'text.primary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'text.primary',
                }
              }}
            >
              <UndoIcon sx={{ mr: 1 }} />
              Undo
            </Fab>
            <Fab
              variant="extended"
              color="primary"
              size={isMobile ? 'medium' : 'large'}
              onClick={handleSaveChanges}
              disabled={isSaving}
              aria-label="Save changes"
              sx={(theme) => ({
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  color: 'primary.contrastText',
                }
              })}
            >
              {isSaving ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : <SaveIcon sx={{ mr: 1 }} />}
              {isSaving ? 'Saving…' : 'Save'}
            </Fab>
          </Stack>
        </Box>
      </Zoom>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Remove channel?</DialogTitle>
        <DialogContent>
          <Typography>
            Removing this channel will stop automatic downloads but won&apos;t delete existing videos or history.
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

      <Popover
        open={Boolean(regexPopoverAnchor)}
        anchorEl={regexPopoverAnchor?.el}
        onClose={handleRegexClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, maxWidth: 400 }}>
          <Typography variant="subtitle2" sx={{ mb: 0 }}>
            Title Filter Regex
          </Typography>
          <Typography variant="caption" sx={{ mt: 0, fontStyle: 'italic' }}>
            Filters videos downloaded for channel downloads.
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'var(--font-body)',
              bgcolor: 'action.hover',
              p: 1,
              borderRadius: 1,
              wordBreak: 'break-all',
            }}
          >
            {regexPopoverAnchor?.regex}
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default ChannelManager;
