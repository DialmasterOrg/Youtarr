import React, { useState, ChangeEvent, useEffect } from 'react';
import { Button, Card, CardContent, Checkbox, FormControlLabel, TextField, Grid, Typography, Tooltip } from '@mui/material';
import PlexAuth from './PLexAuth';

function Configuration() {
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: '',
    plexApiKey: '',
    youtubeOutputDirectory: '',
    plexYoutubeLibraryId: '',
    plexIP: '',
    uuid: '',
  });

  useEffect(() => {
    fetch('/getconfig')
      .then(response => response.json())
      .then(data => setConfig(data));
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.value,
    });
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.checked,
    });
  };
  const saveConfig = () => {
    console.log('Saving config');
    fetch('/updateconfig', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Configuration
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.channelAutoDownload}
                  onChange={handleCheckboxChange}
                  name="channelAutoDownload"
                  color="primary"
                />
              }
              label="Enable Automatic Download of Channel Videos"
            />
          </Grid>
          <Grid item xs={12}>
            <Tooltip placement="top-start" title="How often to run automatic channel downloads. This uses crontab syntax">
              <TextField
                label="Download Frequency"
                value={config.channelDownloadFrequency}
                onChange={handleInputChange}
                name="channelDownloadFrequency"
                fullWidth
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Tooltip placement="top-start" title="The IP address of your Plex server, or localhost if you're on the same machine.">
            <TextField
              label="Plex Server IP Address"
              value={config.plexIP}
              onChange={handleInputChange}
              name="plexIP"
              fullWidth
            />
            </Tooltip>
          </Grid>

          <Grid item xs={4}>
            <Tooltip placement="top-start" title="Click GET NEW PLEX API KEY to auth to Plex">
              <TextField
                label="Plex API Key"
                value={config.plexApiKey}
                onChange={handleInputChange}
                InputProps={{
                  readOnly: true
                }}
                name="plexApiKey"
                fullWidth
              />
            </Tooltip>
          </Grid>
          <Grid item container xs={3} alignItems="center" justifyItems="center">
            <PlexAuth clientId={config.uuid} />
          </Grid>
          <Grid item xs={2}>
            <Tooltip placement="top-start" title="The ID number of your Plex Youtube library">
              <TextField
                label="Plex Youtube Library ID"
                value={config.plexYoutubeLibraryId}
                onChange={handleInputChange}
                InputProps={{
                  readOnly: true
                }}
                name="plexYoutubeLibraryId"
                fullWidth
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Tooltip placement="top-start" title="The directory path to your Plex Youtube library. If you update this you must restart your docker container.">
              <TextField
                label="Youtube Output Directory"
                value={config.youtubeOutputDirectory}
                onChange={handleInputChange}
                name="youtubeOutputDirectory"
                fullWidth
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" color="primary" onClick={saveConfig}>
              Save Configuration
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default Configuration;
