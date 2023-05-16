import React, { useState, useEffect } from 'react';
import { Tooltip, Grid, Button, Card, CardHeader, ListItem, ListItemSecondaryAction, IconButton, TextField, List, ListItemText } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import axios from 'axios';

interface ChannelManagerProps {
  token: string | null;
}


function ChannelManager({ token }: ChannelManagerProps) {
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState<string>('');
  const [unsavedChannels, setUnsavedChannels] = useState<string[]>([]);

  useEffect(() => {
    // Fetch channels from backend on component mount
    if (token) {
      axios.get('/getchannels', {
        headers: {
          'x-access-token': token
        }
      }).then(response => {
        setChannels(response.data);
      });
    }
  }, [token]);

  const handleAdd = () => {
    if(newChannel.startsWith("https://www.youtube.com") && newChannel.endsWith("/videos")) {
      setChannels([...channels, newChannel]);
      setUnsavedChannels([...unsavedChannels, newChannel]);
      setNewChannel('');
    } else {
      alert("Invalid channel URL");
    }
  };

  const handleDelete = (index: number) => {
    const newChannels = [...channels];
    newChannels.splice(index, 1);
    setChannels(newChannels);

    const newUnsavedChannels = [...unsavedChannels];
    if (newUnsavedChannels.includes(channels[index])) {
      newUnsavedChannels.splice(newUnsavedChannels.indexOf(channels[index]), 1);
    }
    setUnsavedChannels(newUnsavedChannels);
  };

  const handleSave = () => {
    if (token) {
      axios.post('/updatechannels', channels, {
        headers: {
          'x-access-token': token
        }
      }).then(response => {
        setUnsavedChannels([]);
        alert('Channels updated successfully');
      });
    }
  };

  return (
    <Grid container spacing={2} style={{ marginBottom: '55px' }}>
      <Grid item xs={12}>
        <Card elevation={10}>
          <CardHeader title="Youtube Channels" />
          <List>
            {channels.map((channel, index) => (
              <ListItem key={index} style={unsavedChannels.includes(channel) ? { backgroundColor: 'lightyellow' } : {}}>
                <Grid container alignItems="center" spacing={1} >
                  <Grid item xs={9} md={9} lg={9}>
                    <ListItemText primary={channel} />
                  </Grid>
                  <Grid item xs={3}>
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDelete(index)}>
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
        </Card>
      </Grid>
      <Grid item xs={12}>
      <Card elevation={3}>
        <Tooltip placement="top" title="Enter a new channel URL to track here, eg: https://www.youtube.com/@PrestonReacts/videos">
          <TextField
            label="New Channel"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            fullWidth
          />
        </Tooltip>
        </Card>
      </Grid>
      <Grid item xs={6}>
        <Tooltip placement="top" title="Add a new channel to the list above">
          <Button variant="contained" onClick={handleAdd} fullWidth>Add Channel</Button>
        </Tooltip>
      </Grid>
      <Grid item xs={6}>
        <Tooltip placement="top" title="Save your changes and make them active">
          <Button variant="contained" onClick={handleSave} fullWidth>Save Channel Changes</Button>
        </Tooltip>
      </Grid>

    </Grid>
);
}

export default ChannelManager;