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
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
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
  }, [token, reloadChannels]);

  const handleAdd = () => {
    if (channels.some((channel) => channel.url === newChannel.url)) {
      setDialogMessage('Channel already exists');
      setIsDialogOpen(true);

      setNewChannel({ url: '', uploader: '', channel_id: '' });
      return;
    }
    if (
      newChannel.url.startsWith('https://www.youtube.com') &&
      newChannel.url.endsWith('/videos')
    ) {
      setChannels([...channels, newChannel]);
      if (token) {
        axios
          .post(
            '/addchannelinfo',
            { url: newChannel.url }, // Pass URL in request body
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

      setUnsavedChannels([...unsavedChannels, newChannel.url]);
    } else {
      setDialogMessage(
        'Invalid channel URL. Please use the following format: https://www.youtube.com/@DanTDM/videos'
      );
      setIsDialogOpen(true);
    }

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

  return (
    <Card elevation={8} style={{ padding: '8px' }}>
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
            <Tooltip
              placement='top'
              title='Enter a new channel URL to track here, eg: https://www.youtube.com/@PrestonReacts/videos'
            >
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
              />
            </Tooltip>
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
          </Tooltip>
        </Grid>
        <Grid item xs={6}>
          <Tooltip
            placement='top'
            title='Save your changes and make them active'
          >
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
    </Card>
  );
}

export default ChannelManager;
