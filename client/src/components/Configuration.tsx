import React, { useState, ChangeEvent, useEffect } from "react";
import {
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  TextField,
  Grid,
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogActions,
} from "@mui/material";
import PlexLibrarySelector from "./PlexLibrarySelector";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface ConfigurationProps {
  token: string | null;
}

// TODO: No need to show the user the Plex Youtube Library ID, we should save the library NAME and the ID to the config and only display the name

function Configuration({ token }: ConfigurationProps) {
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: "",
    channelFilesToDownload: 3,
    initialSetup: true,
    plexApiKey: "",
    youtubeOutputDirectory: "",
    plexYoutubeLibraryId: "",
    plexIP: "",
    uuid: "",
  });
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    fetch("/getconfig", {
      headers: {
        "x-access-token": token || "",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => setConfig(data))
      .catch((error) => console.error(error));
  }, [token]);

  const openLibrarySelector = () => {
    setOpenPlexLibrarySelector(true);
  };

  const closeLibrarySelector = () => {
    setOpenPlexLibrarySelector(false);
  };

  const setLibraryId = (id: string, directory: string) => {
    setConfig({
      ...config,
      plexYoutubeLibraryId: id,
      youtubeOutputDirectory: directory,
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
    console.log("Saving config");
    fetch("/updateconfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token || "",
      },
      body: JSON.stringify(config),
    });
  };

  const handleOpenConfirmDialog = () => {
    setOpenConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    setOpenConfirmDialog(false);
    saveConfig();
  };

  const frequencyMapping: { [key: string]: string } = {
    "Every 15 minutes": "*/15 * * * *",
    "Every 30 minutes": "*/30 * * * *",
    Hourly: "0 * * * *",
    "Every 4 hours": "0 */4 * * *",
    "Every 12 hours": "0 */12 * * *",
    Daily: "0 0 * * *",
    Weekly: "0 0 * * 0",
  };

  const handleSelectChange = (
    event: ChangeEvent<{ value: unknown }>,
    name: string
  ) => {
    setConfig({
      ...config,
      [name]: frequencyMapping[event.target.value as string],
    });
  };

  const handleSelectNumberChange = (event: SelectChangeEvent<number>) => {
    const { name = "", value } = event.target;
    setConfig({
      ...config,
      [name]: value,
    });
  };

  return (
    <Card elevation={8}>
      <CardContent>
        <Typography
          variant={isMobile ? "h6" : "h5"}
          component="h2"
          gutterBottom
          align="center"
        >
          Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Tooltip
              placement="top-start"
              title="Check to enable automatic scheduled downloading of videos from your Channels."
            >
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
            </Tooltip>
          </Grid>
          {config.channelAutoDownload && (
            <Grid item xs={12}>
              <Tooltip
                placement="top-start"
                title="How often to run automatic channel video downloads."
              >
                <FormControl fullWidth>
                  <InputLabel
                    id="download-frequency-label"
                    style={{ fontSize: isMobile ? "small" : "medium" }}
                  >
                    Download Frequency
                  </InputLabel>
                  <Select
                    labelId="download-frequency-label"
                    label="Download Frequency"
                    value={
                      Object.keys(frequencyMapping).find(
                        (key) =>
                          frequencyMapping[key] ===
                          config.channelDownloadFrequency
                      ) || ""
                    }
                    onChange={(event: any) =>
                      handleSelectChange(event, "channelDownloadFrequency")
                    }
                    name="channelDownloadFrequency"
                    inputProps={{
                      style: { fontSize: isMobile ? "small" : "medium" },
                    }}
                  >
                    {Object.keys(frequencyMapping).map((frequency, index) => (
                      <MenuItem
                        key={index}
                        value={frequency}
                        style={{ fontSize: isMobile ? "small" : "medium" }}
                      >
                        {frequency}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Tooltip>
            </Grid>
          )}
          <Grid item xs={12}>
            <Tooltip
              placement="top-start"
              title="How many videos (starting from the most recent) should be downloaded for each channel when channel downloads are initiated."
            >
              <FormControl fullWidth>
                <InputLabel>Channel Files to Download</InputLabel>
                <Select
                  label="Channel Files to Download"
                  value={config.channelFilesToDownload}
                  onChange={handleSelectNumberChange}
                  name="channelFilesToDownload"
                  inputProps={{
                    style: { fontSize: isMobile ? "small" : "medium" },
                  }}
                >
                  {[...Array(10)].map((_, i) => (
                    <MenuItem value={i + 1} key={i}>
                      {i + 1}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Tooltip
              placement="top-start"
              title="The IP address of your Plex server. 'localhost' if you're on the same machine running in dev mode. 'host.docker.internal' for production Docker on the same machine. You can also use your public IP for your Plex server."
            >
              <TextField
                label="Plex Server IP Address"
                value={config.plexIP}
                onChange={handleInputChange}
                name="plexIP"
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? "small" : "medium" },
                }}
              />
            </Tooltip>
          </Grid>

          <Grid item xs={6} md={3}>
            <Tooltip
              placement="top-start"
              title="The Plex Library ID for the library you will be downloading videos to and refreshing in Plex."
            >
              <TextField
                label="Plex Youtube Library ID"
                value={config.plexYoutubeLibraryId}
                onChange={handleInputChange}
                InputProps={{
                  readOnly: true,
                  onClick: openLibrarySelector,
                  style: { fontSize: isMobile ? "0.8rem" : "1rem" },
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
          <Grid item xs={6} md={3}>
            <Button
              variant="contained"
              color="primary"
              onClick={openLibrarySelector}
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Select Plex Library
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Tooltip
              placement="top-start"
              title="The directory path to your Plex Youtube library. If you update this you must restart your docker container. Manually update this field at your own risk!"
            >
              <TextField
                label="Youtube Output Directory"
                value={config.youtubeOutputDirectory}
                onChange={handleInputChange}
                name="youtubeOutputDirectory"
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? "small" : "medium" },
                }}
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenConfirmDialog}
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Save Configuration Changes
            </Button>
          </Grid>
        </Grid>
        <Dialog
          open={openConfirmDialog}
          onClose={() => setOpenConfirmDialog(false)}
        >
          <DialogTitle>Are you sure you want to save these changes?</DialogTitle>
          <DialogActions>
            <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} color="primary" autoFocus>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default Configuration;
