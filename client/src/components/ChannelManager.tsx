import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Tooltip,
  Grid,
  Button,
  Card,
  CardHeader,
  ListItem,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  List,
  ListItemText,
  Dialog,
  DialogContentText,
  DialogContent,
  DialogActions,
  Box,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import WebSocketContext, { Message } from '../contexts/WebSocketContext';
import { Channel } from '../types/Channel';
import { useNavigate } from 'react-router-dom';

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
  const websocketContext = useContext(WebSocketContext);
  const navigate = useNavigate();
  if (!websocketContext) {
    throw new Error('WebSocketContext not found');
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
          return `https://www.youtube.com/${channelName}/videos`;
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
        // Return normalized URL with /videos suffix
        return `https://www.youtube.com/@${handle}/videos`;
      }

      // Also support old-style /c/ or /channel/ URLs
      const oldStyleMatch = pathname.match(/^\/(c|channel)\/([^/]+)(\/.*)?$/);
      if (oldStyleMatch) {
        const channelId = oldStyleMatch[2];
        return `https://www.youtube.com/${oldStyleMatch[1]}/${channelId}/videos`;
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
          setDialogMessage('Failed to add channel. Please try again.');
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

  return (
    <Card elevation={8} style={{
      padding: '8px',
      marginBottom: '16px',
      height: 'calc(100vh - 175px)',
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
          <CardHeader title='Your Channels' align='center' />
            <Box
              ref={listContainerRef}
              sx={{
                flex: 1,
                overflow: 'auto',
                border: '1px solid #DDE',
                borderTop: 'none'
              }}>
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
                    direction={isMobile ? 'row' : 'row'}
                    alignItems='center'
                    spacing={0}
                  >
                    <Grid
                      item
                      xs={11}
                      sm={11}
                      onClick={() => navigate(`/channel/${channel.channel_id}`)}
                      style={{ cursor: 'pointer' }}
                      data-testid={`channel-click-area-${channel.channel_id}`}
                      >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                          src={`/images/channelthumb-${channel.channel_id}.jpg`}
                          alt={`${channel.uploader} thumbnail`}
                          style={{
                            height: isMobile ? '50px' : '75px',
                            width: isMobile ? '50px' : '75px',
                            marginRight: '10px',
                          }}
                          data-size={isMobile ? 'small' : 'large'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                          onLoad={(e) => {
                            (e.target as HTMLImageElement).style.display = '';
                          }}
                        />{' '}
                        <ListItemText
                          primary={
                            <div
                              style={{
                                fontSize: isMobile ? 'small' : 'medium',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: unsavedChannels.includes(
                                  channel.url
                                )
                                  ? 'bold'
                                  : 'normal',
                                textDecoration: deletedChannels.includes(
                                  channel.url
                                )
                                  ? 'line-through'
                                  : 'none',
                                color: deletedChannels.includes(channel.url)
                                  ? 'red'
                                  : 'inherit',
                              }}
                            >
                              {channel.uploader || channel.url}
                            </div>
                          }
                        />
                      </div>{' '}
                    </Grid>

                    {!deletedChannels.includes(channel.url) && (
                      <Grid item xs={12} sm={3}>
                        <ListItemSecondaryAction>
                          <IconButton
                            edge='end'
                            onClick={() => handleDeleteClick(index)}
                            size={isMobile ? 'small' : 'medium'}
                            data-testid='delete-channel-button'
                            disabled={isSaving}
                          >
                            <Delete />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </Grid>
                    )}
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
