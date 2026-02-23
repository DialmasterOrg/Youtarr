import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Typography,
  ListItemText,
  Grow,
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
} from '../lib/icons';
import { Undo2 as UndoIcon, FolderOpen as FolderSpecialIcon } from 'lucide-react';
import useMediaQuery from '../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import WebSocketContext, { Message } from '../contexts/WebSocketContext';
import { useConfig } from '../hooks/useConfig';
import { Channel } from '../types/Channel';
import { useChannelList } from './ChannelManager/hooks/useChannelList';
import { useChannelMutations } from './ChannelManager/hooks/useChannelMutations';
import ChannelCard from './ChannelManager/components/ChannelCard';
import ChannelListRow, { CHANNEL_LIST_DESKTOP_TEMPLATE } from './ChannelManager/components/ChannelListRow';
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
  const isMobile = useMediaQuery('(max-width: 599px)');
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

  const pageSize = useMemo(() => {
    if (isMobile) {
      return 16;
    }
    return viewMode === 'grid' ? 27 : 20;
  }, [isMobile, viewMode]);

  // Senior State Architect: Memoize params to kill identity-based re-fetch loops
  const channelListParams = useMemo(() => ({
    token,
    page,
    pageSize,
    searchTerm: filterValue,
    sortOrder,
    subFolder: selectedSubFolder || undefined,
  }), [token, page, pageSize, filterValue, sortOrder, selectedSubFolder]);

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
      <Card style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CardHeader
          title="Channels"
          action={
            <Tooltip title="Learn how channel downloads work">
              <button type="button" onClick={() => setHelpDialogOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 8 }}>
                <HelpOutlineIcon size={20} />
              </button>
            </Tooltip>
          }
        />
        <Divider />
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            overflow: 'hidden',
          }}
        >
          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} alignItems="center" style={{ marginBottom: isMobile ? 8 : 16 }}>
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

          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isMobile && (
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => handleViewChange(null as any, 'list')}
                    aria-label="List view"
                    style={{ background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }}
                  >
                    <ViewListIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange(null as any, 'grid')}
                    aria-label="Grid view"
                    style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'inherit', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '4px 8px' }}
                  >
                    <TableChartIcon size={18} />
                  </button>
                </div>
              )}

              <Tooltip title={`Sort alphabetically (${sortOrder === 'asc' ? 'A → Z' : 'Z → A'})`}>
                <button type="button" onClick={handleSortToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}>
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
                  type="button"
                  onClick={handleFilterIconClick}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: filterValue ? 'var(--primary)' : 'inherit', display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 4 }}
                >
                  <FilterAltIcon size={18} />
                </button>
              </Tooltip>

              <Tooltip title={folderTooltip}>
                <button
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

          <Divider style={{ marginBottom: 16 }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loading ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </div>
            ) : displayChannels.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No channels found. Try adjusting your filter.</Typography>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
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

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                borderTop: '1px solid var(--border)',
                paddingTop: isMobile ? 8 : 12,
                paddingBottom: isMobile ? 8 : 12,
                backgroundColor: 'var(--card)',
                display: 'flex',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button type="button" onClick={() => setPage(1)} disabled={page === 1} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px' }}>{'\u00AB'}</button>
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px' }}>{'\u2039'}</button>
                <span style={{ padding: '2px 8px', fontSize: '0.875rem' }}>{page} / {pageCount}</span>
                <button type="button" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px' }}>{'\u203A'}</button>
                <button type="button" onClick={() => setPage(pageCount)} disabled={page === pageCount} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '2px 6px' }}>{'\u00BB'}</button>
              </div>
            </div>
          </div>
        </div>
      </Card>

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
        open={Boolean(filterAnchorEl)}
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
            bottom: 72,
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '6px 16px' : '8px 20px', borderRadius: 28, background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'white', boxShadow: 'var(--shadow-hard, 0 4px 12px rgba(0,0,0,0.2))' }}
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

export default ChannelManager;
