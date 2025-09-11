import React, { useContext, useState, useEffect, useCallback } from 'react';
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
  const [newChannel, setNewChannel] = useState<Channel>({
    url: '',
    uploader: '',
  });
  const [unsavedChannels, setUnsavedChannels] = useState<string[]>([]);
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
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
          // Sort the channels by uploader
          response.data.sort((a: Channel, b: Channel) => {
            if (a.uploader < b.uploader) {
              return -1;
            }
            if (a.uploader > b.uploader) {
              return 1;
            }
            return 0;
          });
          setChannels(response.data);
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
        });
    }

    setUnsavedChannels([...unsavedChannels, normalizedUrl]);
    setNewChannel({ url: '', uploader: '', channel_id: '' });
  };

  const handleDelete = (index: number) => {
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
  };

  const handleUndo = () => {
    setDeletedChannels([]);
    setUnsavedChannels([]);
    reloadChannels();
  };

  const handleSave = () => {
    if (token) {
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
        });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const getInfoIcon = (tooltipText: string) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobile) {
        setMobileTooltip(mobileTooltip === tooltipText ? null : tooltipText);
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
      <Tooltip title={tooltipText} arrow placement="top">
        <IconButton size="small" sx={{ ml: 0.5, p: 0.5 }}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Card elevation={8} style={{ padding: '8px', marginBottom: '16px' }}>
      <Grid container spacing={2} style={{ marginBottom: '8px' }}>
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardHeader title='Your Channels' align='center' />
            <List style={{ border: '1px solid #DDE' }}>
              {channels.map((channel, index) => (
                <ListItem
                  key={index}
                  style={
                    unsavedChannels.includes(channel.url)
                      ? { backgroundColor: '#b8ffef' }
                      : { backgroundColor: index % 2 === 0 ? 'white' : '#DDE' }
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
                            onClick={() => handleDelete(index)}
                            size={isMobile ? 'small' : 'medium'}
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
          </Card>
        </Grid>
        <Grid item xs={11}>
          <Card elevation={0} style={{ paddingTop: '8px' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <TextField
                label='Add a new channel'
                value={newChannel.url}
                onChange={(e) =>
                  setNewChannel({ url: e.target.value, uploader: '' })
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? 'small' : 'medium' },
                }}
                helperText="e.g., @MrBeast or youtube.com/@MrBeast"
              />
              {getInfoIcon('Enter a YouTube channel. Supported formats: @ChannelName, ChannelName, youtube.com/@ChannelName, full URLs, or with /videos suffix')}
            </Box>
          </Card>
        </Grid>
        <Grid
          item
          xs={1}
          style={{
            paddingLeft: isMobile ? '8px' : '0px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Tooltip placement='top' title='Add a new channel to the list above'>
            <IconButton onClick={handleAdd} color='primary'>
              <AddIcon fontSize='large' />
            </IconButton>
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
                  unsavedChannels.length === 0 && deletedChannels.length === 0
                }
                style={{ fontSize: isMobile ? 'small' : 'medium' }}
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
                  unsavedChannels.length === 0 && deletedChannels.length === 0
                }
                onClick={handleSave}
                fullWidth
                style={{ fontSize: isMobile ? 'small' : 'medium' }}
              >
                Save Changes
              </Button>
            </span>
          </Tooltip>
        </Grid>
      </Grid>

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
