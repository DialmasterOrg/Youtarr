import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Tooltip,
  Grid,
  Button,
  Card,
  CardHeader,
  ListItem,
  IconButton,
  TextField,
  List,
  Dialog,
  DialogContentText,
  DialogContent,
  DialogActions,
  DialogTitle,
  Box,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Typography,
  Popover,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import FolderIcon from '@mui/icons-material/Folder';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import axios from 'axios';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import WebSocketContext, { Message } from '../contexts/WebSocketContext';
import { Channel } from '../types/Channel';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../hooks/useConfig';
import HelpDialog from './ChannelManager/HelpDialog';

interface ChannelManagerProps {
  token: string | null;
}

function ChannelManager({ token }: ChannelManagerProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [newChannel, setNewChannel] = useState<Channel>({
    url: '',
    uploader: '',
  });
  const [unsavedChannels, setUnsavedChannels] = useState<string[]>([]);
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Store a stable identifier (URL) for pending deletion
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [regexPopoverAnchor, setRegexPopoverAnchor] = useState<{ el: HTMLElement; regex: string } | null>(null);
  const [regexDialogData, setRegexDialogData] = useState<{ open: boolean; regex: string }>({ open: false, regex: '' });
  const websocketContext = useContext(WebSocketContext);
  const navigate = useNavigate();
  if (!websocketContext) {
    throw new Error('WebSocketContext not found');
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { config } = useConfig(token);
  const globalPreferredResolution = config.preferredResolution || '1080';

  const reloadChannels = useCallback(() => {
    if (token) {
      axios
        .get('/getchannels', {
          headers: {
            'x-access-token': token,
          },
        })
        .then((response) => {
          // Sort the channels by uploader without mutating the original array
          const sorted = [...response.data].sort((a: Channel, b: Channel) => {
            if (a.uploader < b.uploader) {
              return -1;
            }
            if (a.uploader > b.uploader) {
              return 1;
            }
            return 0;
          });
          setChannels(sorted);
        });
    }
  }, [token]);

  const handleMessage = useCallback(
    (payload: any) => {
      reloadChannels();
    },
    [reloadChannels]
  );

  const messageFilter = useCallback((message: Message) => {
    return (
      message.destination === 'broadcast' &&
      message.source === 'channel' &&
      message.type === 'channelsUpdated'
    );
  }, []);

  useEffect(() => {
    websocketContext.subscribe(messageFilter, handleMessage);
    reloadChannels();
    return () => {
      websocketContext.unsubscribe(handleMessage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reloadChannels]);

  // Normalize YouTube channel URL to standard format
  const normalizeChannelUrl = (url: string): string | null => {
    try {
      url = url.trim().replace(/\/+$/, '');

      // Check if it's just a channel name (with or without @)
      // Examples: "@BeastReacts", "BeastReacts", "@MrBeast"
      if (!url.includes('.') && !url.includes('/')) {
        // If it doesn't start with @, add it
        const channelName = url.startsWith('@') ? url : `@${url}`;
        // Validate it's a reasonable channel name (alphanumeric, underscores, hyphens, dots)
        if (/^@[\w.-]+$/.test(channelName)) {
          return `https://www.youtube.com/${channelName}`;
        }
        return null;
      }

      // Support URLs without protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Parse the URL
      const urlObj = new URL(url);

      // Check if it's a YouTube domain (youtube.com, www.youtube.com, m.youtube.com)
      const hostname = urlObj.hostname.toLowerCase();
      if (!hostname.endsWith('youtube.com')) {
        return null;
      }

      // Extract the pathname
      const pathname = urlObj.pathname;

      // Check if it's a channel URL with @ handle
      const channelMatch = pathname.match(/^\/@([^/]+)(\/.*)?$/);
      if (channelMatch) {
        const handle = channelMatch[1];
        // Return normalized URL without tab suffix
        return `https://www.youtube.com/@${handle}`;
      }

      // Also support old-style /c/ or /channel/ URLs
      const oldStyleMatch = pathname.match(/^\/(c|channel)\/([^/]+)(\/.*)?$/);
      if (oldStyleMatch) {
        const channelId = oldStyleMatch[2];
        return `https://www.youtube.com/${oldStyleMatch[1]}/${channelId}`;
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  const handleAdd = () => {
    const normalizedUrl = normalizeChannelUrl(newChannel.url);

    if (!normalizedUrl) {
      setDialogMessage(
        'Invalid channel URL. Supported formats:\n' +
        '• @ChannelName or ChannelName\n' +
        '• youtube.com/@ChannelName\n' +
        '• https://www.youtube.com/@ChannelName\n' +
        '• m.youtube.com/@ChannelName'
      );
      setIsDialogOpen(true);
      setNewChannel({ url: '', uploader: '', channel_id: '' });
      return;
    }

    // Check if channel already exists using normalized URL
    if (channels.some((channel) => channel.url === normalizedUrl)) {
      setDialogMessage('Channel already exists');
      setIsDialogOpen(true);
      setNewChannel({ url: '', uploader: '', channel_id: '' });
      return;
    }

    // Set loading state
    setIsAddingChannel(true);

    // Use normalized URL for the new channel
    const channelToAdd = { ...newChannel, url: normalizedUrl };
    setChannels([...channels, channelToAdd]);

    if (token) {
      axios
        .post(
          '/addchannelinfo',
          { url: normalizedUrl }, // Pass normalized URL in request body
          {
            headers: {
              'x-access-token': token,
            },
          }
        )
        .then((response) => {
          if (response.data.status === 'success') {
            // Delete the last channel in the list, which is the new channel
            // with no channel info
            setChannels((prevChannels) => prevChannels.slice(0, -1));

            // Now re-add it with info
            setChannels((prevChannels) => [
              ...prevChannels,
              response.data.channelInfo,
            ]);
          } else {
            console.error('Failed to add channel info');
          }
        })
        .catch((error) => {
          console.error('Error adding channel:', error);
          // Remove the temporary channel on error
          setChannels((prevChannels) => prevChannels.slice(0, -1));

          // Extract error message from response
          let errorMessage = 'Failed to add channel. Please try again.';
          if (error.response?.status === 503) {
            // yt-dlp returns a 503 when the channel is not found
            errorMessage = 'Channel not found. Please check the URL or channel name and try again.';
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.response?.status === 404) {
            errorMessage = 'Channel not found. Please check the URL and try again.';
          } else if (error.response?.status === 403) {
            errorMessage = 'Authentication issue. Please check your cookies configuration.';
          }

          setDialogMessage(errorMessage);
          setIsDialogOpen(true);
        })
        .finally(() => {
          setIsAddingChannel(false);
        });
    }

    setUnsavedChannels([...unsavedChannels, normalizedUrl]);
    setNewChannel({ url: '', uploader: '', channel_id: '' });

    // Auto-scroll to bottom to show the newly added channel
    setTimeout(() => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleDeleteClick = (index: number) => {
    setChannelToDelete(channels[index].url);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (channelToDelete === null) return;

    const index = channels.findIndex((c) => c.url === channelToDelete);
    if (index === -1) {
      // Channel no longer exists; just close the dialog
      setDeleteConfirmOpen(false);
      setChannelToDelete(null);
      return;
    }

    if (unsavedChannels.includes(channels[index].url)) {
      setUnsavedChannels(
        unsavedChannels.filter(
          (channelUrl) => channelUrl !== channels[index].url
        )
      );
      setChannels(
        channels.filter((channel) => channel.url !== channels[index].url)
      );
    } else {
      setDeletedChannels([...deletedChannels, channels[index].url]);
    }

    setDeleteConfirmOpen(false);
    setChannelToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setChannelToDelete(null);
  };

  const handleUndo = () => {
    setDeletedChannels([]);
    setUnsavedChannels([]);
    reloadChannels();
  };

  const handleSave = () => {
    if (token) {
      setIsSaving(true);
      const channelsToSave = channels
        .filter((channel) => !deletedChannels.includes(channel.url))
        .map((channel) => channel.url); // Transform array of Channel objects into array of strings

      axios
        .post('/updatechannels', channelsToSave, {
          headers: {
            'x-access-token': token,
          },
        })
        .then((response) => {
          setDeletedChannels([]);
          setUnsavedChannels([]);
          setDialogMessage('Channels updated successfully');
          setIsDialogOpen(true);
          reloadChannels();
        })
        .catch((error) => {
          console.error('Error saving channels:', error);
          setDialogMessage('Failed to save channels. Please try again.');
          setIsDialogOpen(true);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const renderSubFolder = (subFolder: string | null | undefined) => {
    const displayText = subFolder ? `__${subFolder}/` : 'default';
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FolderIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }} />
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: subFolder ? '#555' : '#888', fontStyle: subFolder ? 'normal' : 'italic' }}>
          {displayText}
        </Typography>
      </Box>
    );
  };

  const renderQualityChip = (videoQuality: string | null | undefined) => {
    const resolvedQuality = videoQuality || globalPreferredResolution;
    const isOverride = Boolean(videoQuality);

    return (
      <Chip
        label={`${resolvedQuality}p`}
        size="small"
        color={isOverride ? 'success' : 'default'}
        icon={isOverride ? <SettingsIcon sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }} /> : undefined}
        sx={{
          height: isMobile ? '18px' : '20px',
          fontSize: isMobile ? '0.65rem' : '0.7rem',
          maxWidth: '125px',
          '& .MuiChip-icon': {
            ml: isMobile ? 0.25 : 0.5,
          },
        }}
      />
    );
  };

  const renderAutoDownloadBadges = (availableTabs: string | null | undefined, autoDownloadTabs: string | undefined) => {
    // Map available tabs (videos, shorts, streams) to media types (video, short, livestream)
    const availableToMediaTypeMap: Record<string, string> = {
      'videos': 'video',
      'shorts': 'short',
      'streams': 'livestream',
    };

    const tabDisplayMap: Record<string, { full: string; short: string }> = {
      'videos': { full: 'Videos', short: 'Videos' },
      'shorts': { full: 'Shorts', short: 'Shorts' },
      'streams': { full: 'Live', short: 'Live' },
    };

    // Parse available tabs
    const available = availableTabs
      ? availableTabs.split(',').map(tab => tab.trim()).filter(tab => tab.length > 0)
      : [];

    // Parse auto-download enabled tabs (these are media types: video, short, livestream)
    const autoDownloadEnabled = autoDownloadTabs
      ? autoDownloadTabs.split(',').map(tab => tab.trim()).filter(tab => tab.length > 0)
      : [];

    // If no available tabs, show a message
    if (available.length === 0) {
      return (
        <Box sx={{ mt: 0.5, textAlign: 'center' }}>
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: '#888' }}>
            No tabs detected
          </span>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
        {available.map((tab) => {
          const tabInfo = tabDisplayMap[tab];
          if (!tabInfo) return null;

          // Check if this tab is enabled for auto-download
          const mediaType = availableToMediaTypeMap[tab];
          const isAutoDownloadEnabled = mediaType && autoDownloadEnabled.includes(mediaType);

          return (
            <Chip
              key={tab}
              label={isMobile ? tabInfo.short : tabInfo.full}
              size="small"
              variant="outlined"
              icon={isAutoDownloadEnabled ? <FileDownloadIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'success.main' }} /> : undefined}
              sx={{
                height: isMobile ? '18px' : '20px',
                fontSize: isMobile ? '0.65rem' : '0.7rem',
                maxWidth: '125px',
                '& .MuiChip-label': {
                  px: isMobile ? 0.5 : 0.75,
                },
                '& .MuiChip-icon': {
                  ml: isMobile ? 0.25 : 0.5,
                },
              }}
            />
          );
        })}
      </Box>
    );
  };

  const formatDuration = (minSeconds: number | null | undefined, maxSeconds: number | null | undefined) => {
    const minMinutes = minSeconds ? Math.floor(minSeconds / 60) : null;
    const maxMinutes = maxSeconds ? Math.floor(maxSeconds / 60) : null;

    if (minMinutes && maxMinutes) {
      return isMobile ? `${minMinutes}-${maxMinutes}m` : `${minMinutes}-${maxMinutes} min`;
    } else if (minMinutes) {
      return isMobile ? `≥${minMinutes}m` : `≥${minMinutes} min`;
    } else if (maxMinutes) {
      return isMobile ? `≤${maxMinutes}m` : `≤${maxMinutes} min`;
    }
    return '';
  };

  const handleRegexClick = (event: React.MouseEvent<HTMLElement>, regex: string) => {
    event.stopPropagation();
    if (isMobile) {
      setRegexDialogData({ open: true, regex });
    } else {
      setRegexPopoverAnchor({ el: event.currentTarget, regex });
    }
  };

  const handleRegexClose = () => {
    setRegexPopoverAnchor(null);
    setRegexDialogData({ open: false, regex: '' });
  };

  const renderFilterIndicators = (channel: Channel) => {
    const hasDurationFilter = channel.min_duration || channel.max_duration;
    const hasRegexFilter = channel.title_filter_regex;

    if (!hasDurationFilter && !hasRegexFilter) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', gap: 0.3, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
        {hasDurationFilter && (
          <Tooltip title={`Duration filter: ${formatDuration(channel.min_duration, channel.max_duration)}`}>
            <Chip
              icon={<AccessTimeIcon />}
              label={formatDuration(channel.min_duration, channel.max_duration)}
              size="small"
              variant="outlined"
              color="primary"
              sx={{
                height: isMobile ? '16px' : '18px',
                fontSize: isMobile ? '0.6rem' : '0.65rem',
                '& .MuiChip-icon': {
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  ml: isMobile ? 0.25 : 0.5,
                },
                '& .MuiChip-label': {
                  px: isMobile ? 0.5 : 0.75,
                },
              }}
            />
          </Tooltip>
        )}

        {hasRegexFilter && (
          isMobile ? (
            // Mobile: Just an icon button
            <Tooltip title="Title filter (tap to view)">
              <IconButton
                size="small"
                onClick={(e) => handleRegexClick(e, channel.title_filter_regex || '')}
                data-testid="regex-filter-button"
                sx={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  color: 'primary.main',
                }}
              >
                <FilterAltIcon sx={{ fontSize: '0.9rem' }} />
              </IconButton>
            </Tooltip>
          ) : (
            // Desktop: Small chip with icon
            <Tooltip title="Title regex filter (click to view)">
              <Chip
                icon={<FilterAltIcon />}
                label="Title"
                size="small"
                variant="outlined"
                color="primary"
                onClick={(e) => handleRegexClick(e, channel.title_filter_regex || '')}
                sx={{
                  height: '18px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  '& .MuiChip-icon': {
                    fontSize: '0.75rem',
                    ml: 0.5,
                  },
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  },
                }}
              />
            </Tooltip>
          )
        )}
      </Box>
    );
  };

  return (
    <Card elevation={8} style={{
      padding: '8px',
      marginBottom: '16px',
      height: isMobile ? 'calc(100vh - 135px)' : 'calc(100vh - 165px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        mb: 2
      }}>
        <Card elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CardHeader
            title='Your Channels'
            align='center'
            action={
              <Tooltip title="Help & Legend" arrow>
                <IconButton
                  onClick={() => setHelpDialogOpen(true)}
                  size="small"
                  sx={{
                    mt: isMobile ? 0 : 1,
                    mr: 1,
                    position: 'absolute',
                    right: 8,
                    top: 8
                  }}
                >
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
            }
            sx={{
              py: isMobile ? 1 : 2,
              position: 'relative'
            }}
          />
            <Box
              ref={listContainerRef}
              sx={{
                flex: 1,
                overflow: 'auto',
                border: '1px solid #DDE',
                borderTop: 'none'
              }}>
              {/* Column Headers */}
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#f5f5f5',
                  borderBottom: '2px solid #999',
                  zIndex: 10,
                  py: 1,
                  px: 2
                }}
              >
                <Grid container spacing={0} alignItems="center">
                  <Grid item xs={4} sm={3} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: isMobile ? '0.7rem' : '1rem' }}>
                      Channel
                    </Typography>
                  </Grid>
                  <Grid item xs={3} sm={4} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: isMobile ? '0.7rem' : '1rem' }}>
                      {isMobile ? 'Types' : 'Content Types'}
                    </Typography>
                  </Grid>
                  <Grid item xs={4} sm={3} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: isMobile ? '0.7rem' : '1rem' }}>
                      Settings
                    </Typography>
                  </Grid>
                  <Grid item xs={1} sm={2}>
                    {/* Empty for delete column */}
                  </Grid>
                </Grid>
              </Box>
              <List>
              {channels.map((channel, index) => (
                <ListItem
                  key={channel.channel_id || channel.url}
                  style={
                    unsavedChannels.includes(channel.url)
                      ? { backgroundColor: '#b8ffef' }
                      : { backgroundColor: index % 2 === 0 ? 'white' : '#DDE' }
                  }
                  data-state={
                    unsavedChannels.includes(channel.url)
                      ? 'new'
                      : deletedChannels.includes(channel.url)
                      ? 'deleted'
                      : undefined
                  }
                >
                  <Grid
                    container
                    spacing={1}
                    alignItems="center"
                  >
                    {/* Column 1: Channel (Thumbnail + Name) */}
                    <Grid
                      item
                      xs={4}
                      sm={3}
                      onClick={() => navigate(`/channel/${channel.channel_id}`)}
                      style={{ cursor: 'pointer' }}
                      data-testid={`channel-click-area-${channel.channel_id}`}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        <img
                          src={`/images/channelthumb-${channel.channel_id}.jpg`}
                          alt={`${channel.uploader} thumbnail`}
                          style={{
                            height: isMobile ? '40px' : '60px',
                            width: isMobile ? '40px' : '60px',
                            borderRadius: '50%',
                          }}
                          data-size={isMobile ? 'small' : 'large'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          onLoad={(e) => {
                            (e.target as HTMLImageElement).style.display = '';
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: isMobile ? '0.7rem' : '0.85rem',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            fontWeight: unsavedChannels.includes(channel.url) ? 'bold' : 'normal',
                            textDecoration: deletedChannels.includes(channel.url) ? 'line-through' : 'none',
                            color: deletedChannels.includes(channel.url) ? 'red' : 'inherit',
                          }}
                        >
                          {channel.uploader || channel.url}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Column 2: Content Types (Tab chips) */}
                    <Grid item xs={3} sm={4}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                        {renderAutoDownloadBadges(channel.available_tabs, channel.auto_download_enabled_tabs)}
                      </Box>
                    </Grid>

                    {/* Column 3: Settings (Folder + Quality + Filters) */}
                    <Grid item xs={4} sm={3}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                        {renderSubFolder(channel.sub_folder)}
                        {renderQualityChip(channel.video_quality)}
                        {renderFilterIndicators(channel)}
                      </Box>
                    </Grid>

                    {/* Column 4: Delete Action */}
                    <Grid item xs={1} sm={2}>
                      {!deletedChannels.includes(channel.url) && (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton
                            onClick={() => handleDeleteClick(index)}
                            size={isMobile ? 'small' : 'medium'}
                            data-testid='delete-channel-button'
                            disabled={isSaving}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </ListItem>
              ))}
              </List>
            </Box>
        </Card>
      </Box>
      <Box sx={{
        borderTop: '2px solid #e0e0e0',
        pt: 2,
        backgroundColor: 'background.paper'
      }}>
        <Grid container spacing={2}>
          <Grid item xs={11}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <TextField
                label='Add a new channel'
                padding-right={isMobile ? '8px' : '0px'}
                value={newChannel.url}
                onChange={(e) =>
                  setNewChannel({ url: e.target.value, uploader: '' })
                }
                disabled={isAddingChannel || isSaving}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isAddingChannel && !isSaving && newChannel.url.trim()) {
                    handleAdd();
                  }
                }}
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? 'small' : 'medium' },
                }}
                helperText="e.g., @MrBeast or youtube.com/@MrBeast"
              />
            </Box>
          </Grid>
        <Grid
          item
          xs={1}
          style={{
            paddingLeft: isMobile ? '8px' : '0px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: isMobile ? '70px' : '80px',
          }}
        >
          <Tooltip placement='top' title={isAddingChannel ? 'Adding channel...' : 'Add a new channel to the list above'}>
            <span>
              <IconButton
                onClick={handleAdd}
                color='primary'
                data-testid='add-channel-button'
                disabled={isAddingChannel || isSaving || !newChannel.url.trim()}
              >
                {isAddingChannel ? (
                  <CircularProgress size={28} />
                ) : (
                  <AddIcon fontSize='large' />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
          <Grid item xs={6}>
            <Tooltip placement='top' title='Revert unsaved changes'>
            <span>
              <Button
                variant='contained'
                onClick={handleUndo}
                fullWidth
                disabled={
                  (unsavedChannels.length === 0 && deletedChannels.length === 0) || isSaving
                }
                style={{ fontSize: isMobile ? 'small' : 'medium' }}
                data-size={isMobile ? 'small' : 'medium'}
              >
                Undo
              </Button>
            </span>
          </Tooltip>
          </Grid>
          <Grid item xs={6}>
            <Tooltip
              placement='top'
              title='Save your changes and make them active'
            >
            <span>
              <Button
                variant='contained'
                disabled={
                  (unsavedChannels.length === 0 && deletedChannels.length === 0) || isSaving
                }
                onClick={handleSave}
                fullWidth
                style={{ fontSize: isMobile ? 'small' : 'medium' }}
                data-size={isMobile ? 'small' : 'medium'}
              >
                {isSaving ? (
                  <>
                    <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </span>
          </Tooltip>
          </Grid>
        </Grid>
      </Box>

      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
      >
        <DialogContent>
          <DialogContentText
            id='alert-dialog-description'
            style={{ fontSize: isMobile ? '14px' : '18px' }}
          >
            {dialogMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color='primary' autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby='delete-confirm-dialog-title'
        aria-describedby='delete-confirm-dialog-description'
      >
        <DialogContent>
          <DialogContentText
            id='delete-confirm-dialog-description'
            style={{ fontSize: isMobile ? '14px' : '16px' }}
          >
            Removing this channel will stop automatic downloads but won't delete existing videos or download history.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color='primary' autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <HelpDialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        isMobile={isMobile}
      />

      {/* Popover for desktop regex display */}
      <Popover
        open={Boolean(regexPopoverAnchor)}
        anchorEl={regexPopoverAnchor?.el}
        onClose={handleRegexClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 400 }}>
          <Typography variant="subtitle2" gutterBottom>
            Title Filter Regex Pattern:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              p: 1,
              borderRadius: 1,
              wordBreak: 'break-all',
            }}
          >
            {regexPopoverAnchor?.regex}
          </Typography>
        </Box>
      </Popover>

      {/* Dialog for mobile regex display */}
      <Dialog open={regexDialogData.open} onClose={handleRegexClose} fullWidth maxWidth="sm">
        <DialogTitle>Title Filter Regex Pattern</DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              p: 1,
              borderRadius: 1,
              wordBreak: 'break-all',
              mt: 1,
            }}
          >
            {regexDialogData.regex}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRegexClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(mobileTooltip)}
        autoHideDuration={8000}
        onClose={() => setMobileTooltip(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setMobileTooltip(null)}
          severity="info"
          icon={<InfoIcon />}
        >
          {mobileTooltip}
        </Alert>
      </Snackbar>
    </Card>
  );
}

export default ChannelManager;
