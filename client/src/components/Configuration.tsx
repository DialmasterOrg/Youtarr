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
import SubtitleLanguageSelector from './Configuration/SubtitleLanguageSelector';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import { Skeleton, CircularProgress } from '@mui/material';

interface ConfigurationProps {
  token: string | null;
}

interface PlexPathSuggestionState {
  libraryTitle: string;
  originalPath: string;
  suggestedPath?: string;
  note: string;
  canApply: boolean;
  severity: 'info' | 'warning';
}

interface AutoRemovalDryRunVideoSummary {
  id: number;
  youtubeId: string;
  title: string;
  channel: string;
  fileSize: number;
  timeCreated: string | null;
}

interface AutoRemovalDryRunPlanStrategy {
  enabled: boolean;
  thresholdDays?: number | null;
  threshold?: string | null;
  thresholdBytes?: number | null;
  candidateCount: number;
  estimatedFreedBytes: number;
  deletedCount: number;
  failedCount: number;
  needsCleanup?: boolean;
  iterations?: number;
  storageStatus?: {
    availableGB: string;
    totalGB: string;
    percentFree: number;
    percentUsed: number;
  } | null;
  sampleVideos: AutoRemovalDryRunVideoSummary[];
}

interface AutoRemovalDryRunResult {
  dryRun: boolean;
  success: boolean;
  errors: string[];
  plan: {
    ageStrategy: AutoRemovalDryRunPlanStrategy;
    spaceStrategy: AutoRemovalDryRunPlanStrategy;
  };
  simulationTotals: {
    byAge: number;
    bySpace: number;
    total: number;
    estimatedFreedBytes: number;
  } | null;
}

function Configuration({ token }: ConfigurationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState({
    channelAutoDownload: false,
    channelDownloadFrequency: '',
    channelFilesToDownload: 3,
    preferredResolution: '1080',
    videoCodec: 'default',
    initialSetup: true,
    plexApiKey: '',
    youtubeOutputDirectory: '',
    plexYoutubeLibraryId: '',
    plexIP: '',
    plexPort: '32400',
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
    writeChannelPosters: true,
    writeVideoNfoFiles: true,
    notificationsEnabled: false,
    notificationService: 'discord',
    discordWebhookUrl: '',
    autoRemovalEnabled: false,
    autoRemovalFreeSpaceThreshold: '',
    autoRemovalVideoAgeThreshold: '',
    useTmpForDownloads: false,
    tmpFilePath: '/tmp/youtarr-downloads',
    subtitlesEnabled: false,
    subtitleLanguage: 'en',
  });
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);
  const [openPlexAuthDialog, setOpenPlexAuthDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [plexConnectionStatus, setPlexConnectionStatus] = useState<'connected' | 'not_connected' | 'not_tested' | 'testing'>('not_tested');
  const [isPlatformManaged, setIsPlatformManaged] = useState({
    youtubeOutputDirectory: false,
    plexUrl: false,
    authEnabled: true,
    useTmpForDownloads: false
  });
  const [deploymentEnvironment, setDeploymentEnvironment] = useState<{
    inDocker: boolean;
    dockerAutoCreated: boolean;
    platform?: string | null;
    isWsl: boolean;
  }>({
    inDocker: false,
    dockerAutoCreated: false,
    platform: null,
    isWsl: false,
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
  const [testingNotification, setTestingNotification] = useState(false);
  const [autoRemovalDryRun, setAutoRemovalDryRun] = useState<{
    loading: boolean;
    result: AutoRemovalDryRunResult | null;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null
  });
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const hasPlexServerConfigured = isPlatformManaged.plexUrl || Boolean(config.plexIP);
  const [plexPathSuggestion, setPlexPathSuggestion] = useState<PlexPathSuggestionState | null>(null);
  const canApplyPlexSuggestion = !!(
    plexPathSuggestion &&
    plexPathSuggestion.canApply &&
    !isPlatformManaged.youtubeOutputDirectory &&
    !deploymentEnvironment.dockerAutoCreated
  );
  const showAccountSection = isPlatformManaged.authEnabled !== false;
  const autoRemovalHasStrategy = Boolean(config.autoRemovalFreeSpaceThreshold) || Boolean(config.autoRemovalVideoAgeThreshold);

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
        if (data.deploymentEnvironment) {
          const env = data.deploymentEnvironment;
          setDeploymentEnvironment({
            inDocker: !!env.inDocker,
            dockerAutoCreated: !!env.dockerAutoCreated,
            platform: env.platform ?? null,
            isWsl: !!env.isWsl
          });
          delete data.deploymentEnvironment;
        } else {
          setDeploymentEnvironment({
            inDocker: false,
            dockerAutoCreated: false,
            platform: null,
            isWsl: false
          });
        }
        const resolvedConfig = {
          ...data,
          writeChannelPosters: data.writeChannelPosters ?? true,
          writeVideoNfoFiles: data.writeVideoNfoFiles ?? true,
          plexPort: data.plexPort ? String(data.plexPort) : '32400'
        };
        setConfig(resolvedConfig);
        setPlexPathSuggestion(null);
        setOriginalYoutubeDirectory(resolvedConfig.youtubeOutputDirectory || '');
        setInitialConfig(resolvedConfig);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setIsLoading(false);
      });
  }, [token]);

  const checkPlexConnection = React.useCallback(() => {
    if (hasPlexServerConfigured) {
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
  }, [hasPlexServerConfigured, token]);

  // On first load after config arrives, check Plex connection if values exist
  useEffect(() => {
    if (!didInitialPlexCheck && hasPlexServerConfigured && config.plexApiKey) {
      checkPlexConnection();
      setDidInitialPlexCheck(true);
    }
  }, [didInitialPlexCheck, hasPlexServerConfigured, config.plexApiKey, checkPlexConnection]);

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

  // Fetch storage status to determine if space-based auto-removal is available
  useEffect(() => {
    if (token) {
      fetch('/storage-status', {
        headers: {
          'x-access-token': token,
        },
      })
        .then((response) => {
          if (!response.ok) {
            setStorageAvailable(false);
            return;
          }
          return response.json();
        })
        .then((data) => {
          if (data && data.availableGB !== undefined) {
            setStorageAvailable(true);
          } else {
            setStorageAvailable(false);
          }
        })
        .catch((error) => {
          console.error('Error fetching storage status:', error);
          setStorageAvailable(false);
        });
    }
  }, [token]);

  useEffect(() => {
    setAutoRemovalDryRun((prev) => {
      if (prev.loading) {
        return prev;
      }
      if (!prev.result && !prev.error) {
        return prev;
      }
      return {
        loading: false,
        result: null,
        error: null
      };
    });
  }, [
    config.autoRemovalEnabled,
    config.autoRemovalFreeSpaceThreshold,
    config.autoRemovalVideoAgeThreshold
  ]);

  const testPlexConnection = async () => {
    if (!hasPlexServerConfigured) {
      setSnackbar({
        open: true,
        message: 'Please enter your Plex server address before testing the connection.',
        severity: 'warning'
      });
      return;
    }

    if (!config.plexApiKey) {
      setSnackbar({
        open: true,
        message: 'Please enter your Plex API Key',
        severity: 'warning'
      });
      return;
    }

    const rawPortInput = (config.plexPort ?? '').toString().trim();
    const digitsOnlyPort = rawPortInput.replace(/[^0-9]/g, '');
    let normalizedPort = '32400';

    if (digitsOnlyPort.length > 0) {
      const portNumber = Number.parseInt(digitsOnlyPort, 10);
      if (!Number.isNaN(portNumber)) {
        const clampedPort = Math.min(65535, Math.max(1, portNumber));
        normalizedPort = String(clampedPort);
      }
    }

    if (config.plexPort !== normalizedPort) {
      setConfig((prev) => ({
        ...prev,
        plexPort: normalizedPort
      }));
    }

    setPlexConnectionStatus('testing');

    try {
      // Send the unsaved form values as query parameters for testing
      const params = new URLSearchParams({
        testApiKey: config.plexApiKey
      });

      if (config.plexIP) {
        params.set('testIP', config.plexIP);
      }

      params.set('testPort', normalizedPort);

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
          prev
            ? { ...prev, plexIP: config.plexIP, plexApiKey: config.plexApiKey, plexPort: normalizedPort }
            : { ...config, plexPort: normalizedPort }
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

  const createPlexPathSuggestion = (
    libraryTitle: string,
    selectedPath: string
  ): PlexPathSuggestionState | null => {
    const trimmed = selectedPath.trim();
    if (!trimmed) {
      return null;
    }

    const baseSuggestion: PlexPathSuggestionState = {
      libraryTitle,
      originalPath: trimmed,
      suggestedPath: undefined,
      note: '',
      canApply: false,
      severity: 'info'
    };

    if (/^\\\\/.test(trimmed)) {
      return {
        ...baseSuggestion,
        note: 'Plex reported a network share (UNC) path. Mount this share inside Youtarr and update the YouTube output directory manually.',
        severity: 'warning'
      };
    }

    const windowsDriveMatch = /^[A-Za-z]:\\/.test(trimmed);
    if (windowsDriveMatch) {
      const drive = trimmed[0].toLowerCase();
      const rest = trimmed.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
      const wslPath = `/mnt/${drive}/${rest}`;
      const dockerHostPath = `/host_mnt/${drive}/${rest}`;

      if (deploymentEnvironment.isWsl) {
        return {
          ...baseSuggestion,
          suggestedPath: wslPath,
          note: 'Converted Windows drive path for WSL. Ensure the drive is mounted (e.g., /mnt/q) before applying.',
          canApply: true,
          severity: 'info'
        };
      }

      if (deploymentEnvironment.inDocker) {
        return {
          ...baseSuggestion,
          suggestedPath: dockerHostPath,
          note: 'Plex reported a Windows drive path. Docker Desktop usually mounts drives under /host_mnt/<drive>/. Adjust the path if your bind mount differs before applying.',
          canApply: true,
          severity: 'warning'
        };
      }

      return {
        ...baseSuggestion,
        suggestedPath: trimmed,
        note: 'Plex reported a Windows path. If Youtarr runs directly on Windows you can apply it as-is; otherwise translate it to the mount that Youtarr can reach.',
        canApply: true,
        severity: 'warning'
      };
    }

    if (trimmed.includes('\\')) {
      return {
        ...baseSuggestion,
        note: 'Plex returned a Windows-style path. Replace backslashes with the path visible to Youtarr before saving.',
        severity: 'warning'
      };
    }

    if (trimmed.startsWith('/')) {
      return {
        ...baseSuggestion,
        suggestedPath: trimmed,
        note: 'Plex returned a Unix-style path. Ensure this folder exists inside Youtarr before applying.',
        canApply: true,
        severity: 'info'
      };
    }

    return {
      ...baseSuggestion,
      note: 'Plex returned an unrecognized path format. Update the YouTube output directory manually after selecting the library.',
      severity: 'warning'
    };
  };

  const setLibraryId = ({
    libraryId,
    libraryTitle,
    selectedPath
  }: {
    libraryId: string;
    libraryTitle: string;
    selectedPath: string;
  }) => {
    setConfig((prev) => ({
      ...prev,
      plexYoutubeLibraryId: libraryId,
    }));

    if (selectedPath) {
      setPlexPathSuggestion(
        createPlexPathSuggestion(libraryTitle, selectedPath)
      );
    } else {
      setPlexPathSuggestion(null);
    }

    closeLibrarySelector();
  };

  const applyPlexPathSuggestion = () => {
    if (!plexPathSuggestion || !plexPathSuggestion.suggestedPath) {
      setPlexPathSuggestion(null);
      return;
    }

    const targetPath = plexPathSuggestion.suggestedPath;
    setConfig((prev) => ({
      ...prev,
      youtubeOutputDirectory: targetPath
    }));
    setYoutubeDirectoryChanged(targetPath !== originalYoutubeDirectory);
    setPlexPathSuggestion(null);
    setSnackbar({
      open: true,
      message: `Updated YouTube directory to ${targetPath}`,
      severity: 'success'
    });
  };

  const dismissPlexPathSuggestion = () => {
    setPlexPathSuggestion(null);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    let parsedValue: any = value;

    if (name === 'channelFilesToDownload') {
      parsedValue = Number(value);
    } else if (name === 'plexPort') {
      const digitsOnly = value.replace(/[^0-9]/g, '');
      if (digitsOnly.length === 0) {
        parsedValue = '';
      } else {
        const numericPort = Math.min(65535, Math.max(1, Number.parseInt(digitsOnly, 10)));
        parsedValue = String(numericPort);
      }
    }

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

    if (name === 'youtubeOutputDirectory' && plexPathSuggestion) {
      setPlexPathSuggestion(null);
    }

    // Mark Plex connection as not tested if IP or API key changes
    if (name === 'plexIP' || name === 'plexApiKey' || name === 'plexPort') {
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

  const runAutoRemovalDryRun = async () => {
    setAutoRemovalDryRun({ loading: true, result: null, error: null });

    try {
      const response = await fetch('/api/auto-removal/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || '',
        },
        body: JSON.stringify({
          autoRemovalEnabled: config.autoRemovalEnabled,
          autoRemovalVideoAgeThreshold: config.autoRemovalVideoAgeThreshold || '',
          autoRemovalFreeSpaceThreshold: config.autoRemovalFreeSpaceThreshold || ''
        })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        const message = payload?.error || 'Failed to preview automatic removal';
        throw new Error(message);
      }

      setAutoRemovalDryRun({
        loading: false,
        result: payload as AutoRemovalDryRunResult,
        error: null
      });
    } catch (err: any) {
      setAutoRemovalDryRun({
        loading: false,
        result: null,
        error: err?.message || 'Failed to preview automatic removal'
      });
    }
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
        if (hasPlexServerConfigured) {
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

  const formatBytes = (bytes: number) => {
    if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    const decimals = exponent === 0 ? 0 : exponent === 1 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[exponent]}`;
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
      'videoCodec',
      'plexApiKey',
      'youtubeOutputDirectory',
      'plexYoutubeLibraryId',
      'plexIP',
      'plexPort',
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
      'writeChannelPosters',
      'writeVideoNfoFiles',
      'notificationsEnabled',
      'discordWebhookUrl',
      'autoRemovalEnabled',
      'autoRemovalFreeSpaceThreshold',
      'autoRemovalVideoAgeThreshold',
      'useTmpForDownloads',
      'subtitlesEnabled',
      'subtitleLanguage',
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

  const dryRunPlan = autoRemovalDryRun.result?.plan;
  const dryRunSimulation = autoRemovalDryRun.result?.simulationTotals;
  const dryRunSampleVideos = dryRunPlan
    ? [...(dryRunPlan.ageStrategy.sampleVideos || []), ...(dryRunPlan.spaceStrategy.sampleVideos || [])].slice(0, 5)
    : [];
  const hasDryRunSpaceThreshold = dryRunPlan?.spaceStrategy.thresholdBytes != null;


  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <CircularProgress size={20} sx={{ mr: 2 }} />
          <Typography variant="h6">Loading configuration...</Typography>
        </Box>

        {/* Loading skeleton for Core Settings */}
        <Card elevation={8} sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width={150} height={32} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={250} height={20} sx={{ mb: 2 }} />
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Skeleton variant="rectangular" height={56} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Skeleton variant="rectangular" height={42} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Skeleton variant="rectangular" height={56} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Skeleton variant="rectangular" height={56} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Skeleton variant="rectangular" height={56} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Loading skeleton for Accordions */}
        {[1, 2, 3, 4, 5].map((index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={48}
            sx={{ mb: 2, borderRadius: 1 }}
          />
        ))}

        {/* Loading skeleton for Account & Security */}
        {showAccountSection && (
          <Card elevation={8} sx={{ mb: 2 }}>
            <CardContent>
              <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width={130} height={36} />
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton for Save button */}
        <Box sx={{ height: 88 }} />
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
          <Skeleton
            variant="rectangular"
            height={48}
            sx={{
              width: { xs: '100%', sm: '500px' },
              mx: 'auto',
              borderRadius: 1
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Card elevation={8} sx={{ mb: 2 }}>
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
                        label={deploymentEnvironment.platform?.toLowerCase() === "elfhosted" ? "Managed by Elfhosted" : "Platform Managed"}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    ) : deploymentEnvironment.dockerAutoCreated ? (
                      <Chip
                        label="Docker Volume"
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
                disabled={isPlatformManaged.youtubeOutputDirectory || deploymentEnvironment.dockerAutoCreated}
                helperText={
                  isPlatformManaged.youtubeOutputDirectory
                    ? "This path is configured by your platform deployment and cannot be changed here"
                    : deploymentEnvironment.dockerAutoCreated
                      ? "This path is configured by your Docker volume mount. To change where videos are saved, update the volume mount in your docker-compose.yml file."
                      : youtubeDirectoryChanged
                        ? "⚠️ RESTART REQUIRED after saving - Directory has been changed!"
                        : "Path where YouTube videos will be saved"
                }
              />
              {plexPathSuggestion && (
                <Alert severity={plexPathSuggestion.severity} sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Plex library
                    {plexPathSuggestion.libraryTitle
                      ? ` "${plexPathSuggestion.libraryTitle}"`
                      : ''} reports its media path as{' '}
                    <code>{plexPathSuggestion.originalPath}</code>.
                  </Typography>
                  {plexPathSuggestion.suggestedPath && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Suggested path for Youtarr:{' '}
                      <code>{plexPathSuggestion.suggestedPath}</code>
                    </Typography>
                  )}
                  <Typography variant="body2">{plexPathSuggestion.note}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                    {canApplyPlexSuggestion && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={applyPlexPathSuggestion}
                      >
                        Use Suggested Path
                      </Button>
                    )}
                    <Button
                      variant="text"
                      size="small"
                      onClick={dismissPlexPathSuggestion}
                    >
                      Dismiss
                    </Button>
                  </Box>
                  {plexPathSuggestion.canApply && !canApplyPlexSuggestion && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Output directory changes are managed outside this UI. Update your platform or Docker volume configuration to apply the suggested path.
                    </Typography>
                  )}
                </Alert>
              )}
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
                {getInfoIcon('Globally enable or disable automatic scheduled downloading of videos from your channels. Only tabs that are enabled for your Channels will be checked and downloaded.')}
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
                    label="Videos to Download per Channel Tab"
                  >
                    {getChannelFilesOptions().map(count => (
                      <MenuItem key={count} value={count}>
                        {count} {count === 1 ? 'video' : 'videos'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {getInfoIcon('How many videos (starting from most recently uploaded) Youtarr will attempt to download per tab when channel downloads run. Already downloaded videos will be skipped.')}
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
                    <MenuItem value="360">360p</MenuItem>
                  </Select>
                </FormControl>
                {getInfoIcon('The resolution we will try to download from YouTube. Note that this is not guaranteed as YouTube may not have your preferred resolution available.')}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControl fullWidth>
                    <InputLabel>Preferred Video Codec</InputLabel>
                    <Select
                      value={config.videoCodec}
                      onChange={(e: SelectChangeEvent<string>) =>
                        setConfig({ ...config, videoCodec: e.target.value })
                      }
                      label="Preferred Video Codec"
                    >
                      <MenuItem value="default">Default (No Preference)</MenuItem>
                      <MenuItem value="h264">H.264/AVC (Best Compatibility)</MenuItem>
                      <MenuItem value="h265">H.265/HEVC (Balanced)</MenuItem>
                    </Select>
                  </FormControl>
                  {getInfoIcon('Select your preferred video codec. Youtarr will download this codec when available, and fall back to other codecs if your preference is not available for a video. H.264 is recommended for Apple TV and maximum device compatibility. VP9 is the default codec for most YouTube videos.')}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Note: H.264 produces larger file sizes but offers maximum compatibility for Apple TV. This is a preference and will fall back to available codecs.
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="useTmpForDownloads"
                      checked={config.useTmpForDownloads}
                      onChange={handleCheckboxChange}
                      disabled={isPlatformManaged.useTmpForDownloads}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Use tmp dir for download processing
                      {isPlatformManaged.useTmpForDownloads && (
                        <Chip
                          label={deploymentEnvironment.platform?.toLowerCase() === "elfhosted" ? "Managed by Elfhosted" : "Platform Managed"}
                          size="small"
                        />
                      )}
                    </Box>
                  }
                />
                {getInfoIcon(
                  isPlatformManaged.useTmpForDownloads
                    ? 'This setting is managed by your platform deployment and cannot be changed.'
                    : 'Downloads to local /tmp first, then moves to final location when complete. Recommended for network-mounted storage (NFS, SMB, cloud mounts) to improve performance and avoid file locking issues with Plex or other processes reading from the same location. Not needed for local drives or SSDs.'
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="subtitlesEnabled"
                      checked={config.subtitlesEnabled}
                      onChange={handleCheckboxChange}
                    />
                  }
                  label="Enable Subtitle Downloads"
                />
                {getInfoIcon('Download subtitles in SRT format when available. Manual subtitles are preferred, with auto-generated subtitles as fallback.')}
              </Box>
            </Grid>

            {config.subtitlesEnabled && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SubtitleLanguageSelector
                    value={config.subtitleLanguage}
                    onChange={(value) => setConfig({ ...config, subtitleLanguage: value })}
                  />
                  {getInfoIcon('Select one or more subtitle languages. Subtitles will be downloaded when available; videos without subtitles will still download successfully.')}
                </Box>
              </Grid>
            )}

          </Grid>
        </CardContent>
      </Card>

      <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
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
            <AlertTitle>Completely Optional Plex Integration</AlertTitle>
            <Typography variant="body2">
              <br />• Automatic library refresh after downloads
              <br />• Direct library selection from Plex server
              <br />
              If you don't use Plex, your videos will still download to your specified directory.
              <br />
              You MUST select a library once connected for automatic refresh to work!
            </Typography>
          </Alert>

          {plexConnectionStatus === 'not_connected' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Unable to connect to Plex server. Library refresh will not work.
              Please check your IP and API key, then click "Test Connection".
            </Alert>
          )}

          {plexConnectionStatus === 'not_tested' && hasPlexServerConfigured && config.plexApiKey && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Plex configuration has changed. Click "Test Connection" to verify your settings.
            </Alert>
          )}

          {(!hasPlexServerConfigured || !config.plexApiKey) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {!hasPlexServerConfigured
                ? 'Enter your Plex server IP to enable Plex integration.'
                : 'Enter your Plex API Key to enable Plex integration.'}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
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
                      getInfoIcon("The IP address of your Plex server. Use 'host.docker.internal' on Docker Desktop (Windows/macOS), or the machine's LAN IP (e.g., 192.168.x.x) when running Docker natively on Linux. You can also use your public IP for your Plex server.")
                    )}
                  </Box>
                }
                name="plexIP"
                value={config.plexIP}
                onChange={handleInputChange}
                disabled={isPlatformManaged.plexUrl}
                helperText={isPlatformManaged.plexUrl
                  ? "Plex URL is configured by your platform deployment"
                  : "e.g., host LAN IP (192.168.x.x) or host.docker.internal (Docker Desktop)"}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Plex Port
                    {getInfoIcon('The TCP port Plex listens on. Defaults to 32400. Update this if you have changed the port in Plex settings or use a reverse proxy mapping.')}
                  </Box>
                }
                name="plexPort"
                value={config.plexPort}
                onChange={handleInputChange}
                disabled={isPlatformManaged.plexUrl}
                inputProps={{ min: 1, max: 65535, step: 1 }}
                helperText={isPlatformManaged.plexUrl
                  ? 'Plex port is configured by your platform deployment'
                  : 'Default: 32400'}
              />
            </Grid>

            <Grid item xs={12} md={4}>
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
                  disabled={!hasPlexServerConfigured || !config.plexApiKey || plexConnectionStatus === 'testing'}
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

      <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
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

    <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Optional: Kodi, Emby and Jellyfin compatibility
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Control generation of metadata and artwork files that help Kodi, Emby and Jellyfin index your downloads cleanly.
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
            For best results:
          </Typography>
          <Typography variant="body2" component="div">
            • Add your download library as Content Type: <strong>Movies</strong>
            <br />
            • Under Metadata Readers/Savers, select <strong>Nfo</strong> to read the .nfo files
            <br />
            • Uncheck all metadata downloaders since we provide metadata via .nfo files
          </Typography>
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset" variant="standard">
              <FormControlLabel
                control={
                  <Switch
                    name="writeVideoNfoFiles"
                    checked={config.writeVideoNfoFiles}
                    onChange={handleCheckboxChange}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Generate video .nfo files
                    {getInfoIcon('Create .nfo metadata alongside each download so Kodi, Emby and Jellyfin can import videos with full details.')}
                  </Box>
                }
              />
              <FormHelperText>
                Recommended when another media server scans your downloads.
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl component="fieldset" variant="standard">
              <FormControlLabel
                control={
                  <Switch
                    name="writeChannelPosters"
                    checked={config.writeChannelPosters}
                    onChange={handleCheckboxChange}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Copy channel poster.jpg files
                    {getInfoIcon('Copy channel thumbnails into each channel folder as poster.jpg for media server compatibility.')}
                  </Box>
                }
              />
              <FormHelperText>
                Helps Kodi, Emby and Jellyfin display artwork for channel folders.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>

    <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
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

      <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Optional: Notifications
          </Typography>
          <Chip
            label={config.notificationsEnabled ? "Enabled" : "Disabled"}
            color={config.notificationsEnabled ? "success" : "default"}
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Get Notified of New Downloads</AlertTitle>
            <Typography variant="body2">
              Receive notifications when new videos are downloaded. Currently supports Discord webhooks.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.notificationsEnabled}
                    onChange={(e) => setConfig({ ...config, notificationsEnabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Enable Notifications
                    {getInfoIcon('Receive notifications when new videos are downloaded successfully.')}
                  </Box>
                }
              />
            </Grid>

            {config.notificationsEnabled && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Discord Webhook URL"
                    name="discordWebhookUrl"
                    value={config.discordWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://discord.com/api/webhooks/..."
                    helperText={
                      <Box component="span">
                        Get your webhook URL from Discord: Server Settings → Integrations → Webhooks.{' '}
                        <a
                          href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'underline' }}
                        >
                          How to get a webhook URL
                        </a>
                      </Box>
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    onClick={async () => {
                      if (!config.discordWebhookUrl || config.discordWebhookUrl.trim().length === 0) {
                        setSnackbar({
                          open: true,
                          message: 'Please enter a Discord webhook URL first',
                          severity: 'warning'
                        });
                        return;
                      }

                      setTestingNotification(true);
                      try {
                        const response = await fetch('/api/notifications/test', {
                          method: 'POST',
                          headers: {
                            'x-access-token': token || '',
                          },
                        });

                        if (response.ok) {
                          setSnackbar({
                            open: true,
                            message: 'Test notification sent! Check your Discord channel.',
                            severity: 'success'
                          });
                        } else {
                          const error = await response.json();
                          setSnackbar({
                            open: true,
                            message: error.message || 'Failed to send test notification',
                            severity: 'error'
                          });
                        }
                      } catch (error) {
                        setSnackbar({
                          open: true,
                          message: 'Failed to send test notification',
                          severity: 'error'
                        });
                      } finally {
                        setTestingNotification(false);
                      }
                    }}
                    disabled={testingNotification}
                  >
                    {testingNotification ? 'Sending...' : 'Send Test Notification'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Make sure to save your configuration before testing
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
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

      <Accordion elevation={8} defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Optional: Automatic Video Removal
          </Typography>
          <Chip
            label={config.autoRemovalEnabled ? "Enabled" : "Disabled"}
            color={config.autoRemovalEnabled ? "success" : "default"}
            size="small"
            sx={{ mr: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Automatic Deletion</AlertTitle>
            <Typography variant="body2">
              This feature automatically deletes downloaded videos based on your configured thresholds.
              Deletions run nightly at 2:00 AM and are permanent - deleted videos cannot be recovered.
              <br /><br />
              Use this feature to manage storage automatically and keep only recent content.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.autoRemovalEnabled}
                    onChange={(e) => setConfig({ ...config, autoRemovalEnabled: e.target.checked })}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Enable Automatic Video Removal
                    {getInfoIcon('Automatically delete videos based on the thresholds configured below. Deletions run nightly at 2:00 AM.')}
                  </Box>
                }
              />
            </Grid>

            {config.autoRemovalEnabled && (
              <>
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      Configure one or both removal strategies. Videos will be deleted if they meet any enabled threshold.
                    </Typography>
                  </Alert>
                </Grid>

                {storageAvailable === false && (
                  <Grid item xs={12}>
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      <AlertTitle>Space-Based Removal Unavailable</AlertTitle>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Storage reporting is not available on your system, so the Free Space Threshold option is disabled.
                        This can happen with certain mount types like network shares, cloud storage, or virtual filesystems.
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Check the storage indicator at the top of this page - if it shows an error or is not present,
                        storage-based auto-removal will not work.
                      </Typography>
                      <Typography variant="body2">
                        <strong>You can still use Age-Based Removal</strong> (see below), which doesn't require storage reporting.
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {storageAvailable !== false && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FormControl fullWidth disabled={storageAvailable === null}>
                        <InputLabel>Free Space Threshold (Optional)</InputLabel>
                        <Select
                          value={config.autoRemovalFreeSpaceThreshold || ''}
                          onChange={(e) => setConfig({ ...config, autoRemovalFreeSpaceThreshold: e.target.value })}
                          label="Free Space Threshold (Optional)"
                        >
                          <MenuItem value="">
                            <em>Disabled</em>
                          </MenuItem>
                          <MenuItem value="500MB">500 MB</MenuItem>
                          <MenuItem value="1GB">1 GB</MenuItem>
                          <MenuItem value="2GB">2 GB</MenuItem>
                          <MenuItem value="5GB">5 GB</MenuItem>
                          <MenuItem value="10GB">10 GB</MenuItem>
                          <MenuItem value="20GB">20 GB</MenuItem>
                          <MenuItem value="50GB">50 GB</MenuItem>
                          <MenuItem value="100GB">100 GB</MenuItem>
                        </Select>
                        <FormHelperText>
                          {storageAvailable === null
                            ? 'Checking storage availability...'
                            : 'Delete oldest videos when free space falls below this threshold'}
                        </FormHelperText>
                      </FormControl>
                      {getInfoIcon('Some mount types (network shares, overlays, bind mounts) may report incorrect free space. Before enabling this, verify that the storage display at the top of this page shows accurate values. If the reported storage is incorrect, do not use space-based removal.')}
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Video Age Threshold (Optional)</InputLabel>
                    <Select
                      value={config.autoRemovalVideoAgeThreshold || ''}
                      onChange={(e) => setConfig({ ...config, autoRemovalVideoAgeThreshold: e.target.value })}
                      label="Video Age Threshold (Optional)"
                    >
                      <MenuItem value="">
                        <em>Disabled</em>
                      </MenuItem>
                      <MenuItem value="7">7 days</MenuItem>
                      <MenuItem value="14">14 days</MenuItem>
                      <MenuItem value="30">30 days</MenuItem>
                      <MenuItem value="60">60 days</MenuItem>
                      <MenuItem value="120">120 days</MenuItem>
                      <MenuItem value="180">180 days</MenuItem>
                      <MenuItem value="365">1 year</MenuItem>
                      <MenuItem value="730">2 years</MenuItem>
                      <MenuItem value="1095">3 years</MenuItem>
                      <MenuItem value="1825">5 years</MenuItem>
                    </Select>
                    <FormHelperText>
                      Delete videos older than this threshold
                    </FormHelperText>
                  </FormControl>
                </Grid>

                {(config.autoRemovalFreeSpaceThreshold || config.autoRemovalVideoAgeThreshold) && (
                  <Grid item xs={12}>
                    <Alert severity="success" sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                        Active Removal Strategy:
                      </Typography>
                      <Typography variant="body2" component="div">
                        {config.autoRemovalFreeSpaceThreshold && (
                          <>• Delete oldest videos when free space &lt; <strong>{config.autoRemovalFreeSpaceThreshold}</strong><br /></>
                        )}
                        {config.autoRemovalVideoAgeThreshold && (
                          <>• Delete videos older than <strong>{
                            parseInt(config.autoRemovalVideoAgeThreshold) >= 365
                              ? `${Math.round(parseInt(config.autoRemovalVideoAgeThreshold) / 365)} year${Math.round(parseInt(config.autoRemovalVideoAgeThreshold) / 365) > 1 ? 's' : ''}`
                              : `${config.autoRemovalVideoAgeThreshold} days`
                          }</strong></>
                        )}
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: autoRemovalHasStrategy ? 1 : 0 }}>
                    <Button
                      variant="outlined"
                      onClick={runAutoRemovalDryRun}
                      disabled={autoRemovalDryRun.loading || !autoRemovalHasStrategy}
                    >
                      {autoRemovalDryRun.loading ? 'Running preview…' : 'Preview Automatic Removal'}
                    </Button>
                    {autoRemovalDryRun.loading && <CircularProgress size={18} />}
                  </Box>
                  {!autoRemovalHasStrategy && (
                    <FormHelperText sx={{ mt: 1 }}>
                      Select at least one threshold to run a preview.
                    </FormHelperText>
                  )}
                </Grid>

                {autoRemovalDryRun.error && (
                  <Grid item xs={12}>
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {autoRemovalDryRun.error}
                    </Alert>
                  </Grid>
                )}

                {autoRemovalDryRun.result && dryRunSimulation && (
                  <Grid item xs={12}>
                    <Alert
                      severity={autoRemovalDryRun.result.errors.length > 0 ? 'warning' : 'info'}
                      sx={{ mt: 1 }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        Preview Summary
                      </Typography>
                      <Typography variant="body2">
                        Would remove <strong>{dryRunSimulation.total}</strong> videos (~{formatBytes(dryRunSimulation.estimatedFreedBytes)}).
                      </Typography>
                      {dryRunPlan?.ageStrategy.enabled && dryRunPlan.ageStrategy.candidateCount > 0 && (
                        <Typography variant="body2">
                          • Age threshold: {dryRunPlan.ageStrategy.candidateCount} videos (~{formatBytes(dryRunPlan.ageStrategy.estimatedFreedBytes)})
                        </Typography>
                      )}
                      {dryRunPlan?.spaceStrategy.enabled && dryRunPlan.spaceStrategy.needsCleanup && (
                        <Typography variant="body2">
                          • Space threshold: {dryRunPlan.spaceStrategy.candidateCount} videos (~{formatBytes(dryRunPlan.spaceStrategy.estimatedFreedBytes)})
                        </Typography>
                      )}
                      {hasDryRunSpaceThreshold && dryRunPlan?.spaceStrategy.needsCleanup === false && (
                        <Typography variant="body2">
                          Storage is currently above the free space threshold; no space-based deletions are needed.
                        </Typography>
                      )}
                      {dryRunSampleVideos.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            Sample videos
                          </Typography>
                          {dryRunSampleVideos.map((video) => (
                            <Typography key={`dryrun-video-${video.id}`} variant="body2">
                              {video.title} ({video.youtubeId}) • {formatBytes(video.fileSize)}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {autoRemovalDryRun.result.errors.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            Warnings
                          </Typography>
                          {autoRemovalDryRun.result.errors.map((err, index) => (
                            <Typography key={`dryrun-warning-${index}`} variant="body2">
                              {err}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Alert>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {showAccountSection && (
        <Card elevation={8} sx={{ mb: 2 }}>
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
      )}

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
          disabled={isLoading}
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
