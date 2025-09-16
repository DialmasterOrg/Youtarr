import React, { useState, ChangeEvent, useEffect } from 'react';
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
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  AlertTitle,
  Chip,
  Snackbar,
  Box,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import PlexLibrarySelector from './PlexLibrarySelector';
import PlexAuthDialog from './PlexAuthDialog';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';

interface ConfigurationProps {
  token: string | null;
}

function Configuration({ token }: ConfigurationProps) {
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: '',
    channelFilesToDownload: 3,
    preferredResolution: '1080',
    initialSetup: true,
    plexApiKey: '',
    youtubeOutputDirectory: '',
    plexYoutubeLibraryId: '',
    plexIP: '',
    uuid: '',
  });
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);
  const [openPlexAuthDialog, setOpenPlexAuthDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [plexConnectionStatus, setPlexConnectionStatus] = useState<'connected' | 'not_connected' | 'not_tested' | 'testing'>('not_tested');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialConfig, setInitialConfig] = useState<typeof config | null>(null);
  const [didInitialPlexCheck, setDidInitialPlexCheck] = useState(false);
  const [youtubeDirectoryChanged, setYoutubeDirectoryChanged] = useState(false);
  const [originalYoutubeDirectory, setOriginalYoutubeDirectory] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetch('/getconfig', {
      headers: {
        'x-access-token': token || '',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        setConfig(data);
        setOriginalYoutubeDirectory(data.youtubeOutputDirectory || '');
        setInitialConfig(data);
      })
      .catch((error) => console.error(error));
  }, [token]);

  const checkPlexConnection = React.useCallback(() => {
    if (config.plexIP) {
      fetch('/getplexlibraries', {
        headers: {
          'x-access-token': token || '',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setPlexConnectionStatus(Array.isArray(data) && data.length > 0 ? 'connected' : 'not_connected');
        })
        .catch(() => {
          setPlexConnectionStatus('not_connected');
        });
    }
  }, [config.plexIP, token]);

  // On first load after config arrives, check Plex connection if values exist
  useEffect(() => {
    if (!didInitialPlexCheck && config.plexIP && config.plexApiKey) {
      checkPlexConnection();
      setDidInitialPlexCheck(true);
    }
  }, [didInitialPlexCheck, config.plexIP, config.plexApiKey, checkPlexConnection]);

  const testPlexConnection = async () => {
    if (!config.plexIP || !config.plexApiKey) {
      setSnackbar({
        open: true,
        message: 'Please enter both Plex IP and API Key',
        severity: 'warning'
      });
      return;
    }

    setPlexConnectionStatus('testing');

    try {
      // Send the unsaved form values as query parameters for testing
      const params = new URLSearchParams({
        testIP: config.plexIP,
        testApiKey: config.plexApiKey
      });

      const response = await fetch(`/getplexlibraries?${params}`, {
        headers: {
          'x-access-token': token || '',
        },
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setPlexConnectionStatus('connected');
        // Plex credentials are auto-saved. Update initial snapshot for those fields.
        setInitialConfig((prev) => (
          prev ? { ...prev, plexIP: config.plexIP, plexApiKey: config.plexApiKey } : { ...config }
        ));
        setSnackbar({
          open: true,
          message: 'Plex connection successful! Credentials saved automatically.',
          severity: 'success'
        });
      } else {
        setPlexConnectionStatus('not_connected');
        setSnackbar({
          open: true,
          message: 'Could not retrieve Plex libraries. Check your settings.',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error testing Plex connection:', error);
      setPlexConnectionStatus('not_connected');
      setSnackbar({
        open: true,
        message: 'Failed to connect to Plex server. Check IP and API key.',
        severity: 'error'
      });
    }
  };

  const openLibrarySelector = () => {
    setOpenPlexLibrarySelector(true);
  };

  const closeLibrarySelector = () => {
    setOpenPlexLibrarySelector(false);
  };

  const setLibraryId = (id: string, directory: string) => {
    // Only update directory if one was selected (not empty string)
    if (directory) {
      setConfig({
        ...config,
        plexYoutubeLibraryId: id,
        youtubeOutputDirectory: directory,
      });
      // Check if directory actually changed
      if (directory !== originalYoutubeDirectory) {
        setYoutubeDirectoryChanged(true);
      }
    } else {
      // Just update library ID, keep existing directory
      setConfig({
        ...config,
        plexYoutubeLibraryId: id,
      });
    }
    closeLibrarySelector();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const parsedValue =
      name === 'channelFilesToDownload' ? Number(value) : value;
    setConfig({
      ...config,
      [name]: parsedValue as any,
    });

    // Track YouTube directory changes
    if (name === 'youtubeOutputDirectory' && value !== originalYoutubeDirectory) {
      setYoutubeDirectoryChanged(true);
    } else if (name === 'youtubeOutputDirectory' && value === originalYoutubeDirectory) {
      setYoutubeDirectoryChanged(false);
    }

    // Mark Plex connection as not tested if IP or API key changes
    if (name === 'plexIP' || name === 'plexApiKey') {
      setPlexConnectionStatus('not_tested');
    }
  };

  const handleChannelFilesChange = (event: SelectChangeEvent<number>) => {
    setConfig({
      ...config,
      channelFilesToDownload: event.target.value as number,
    });
  };

  // Generate options for channel files dropdown
  const getChannelFilesOptions = () => {
    const options = [];
    // Always include 1-10
    for (let i = 1; i <= 10; i++) {
      options.push(i);
    }
    // If current value is greater than 10, include it as well
    if (config.channelFilesToDownload > 10 && !options.includes(config.channelFilesToDownload)) {
      options.push(config.channelFilesToDownload);
      options.sort((a, b) => a - b);
    }
    return options;
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.checked,
    });
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/updateconfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || '',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        // Update initial snapshot to current config so unsaved flag resets
        setInitialConfig(config);

        // Show different message if YouTube directory changed
        if (youtubeDirectoryChanged) {
          setSnackbar({
            open: true,
            message: 'Configuration saved! Please restart Youtarr for YouTube directory changes to take effect.',
            severity: 'warning'
          });
          setYoutubeDirectoryChanged(false);
          setOriginalYoutubeDirectory(config.youtubeOutputDirectory);
        } else {
          setSnackbar({
            open: true,
            message: 'Configuration saved successfully',
            severity: 'success'
          });
        }

        // Re-check Plex connection if IP changed
        if (config.plexIP) {
          checkPlexConnection();
        }
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error'
      });
    }
  };

  const handlePlexAuthSuccess = (apiKey: string) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      plexApiKey: apiKey
    }));
    setPlexConnectionStatus('not_tested');
    setSnackbar({
      open: true,
      message: 'Plex API Key obtained successfully! Click "Test Connection" to verify and save.',
      severity: 'success'
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      setSnackbar({
        open: true,
        message: 'Passwords do not match',
        severity: 'error'
      });
      return;
    }

    if (newPassword.length < 8) {
      setSnackbar({
        open: true,
        message: 'Password must be at least 8 characters',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await axios.post('/auth/change-password', {
        currentPassword,
        newPassword
      }, {
        headers: {
          'x-access-token': token || '',
        }
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: 'Password updated successfully',
          severity: 'success'
        });
        setShowPasswordChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to update password',
        severity: 'error'
      });
    }
  };

  const handleOpenConfirmDialog = () => {
    setOpenConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    setOpenConfirmDialog(false);
    saveConfig();
  };

  const frequencyMapping: { [key: string]: string } = {
    'Every 15 minutes': '*/15 * * * *',
    'Every 30 minutes': '*/30 * * * *',
    Hourly: '0 * * * *',
    'Every 4 hours': '0 */4 * * *',
    'Every 12 hours': '0 */12 * * *',
    Daily: '0 0 * * *',
    Weekly: '0 0 * * 0',
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

  // Compute hasUnsavedChanges from a snapshot of initial config
  useEffect(() => {
    if (!initialConfig) {
      setHasUnsavedChanges(false);
      return;
    }
    const keysToCompare: (keyof typeof config)[] = [
      'channelAutoDownload',
      'channelDownloadFrequency',
      'channelFilesToDownload',
      'preferredResolution',
      'plexApiKey',
      'youtubeOutputDirectory',
      'plexYoutubeLibraryId',
      'plexIP',
    ];
    const changed = keysToCompare.some((k) => {
      return (config as any)[k] !== (initialConfig as any)[k];
    });
    setHasUnsavedChanges(changed);
  }, [config, initialConfig]);

  const reverseFrequencyMapping = (cronExpression: string): string => {
    for (const [key, value] of Object.entries(frequencyMapping)) {
      if (value === cronExpression) {
        return key;
      }
    }
    return cronExpression; // Return the cron expression if no match found
  };

  const currentFrequency = reverseFrequencyMapping(
    config.channelDownloadFrequency
  );

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
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Core Settings
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Required settings for YouTube video downloads
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    YouTube Output Directory
                    {getInfoIcon('The directory path to your Plex Youtube library. If you update this you must restart your docker container. Manually update this field at your own risk!')}
                  </Box>
                }
                name="youtubeOutputDirectory"
                value={config.youtubeOutputDirectory}
                onChange={handleInputChange}
                required
                helperText={youtubeDirectoryChanged
                  ? "⚠️ RESTART REQUIRED after saving - Directory has been changed!"
                  : "Path where YouTube videos will be saved"}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="channelAutoDownload"
                      checked={config.channelAutoDownload}
                      onChange={handleCheckboxChange}
                    />
                  }
                  label="Enable Automatic Downloads"
                />
                {getInfoIcon('Check to enable automatic scheduled downloading of videos from your Channels.')}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl fullWidth>
                  <InputLabel>Download Frequency</InputLabel>
                  <Select
                    value={currentFrequency}
                    onChange={(e: SelectChangeEvent<string>) =>
                      handleSelectChange(e as any, 'channelDownloadFrequency')
                    }
                    label="Download Frequency"
                    disabled={!config.channelAutoDownload}
                  >
                    {Object.keys(frequencyMapping).map((key) => (
                      <MenuItem key={key} value={key}>
                        {key}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {getInfoIcon('How often to run automatic channel video downloads.')}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl fullWidth>
                  <InputLabel>Files to Download per Channel</InputLabel>
                  <Select
                    value={config.channelFilesToDownload}
                    onChange={handleChannelFilesChange}
                    label="Files to Download per Channel"
                  >
                    {getChannelFilesOptions().map(count => (
                      <MenuItem key={count} value={count}>
                        {count} {count === 1 ? 'video' : 'videos'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {getInfoIcon('How many videos (starting from the most recent) should be downloaded for each channel when channel downloads are initiated.')}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl fullWidth>
                  <InputLabel>Preferred Resolution</InputLabel>
                  <Select
                    value={config.preferredResolution}
                    onChange={(e: SelectChangeEvent<string>) =>
                      setConfig({ ...config, preferredResolution: e.target.value })
                    }
                    label="Preferred Resolution"
                  >
                    <MenuItem value="2160">4K (2160p)</MenuItem>
                    <MenuItem value="1440">1440p</MenuItem>
                    <MenuItem value="1080">1080p</MenuItem>
                    <MenuItem value="720">720p</MenuItem>
                    <MenuItem value="480">480p</MenuItem>
                  </Select>
                </FormControl>
                {getInfoIcon('The resolution we will try to download from YouTube. Note that this is not guaranteed as YouTube may not have your preferred resolution available.')}
              </Box>
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Optional: Plex Media Server Integration
          </Typography>
          <Chip
            label={
              plexConnectionStatus === 'connected' ? "Connected" :
              plexConnectionStatus === 'not_connected' ? "Not Connected" :
              plexConnectionStatus === 'testing' ? "Testing..." :
              "Not Tested"
            }
            color={
              plexConnectionStatus === 'connected' ? "success" :
              plexConnectionStatus === 'not_connected' ? "error" :
              plexConnectionStatus === 'testing' ? "info" :
              "warning"
            }
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Plex Integration is Optional</AlertTitle>
            <Typography variant="body2">
              Youtarr works perfectly without Plex! Plex integration only provides:
              <br />• Automatic library refresh after downloads
              <br />• Direct library selection from Plex server
              <br /><br />
              If you don't use Plex, your videos will still download to your specified directory.
            </Typography>
          </Alert>

          {plexConnectionStatus === 'not_connected' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Unable to connect to Plex server. Library refresh will not work.
              Please check your IP and API key, then click "Test Connection".
            </Alert>
          )}

          {plexConnectionStatus === 'not_tested' && config.plexIP && config.plexApiKey && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Plex configuration has changed. Click "Test Connection" to verify your settings.
            </Alert>
          )}

          {(!config.plexIP || !config.plexApiKey) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter both Plex IP and API Key to enable Plex integration.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Plex Server IP
                    {getInfoIcon("The IP address of your Plex server. 'localhost' if you're on the same machine running in dev mode. 'host.docker.internal' for production Docker on the same machine. You can also use your public IP for your Plex server.")}
                  </Box>
                }
                name="plexIP"
                value={config.plexIP}
                onChange={handleInputChange}
                helperText="e.g., 192.168.1.100 or host.docker.internal"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label="Plex API Key"
                    name="plexApiKey"
                    value={config.plexApiKey}
                    onChange={handleInputChange}
                  />
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setOpenPlexAuthDialog(true)}
                    sx={{
                      minWidth: '120px',
                      height: '56px',
                      fontWeight: 'bold'
                    }}
                    startIcon={<InfoIcon />}
                  >
                    Get Key
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  {getInfoIcon('Click "Get Key" to automatically obtain your Plex API key by logging into Plex, or enter it manually.')}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    <a
                      href="https://www.plexopedia.com/plex-media-server/general/plex-token/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit' }}
                    >
                      Manual instructions
                    </a>
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={testPlexConnection}
                  disabled={!config.plexIP || !config.plexApiKey || plexConnectionStatus === 'testing'}
                  color={plexConnectionStatus === 'connected' ? 'success' : 'primary'}
                >
                  {plexConnectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={openLibrarySelector}
                  disabled={plexConnectionStatus !== 'connected'}
                >
                  Select Plex Library
                </Button>
                {getInfoIcon('Test Connection will verify and auto-save your Plex credentials if successful.')}
              </Box>
              {config.plexYoutubeLibraryId && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected Library ID: {config.plexYoutubeLibraryId}
                </Typography>
              )}
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Account & Security
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Change Password
            </Typography>

            {!showPasswordChange ? (
              <Button
                variant="outlined"
                onClick={() => setShowPasswordChange(true)}
              >
                Change Password
              </Button>
            ) : (
              <Box component="form" onSubmit={handlePasswordChange}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  margin="normal"
                  required
                  helperText="Minimum 8 characters"
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  margin="normal"
                  required
                  error={confirmNewPassword !== '' && newPassword !== confirmNewPassword}
                  helperText={
                    confirmNewPassword !== '' && newPassword !== confirmNewPassword
                      ? "Passwords don't match"
                      : ''
                  }
                />
                <Box sx={{ mt: 2 }}>
                  <Button type="submit" variant="contained" sx={{ mr: 1 }}>
                    Update Password
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Spacer to prevent content from being hidden behind the fixed save bar */}
      <Box sx={{ height: youtubeDirectoryChanged ? { xs: 160, sm: 120 } : { xs: 88, sm: 80 } }} />

      {/* Fixed bottom save bar */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          zIndex: (theme) => theme.zIndex.drawer + 2,
        }}
      >
        {youtubeDirectoryChanged && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            <AlertTitle>Restart Required</AlertTitle>
            YouTube output directory has been changed. After saving your configuration, you will need to RESTART Youtarr for the changes to take effect!
          </Alert>
        )}
        <Button
          variant="contained"
          color={hasUnsavedChanges ? 'warning' : 'primary'}
          onClick={config.initialSetup ? handleOpenConfirmDialog : saveConfig}
          size="large"
          sx={{
            width: { xs: '100%', sm: '500px' },
            mx: 'auto',
            display: 'block',
            animation: hasUnsavedChanges ? 'pulse 1.5s infinite' : 'none',
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 0 0 0 rgba(237, 108, 2, 0.7)',
              },
              '70%': {
                boxShadow: '0 0 0 10px rgba(237, 108, 2, 0)',
              },
              '100%': {
                boxShadow: '0 0 0 0 rgba(237, 108, 2, 0)',
              },
            },
          }}
        >
          {hasUnsavedChanges ? 'Save Configuration (Unsaved Changes)' : 'Save Configuration'}
        </Button>
      </Box>

      <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)}>
        <DialogTitle>
          Confirm Save Configuration
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmSave} autoFocus>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      <PlexLibrarySelector
        open={openPlexLibrarySelector}
        handleClose={closeLibrarySelector}
        setLibraryId={setLibraryId}
        token={token}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={mobileTooltip !== null}
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

      <PlexAuthDialog
        open={openPlexAuthDialog}
        onClose={() => setOpenPlexAuthDialog(false)}
        onSuccess={handlePlexAuthSuccess}
        currentApiKey={config.plexApiKey}
      />
    </>
  );
}

export default Configuration;
