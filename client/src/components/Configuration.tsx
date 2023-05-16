import React, { useState, ChangeEvent, useEffect } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Button, Card, CardContent, Checkbox, FormControlLabel, TextField, Grid, Typography, Tooltip } from '@mui/material';
import PlexLibrarySelector from './PlexLibrarySelector';

interface ConfigurationProps {
  token: string | null;
}

function Configuration({ token }: ConfigurationProps) {
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: '',
    plexApiKey: '',
    youtubeOutputDirectory: '',
    plexYoutubeLibraryId: '',
    plexIP: '',
    uuid: '',
  });
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);

  useEffect(() => {
    fetch('/getconfig', {
      headers: {
        'x-access-token': token || ''
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then(data => setConfig(data))
      .catch(error => console.error(error));
  }, [token]);

  const openLibrarySelector = () => {
    setOpenPlexLibrarySelector(true);
  };

  const closeLibrarySelector = () => {
    setOpenPlexLibrarySelector(false);
  };

  const setLibraryId = (id: string) => {
    setConfig({
      ...config,
      plexYoutubeLibraryId: id,
    });
    closeLibrarySelector();
  };

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
        'x-access-token': token || ''
      },
      body: JSON.stringify(config),
    });
  };

  const frequencyMapping: { [key: string]: string } = {
    'Every 5 minutes': '*/5 * * * *',
    'Every 15 minutes': '*/15 * * * *',
    'Every 30 minutes': '*/30 * * * *',
    'Hourly': '0 * * * *',
    'Every 4 hours': '0 */4 * * *',
    'Every 12 hours': '0 */12 * * *',
    'Daily': '0 0 * * *',
    'Weekly': '0 0 * * 0'
  };

  const handleSelectChange = (event: ChangeEvent<{ value: unknown }>, name: string) => {
    setConfig({
      ...config,
      [name]: frequencyMapping[event.target.value as string],
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
            <Tooltip placement="top-start" title="How often to run automatic channel downloads.">
              <FormControl fullWidth>
                <InputLabel id="download-frequency-label">Download Frequency</InputLabel>
                <Select
                  labelId="download-frequency-label"
                  label="Download Frequency"
                  value={Object.keys(frequencyMapping).find(key => frequencyMapping[key] === config.channelDownloadFrequency) || ''}
                  onChange={(event: any) => handleSelectChange(event, 'channelDownloadFrequency')}
                  name="channelDownloadFrequency"
                >
                  {Object.keys(frequencyMapping).map((frequency, index) => (
                    <MenuItem key={index} value={frequency}>
                      {frequency}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Tooltip placement="top-start" title="The IP address of your Plex server. 'localhost' if you're on the same machine. 'host.docker.internal' for production Docker on the same machine.">
            <TextField
              label="Plex Server IP Address"
              value={config.plexIP}
              onChange={handleInputChange}
              name="plexIP"
              fullWidth
            />
            </Tooltip>
          </Grid>

          <Grid item xs={2}>
            <Tooltip placement="top-start" title="The ID number of your Plex Youtube library">
              <TextField
                label="Plex Youtube Library ID"
                value={config.plexYoutubeLibraryId}
                onChange={handleInputChange}
                InputProps={{
                  readOnly: true,
                  onClick: openLibrarySelector
                }}
                name="plexYoutubeLibraryId"
                fullWidth
              />
              </Tooltip>
              <PlexLibrarySelector
                open={openPlexLibrarySelector}
                handleClose={closeLibrarySelector}
                setLibraryId={setLibraryId}
                token={token}
              />
          </Grid>
          <Grid item xs={2}>
            <Button variant="contained" color="primary" onClick={openLibrarySelector}>
                Select Plex Library
            </Button>
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
