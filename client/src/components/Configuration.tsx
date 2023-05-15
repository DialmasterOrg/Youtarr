import React, { useState, ChangeEvent, useEffect } from 'react';
import { Button, Card, CardContent, Checkbox, FormControlLabel, TextField, Grid, Typography } from '@mui/material';
import PlexAuth from './PLexAuth';

function Configuration() {
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: '',
    plexApiKey: '',
    plexApiSecret: '',
    youtubeOutputDirectory: '',
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
        <PlexAuth clientId={config.uuid} />
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
              label="Auto Download"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Download Frequency"
              value={config.channelDownloadFrequency}
              onChange={handleInputChange}
              name="channelDownloadFrequency"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Plex API Key"
              value={config.plexApiKey}
              onChange={handleInputChange}
              name="plexApiKey"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Plex API Secret"
              value={config.plexApiSecret}
              onChange={handleInputChange}
              name="plexApiSecret"
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Youtube Output Directory"
              value={config.youtubeOutputDirectory}
              onChange={handleInputChange}
              name="youtubeOutputDirectory"
              fullWidth
            />
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
