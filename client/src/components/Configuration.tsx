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
  Switch,
  FormHelperText,
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
    sponsorblockEnabled: false,
    sponsorblockAction: 'remove' as 'remove' | 'mark',
    sponsorblockCategories: {
      sponsor: true,
      intro: false,
      outro: false,
      selfpromo: true,
      preview: false,
      filler: false,
      interaction: false,
      music_offtopic: false,
    },
    sponsorblockApiUrl: '',
    downloadSocketTimeoutSeconds: 30,
    downloadThrottledRate: '100K',
    downloadRetryCount: 2,
    enableStallDetection: true,
    stallDetectionWindowSeconds: 30,
    stallDetectionRateThreshold: '100K',
    cookiesEnabled: false,
    customCookiesUploaded: false,
  });
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);
  const [openPlexAuthDialog, setOpenPlexAuthDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [plexConnectionStatus, setPlexConnectionStatus] = useState<'connected' | 'not_connected' | 'not_tested' | 'testing'>('not_tested');
  const [isPlatformManaged, setIsPlatformManaged] = useState({
    youtubeOutputDirectory: false,
    plexUrl: false,
    authEnabled: true
  });
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
  const [cookieStatus, setCookieStatus] = useState<{
    cookiesEnabled: boolean;
    customCookiesUploaded: boolean;
    customFileExists: boolean;
  } | null>(null);
  const [uploadingCookie, setUploadingCookie] = useState(false);
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
        if (data.isPlatformManaged) {
          setIsPlatformManaged(data.isPlatformManaged);
          delete data.isPlatformManaged;
        }
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

  // Fetch cookie status
  useEffect(() => {
    if (token) {
      fetch('/api/cookies/status', {
        headers: {
          'x-access-token': token,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setCookieStatus(data);
        })
        .catch((error) => console.error('Error fetching cookie status:', error));
    }
  }, [token]);

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

  const handleCookieUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCookie(true);
    const formData = new FormData();
    formData.append('cookieFile', file);

    try {
      const response = await fetch('/api/cookies/upload', {
        method: 'POST',
        headers: {
          'x-access-token': token || '',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setCookieStatus(data.cookieStatus);
        setConfig(prev => ({
          ...prev,
          cookiesEnabled: data.cookieStatus.cookiesEnabled,
          customCookiesUploaded: data.cookieStatus.customCookiesUploaded,
        }));
        setSnackbar({
          open: true,
          message: 'Cookie file uploaded successfully',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to upload cookie file',
          severity: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to upload cookie file',
        severity: 'error'
      });
    } finally {
      setUploadingCookie(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDeleteCookies = async () => {
    try {
      const response = await fetch('/api/cookies', {
        method: 'DELETE',
        headers: {
          'x-access-token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCookieStatus(data.cookieStatus);
        setConfig(prev => ({
          ...prev,
          customCookiesUploaded: false,
        }));
        setSnackbar({
          open: true,
          message: 'Custom cookies deleted',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to delete cookies');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete cookies',
        severity: 'error'
      });
    }
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
      'sponsorblockEnabled',
      'sponsorblockAction',
      'sponsorblockCategories',
      'sponsorblockApiUrl',
      'downloadSocketTimeoutSeconds',
      'downloadThrottledRate',
      'downloadRetryCount',
      'enableStallDetection',
      'stallDetectionWindowSeconds',
      'stallDetectionRateThreshold',
      'cookiesEnabled',
      'customCookiesUploaded',
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
                    {isPlatformManaged.youtubeOutputDirectory ? (
                      <Chip
                        label="Platform Managed"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    ) : (
                      getInfoIcon('The directory path to your Plex Youtube library. If you update this you must restart your docker container. Manually update this field at your own risk!')
                    )}
                  </Box>
                }
                name="youtubeOutputDirectory"
                value={config.youtubeOutputDirectory}
                onChange={handleInputChange}
                required
                disabled={isPlatformManaged.youtubeOutputDirectory}
                helperText={
                  isPlatformManaged.youtubeOutputDirectory
                    ? "This path is configured by your platform deployment and cannot be changed"
                    : youtubeDirectoryChanged
                      ? "⚠️ RESTART REQUIRED after saving - Directory has been changed!"
                      : "Path where YouTube videos will be saved"
                }
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
                    {isPlatformManaged.plexUrl ? (
                      <Chip
                        label="Platform Managed"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    ) : (
                      getInfoIcon("The IP address of your Plex server. 'localhost' if you're on the same machine running in dev mode. 'host.docker.internal' for production Docker on the same machine. You can also use your public IP for your Plex server.")
                    )}
                  </Box>
                }
                name="plexIP"
                value={config.plexIP}
                onChange={handleInputChange}
                disabled={isPlatformManaged.plexUrl}
                helperText={isPlatformManaged.plexUrl
                  ? "Plex URL is configured by your platform deployment"
                  : "e.g., 192.168.1.100 or host.docker.internal"}
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

      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Optional: SponsorBlock Integration
          </Typography>
          <Chip
            label={config.sponsorblockEnabled ? "Enabled" : "Disabled"}
            color={config.sponsorblockEnabled ? "success" : "default"}
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>What is SponsorBlock?</AlertTitle>
            <Typography variant="body2">
              SponsorBlock is a crowdsourced database that identifies segments in YouTube videos like sponsors, intros, outros, and self-promotions.
              When enabled, Youtarr can automatically remove or mark these segments during download.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="sponsorblockEnabled"
                    checked={config.sponsorblockEnabled}
                    onChange={(e) => setConfig({ ...config, sponsorblockEnabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Enable SponsorBlock
                    {getInfoIcon('Automatically handle sponsored segments and other marked content in downloaded videos.')}
                  </Box>
                }
              />
            </Grid>

            {config.sponsorblockEnabled && (
              <>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Action for Segments</InputLabel>
                    <Select
                      value={config.sponsorblockAction}
                      onChange={(e) => setConfig({ ...config, sponsorblockAction: e.target.value as 'remove' | 'mark' })}
                      label="Action for Segments"
                    >
                      <MenuItem value="remove">Remove segments from video</MenuItem>
                      <MenuItem value="mark">Mark segments as chapters</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Remove: Cuts out segments entirely. Mark: Creates chapter markers for easy skipping.
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Custom API URL (Optional)"
                    name="sponsorblockApiUrl"
                    value={config.sponsorblockApiUrl}
                    onChange={(e) => setConfig({ ...config, sponsorblockApiUrl: e.target.value })}
                    placeholder="https://sponsor.ajay.app"
                    helperText="Leave empty to use the default SponsorBlock API"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 1, mb: 1 }}>
                    Segment Categories to {config.sponsorblockAction === 'remove' ? 'Remove' : 'Mark'}:
                  </Typography>

                  <Grid container spacing={1}>
                    {[
                      { key: 'sponsor', label: 'Sponsor', description: 'Paid promotions, product placements' },
                      { key: 'intro', label: 'Intro', description: 'Opening sequences, title cards' },
                      { key: 'outro', label: 'Outro', description: 'End cards, credits' },
                      { key: 'selfpromo', label: 'Self-Promotion', description: 'Channel merch, Patreon, other videos' },
                      { key: 'preview', label: 'Preview/Recap', description: '"Coming up" or "Previously on" segments' },
                      { key: 'filler', label: 'Filler', description: 'Tangential content, dead space' },
                      { key: 'interaction', label: 'Interaction', description: '"Like and subscribe" reminders' },
                      { key: 'music_offtopic', label: 'Music Off-Topic', description: 'Non-music content in music videos' },
                    ].map(({ key, label, description }) => (
                      <Grid item xs={12} sm={6} key={key}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.sponsorblockCategories[key as keyof typeof config.sponsorblockCategories]}
                              onChange={(e) => setConfig({
                                ...config,
                                sponsorblockCategories: {
                                  ...config.sponsorblockCategories,
                                  [key]: e.target.checked
                                }
                              })}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">{label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {description}
                              </Typography>
                            </Box>
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cookie Configuration
          </Typography>
          <Chip
            label={config.cookiesEnabled ? "Cookies Enabled" : "Cookies Disabled"}
            color={config.cookiesEnabled ? "success" : "default"}
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Security Warning</AlertTitle>
            <Typography variant="body2" paragraph>
              Cookie files contain authentication information for your Google account.
              We strongly recommend using a throwaway account instead of your main account.
            </Typography>
            <Typography variant="body2">
              Learn more about cookie security:{' '}
              <a href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
                 target="_blank"
                 rel="noopener noreferrer"
                 style={{ color: 'inherit', textDecoration: 'underline' }}>
                yt-dlp Cookie FAQ
              </a>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Cookies help bypass YouTube's bot detection. If you encounter "Sign in to confirm you're not a bot" errors,
              enabling cookies can resolve the issue.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.cookiesEnabled}
                    onChange={(e) => setConfig({ ...config, cookiesEnabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Enable Cookies
                    {getInfoIcon('Use cookies to bypass YouTube bot detection and access age-restricted content.')}
                  </Box>
                }
              />
            </Grid>

            {config.cookiesEnabled && (
              <>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button
                        variant="contained"
                        component="label"
                        disabled={uploadingCookie}
                      >
                        {uploadingCookie ? 'Uploading...' : 'Upload Cookie File'}
                        <input
                          type="file"
                          hidden
                          accept=".txt,text/plain"
                          onChange={handleCookieUpload}
                        />
                      </Button>
                      {cookieStatus?.customFileExists && (
                        <>
                          <Chip
                            label="Custom cookies uploaded"
                            color="success"
                            size="small"
                          />
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={handleDeleteCookies}
                          >
                            Delete Custom Cookies
                          </Button>
                        </>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Upload a Netscape format cookie file exported from your browser.
                      File must be less than 1MB.
                    </Typography>
                  </Box>
                </Grid>

                {cookieStatus && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Status: {cookieStatus.customFileExists ?
                        'Using custom cookies' :
                        'No cookie file uploaded'}
                    </Typography>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Download Performance Settings
          </Typography>
          <Chip
            label={config.enableStallDetection ? "Stall Detection On" : "Stall Detection Off"}
            color={config.enableStallDetection ? "success" : "default"}
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Performance Optimization</AlertTitle>
            <Typography variant="body2">
              Configure download timeouts, retry attempts, and stall detection to handle slow or interrupted downloads automatically.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Socket Timeout</InputLabel>
                <Select
                  value={config.downloadSocketTimeoutSeconds ?? 30}
                  onChange={(e) => setConfig({ ...config, downloadSocketTimeoutSeconds: Number(e.target.value) })}
                  label="Socket Timeout"
                >
                  <MenuItem value={5}>5 seconds</MenuItem>
                  <MenuItem value={10}>10 seconds</MenuItem>
                  <MenuItem value={20}>20 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                </Select>
                <FormHelperText>
                  Connection timeout for each download attempt
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Throttled Rate Detection</InputLabel>
                <Select
                  value={config.downloadThrottledRate ?? '100K'}
                  onChange={(e) => setConfig({ ...config, downloadThrottledRate: e.target.value })}
                  label="Throttled Rate Detection"
                >
                  <MenuItem value="20K">20 KB/s</MenuItem>
                  <MenuItem value="50K">50 KB/s</MenuItem>
                  <MenuItem value="100K">100 KB/s</MenuItem>
                  <MenuItem value="250K">250 KB/s</MenuItem>
                  <MenuItem value="500K">500 KB/s</MenuItem>
                  <MenuItem value="1M">1 MB/s</MenuItem>
                  <MenuItem value="2M">2 MB/s</MenuItem>
                </Select>
                <FormHelperText>
                  Minimum speed before considering download throttled
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Download Retries</InputLabel>
                <Select
                  value={config.downloadRetryCount ?? 2}
                  onChange={(e) => setConfig({ ...config, downloadRetryCount: Number(e.target.value) })}
                  label="Download Retries"
                >
                  <MenuItem value={0}>No retries</MenuItem>
                  <MenuItem value={1}>1 retry</MenuItem>
                  <MenuItem value={2}>2 retries</MenuItem>
                  <MenuItem value={3}>3 retries</MenuItem>
                </Select>
                <FormHelperText>
                  Number of retry attempts for failed downloads
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableStallDetection !== false}
                    onChange={(e) => setConfig({ ...config, enableStallDetection: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Enable Stall Detection
                    {getInfoIcon('Automatically detect and retry downloads that stall at slow speeds')}
                  </Box>
                }
              />
            </Grid>

            {config.enableStallDetection && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Stall Detection Window (seconds)"
                    type="number"
                    inputProps={{ min: 5, max: 120, step: 5 }}
                    value={config.stallDetectionWindowSeconds ?? 30}
                    onChange={(e) => setConfig({ ...config, stallDetectionWindowSeconds: Number(e.target.value) })}
                    helperText="How long the download must stay below the stall threshold before retry logic kicks in"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Stall Threshold Rate</InputLabel>
                    <Select
                      value={config.stallDetectionRateThreshold ?? config.downloadThrottledRate ?? '100K'}
                      onChange={(e) => setConfig({ ...config, stallDetectionRateThreshold: e.target.value })}
                      label="Stall Threshold Rate"
                    >
                      <MenuItem value="20K">20 KB/s</MenuItem>
                      <MenuItem value="50K">50 KB/s</MenuItem>
                      <MenuItem value="100K">100 KB/s</MenuItem>
                      <MenuItem value="250K">250 KB/s</MenuItem>
                      <MenuItem value="500K">500 KB/s</MenuItem>
                      <MenuItem value="1M">1 MB/s</MenuItem>
                      <MenuItem value="2M">2 MB/s</MenuItem>
                    </Select>
                    <FormHelperText>
                      Speed threshold for stall detection (defaults to throttled rate)
                    </FormHelperText>
                  </FormControl>
                </Grid>
              </>
            )}
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
