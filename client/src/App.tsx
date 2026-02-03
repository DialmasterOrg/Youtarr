import './App.css';
import packageJson from '../package.json';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toplogo from './Youtarr_text.png';
import axios from 'axios';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import {
  Grid,
  AppBar,
  Toolbar,
  Container,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Box,
  CssBaseline,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Tooltip from '@mui/material/Tooltip';
import SettingsIcon from '@mui/icons-material/Settings';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import DownloadIcon from '@mui/icons-material/Download';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import Configuration from './components/Configuration';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import VideosPage from './components/VideosPage';
import LocalLogin from './components/LocalLogin';
import InitialSetup from './components/InitialSetup';
import ChannelPage from './components/ChannelPage';
import ChangelogPage from './components/ChangelogPage';
import StorageStatus from './components/StorageStatus';
import { useConfig } from './hooks/useConfig';
import ErrorBoundary from './components/ErrorBoundary';
import DatabaseErrorOverlay from './components/DatabaseErrorOverlay';
import { lightTheme, darkTheme } from './theme';
import { YTDLP_UPDATED_EVENT } from './components/Configuration/hooks/useYtDlpUpdate';

// Event name for database error detection
const DB_ERROR_EVENT = 'db-error-detected';

function AppContent() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('authToken') // Only use the new authToken, no fallback to plexAuthToken
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [ytDlpVersion, setYtDlpVersion] = useState('');
  const [requiresSetup, setRequiresSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [showTmpWarning, setShowTmpWarning] = useState(false);
  const [shouldShowWarning, setShouldShowWarning] = useState(false);
  const [platformName, setPlatformName] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [dbErrors, setDbErrors] = useState<string[]>([]);
  const [dbRecovered, setDbRecovered] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [ytDlpUpdateAvailable, setYtDlpUpdateAvailable] = useState(false);
  const [ytDlpLatestVersion, setYtDlpLatestVersion] = useState('');
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const drawerWidth = isMobile ? '50%' : 240; // specify your drawer width

  // Use config hook for global configuration access
  const { config: appConfig, deploymentEnvironment, isPlatformManaged: platformManagedState } = useConfig(token);
  const isPlatformManaged = !platformManagedState.authEnabled;
  const { version } = packageJson;
  const clientVersion = `v${version}`; // Create a version with 'v' prefix for comparison
  const tmpDirectory = '/tmp';

  // Select theme based on darkModeEnabled config
  const selectedTheme = useMemo(() => {
    return appConfig.darkModeEnabled ? darkTheme : lightTheme;
  }, [appConfig.darkModeEnabled]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDatabaseRetry = () => {
    // Reload the page to re-check database status
    window.location.reload();
  };

  // Override global fetch to automatically detect database errors
  useEffect(() => {
    // Skip fetch override in test environment to preserve Jest mock functionality
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const originalFetch = window.fetch;

    window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
      const response = await originalFetch(...args);

      // Check for database error (503 with requiresDbFix flag)
      if (response.status === 503) {
        // Clone the response so we can read it without consuming the original
        const clonedResponse = response.clone();

        try {
          const data = await clonedResponse.json();

          if (data.requiresDbFix === true) {
            // Dispatch custom event to notify App.tsx
            const event = new CustomEvent(DB_ERROR_EVENT, {
              detail: {
                errors: data.details || [data.message],
                message: data.message,
              },
            });
            window.dispatchEvent(event);
          }
        } catch (jsonError) {
          // Response wasn't JSON or couldn't be parsed - ignore
        }
      }

      return response;
    };

    // Restore original fetch on cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Check database status on initial load
  useEffect(() => {
    fetch('/api/db-status')
      .then((response) => response.json())
      .then((data) => {
        if (data.status === 'healthy') {
          setDbStatus('healthy');
        } else {
          setDbStatus('error');
          setDbErrors(data.database?.errors || ['Unknown database error']);
        }
      })
      .catch((error) => {
        console.error('Failed to check database status:', error);
        // If we can't reach the endpoint, assume healthy and let other errors surface naturally
        setDbStatus('healthy');
      });
  }, []);

  // Setup axios interceptor to catch database errors from any API call
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Check if this is a database error (503 with requiresDbFix flag)
        if (
          error.response?.status === 503 &&
          error.response?.data?.requiresDbFix === true
        ) {
          console.error('Database error detected from API call:', error.response.data);
          setDbStatus('error');
          setDbErrors(error.response.data.details || ['Database connection error']);
          setDbRecovered(false);
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Setup global event listener for database errors from fetch calls
  useEffect(() => {
    const handleDbError = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.error('Database error detected from fetch call:', customEvent.detail);
      setDbStatus('error');
      setDbErrors(customEvent.detail.errors || ['Database connection error']);
      setDbRecovered(false);
    };

    window.addEventListener(DB_ERROR_EVENT, handleDbError);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener(DB_ERROR_EVENT, handleDbError);
    };
  }, []);

  // Smart conditional polling - only poll when database is in error state
  const countdownRef = useRef(15);

  useEffect(() => {
    if (dbStatus !== 'error') {
      return; // Don't poll if database is healthy
    }

    console.log('Database in error state, starting polling...');
    countdownRef.current = 15;
    setCountdown(15);

    // Check database status every 15 seconds
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/db-status');
        const data = await response.json();

        if (data.status === 'healthy') {
          console.log('Database recovered!');
          setDbStatus('healthy');
          setDbRecovered(true); // Show recovery message
          setDbErrors([]);
        } else {
          // Still unhealthy, update errors
          setDbErrors(data.database?.errors || ['Unknown database error']);
        }
      } catch (error) {
        console.error('Error polling database status:', error);
      }

      // Reset countdown
      countdownRef.current = 15;
      setCountdown(15);
    }, 15000);

    // Countdown ticker for UI feedback (updates every second)
    const ticker = setInterval(() => {
      countdownRef.current = countdownRef.current - 1;
      if (countdownRef.current < 0) {
        countdownRef.current = 15;
      }
      setCountdown(countdownRef.current);
    }, 1000);

    // Cleanup on unmount or when dbStatus changes
    return () => {
      clearInterval(checkInterval);
      clearInterval(ticker);
    };
  }, [dbStatus]);

  // Check configuration for temp directory warning
  useEffect(() => {
    if (token && !checkingSetup && appConfig.youtubeOutputDirectory) {
      const dataPath = appConfig.youtubeOutputDirectory;
      if (dataPath && dataPath.toLowerCase().includes(tmpDirectory.toLowerCase())) {
        setShouldShowWarning(true);
        setShowTmpWarning(true);
      }
    }

    // Check for platform from deployment environment
    if (deploymentEnvironment.platform) {
      setPlatformName(deploymentEnvironment.platform);
    }
  }, [token, checkingSetup, appConfig.youtubeOutputDirectory, deploymentEnvironment.platform]);

  // Reset warning visibility on route change
  useEffect(() => {
    if (shouldShowWarning) {
      setShowTmpWarning(true);
    }
  }, [location, shouldShowWarning]);

  useEffect(() => {
    // IMMEDIATELY clear any old plexAuthToken that might exist from previous auth method
    if (localStorage.getItem('plexAuthToken')) {
      localStorage.removeItem('plexAuthToken');
    }

    // First check if setup is required
    fetch('/setup/status')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Setup status check failed');
      })
      .then(data => {
        setRequiresSetup(data.requiresSetup);
        setCheckingSetup(false);

        if (data.platformManaged) {
          setToken('platform-managed-auth');
          localStorage.setItem('authToken', 'platform-managed-auth');
          return;
        }

        // If setup is required, clear ALL existing tokens to force fresh authentication
        if (data.requiresSetup) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('plexAuthToken');
          setToken(null);
          return; // Don't proceed with token validation
        }

        // Only check auth token if setup is not required
        if (!data.requiresSetup) {
          // Only use the new authToken - no fallback to plexAuthToken
          const authToken = localStorage.getItem('authToken');

          if (authToken) {
            // Use the new auth/validate endpoint
            fetch('/auth/validate', {
              headers: {
                'x-access-token': authToken,
              },
            })
              .then((response) => {
                if (response.ok || response.status === 304) {
                  setToken(authToken);
                } else {
                  localStorage.removeItem('authToken');
                  setToken(null);
                }
              })
              .catch(() => {
                localStorage.removeItem('authToken');
                setToken(null);
              });
          }
        }
      })
      .catch(err => {
        console.error('Setup status check failed:', err);
        setCheckingSetup(false);
        // Default to true (require setup) when we can't reach the server
        // This is safer than assuming setup is complete
        setRequiresSetup(true);
      });

    // Fetch the current release version from the server
    axios
      .get('/getCurrentReleaseVersion')
      .then((response) => {
        setServerVersion(response.data.version);
        if (response.data.ytDlpVersion) {
          setYtDlpVersion(response.data.ytDlpVersion);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch server version:', err);
      });
  }, []);

  const fetchYtDlpVersionInfo = useCallback(() => {
    if (!token) {
      setYtDlpUpdateAvailable(false);
      setYtDlpLatestVersion('');
      return;
    }

    fetch('/api/ytdlp/latest-version', {
      headers: { 'x-access-token': token },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch yt-dlp version');
      })
      .then((data) => {
        setYtDlpUpdateAvailable(data.updateAvailable || false);
        setYtDlpLatestVersion(data.latestVersion || '');
        if (data.currentVersion) {
          setYtDlpVersion(data.currentVersion);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch yt-dlp version info:', err);
        setYtDlpUpdateAvailable(false);
        setYtDlpLatestVersion('');
      });
  }, [token]);

  useEffect(() => {
    fetchYtDlpVersionInfo();
  }, [fetchYtDlpVersionInfo]);

  // Listen for yt-dlp update events to refresh version display
  useEffect(() => {
    const handleYtDlpUpdated = () => {
      fetchYtDlpVersionInfo();
    };

    window.addEventListener(YTDLP_UPDATED_EVENT, handleYtDlpUpdated);

    return () => {
      window.removeEventListener(YTDLP_UPDATED_EVENT, handleYtDlpUpdated);
    };
  }, [fetchYtDlpVersionInfo]);

  return (
    <ThemeProvider theme={selectedTheme}>
      <CssBaseline />
      <>
        {/* Database Error Overlay - shows when database is unavailable or recovered */}
        {(dbStatus === 'error' || dbRecovered) && (
          <DatabaseErrorOverlay
            errors={dbErrors}
            onRetry={handleDatabaseRetry}
            recovered={dbRecovered}
            countdown={countdown}
          />
        )}

      <AppBar
        position="fixed"
        sx={{
          bgcolor: 'background.paper',
          width: '100%',
          margin: 0,
          padding: 0,
        }}
      >
        <Toolbar
          style={{
            paddingBottom: '8px',
          }}
        >
          <IconButton
            color='inherit'
            aria-label='open drawer'
            edge='start'
            onClick={handleDrawerToggle}
            sx={{
              mx: 0.25,
              mt: 1,
              visibility: isMobile ? 'visible' : 'hidden',
              color: 'text.primary',
            }}
          >
            <MenuIcon fontSize='large' />
          </IconButton>
          {!requiresSetup && token && <StorageStatus token={token} />}
          <Box
            sx={{
              marginTop: '8px',
              color: 'text.primary',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {platformName?.toLowerCase() === 'elfhosted' && (
                <img
                  src="https://store.elfhosted.com/wp-content/uploads/2024/11/logo.svg"
                  alt="ElfHosted"
                  style={{ width: isMobile ? '30px' : '40px', height: 'auto' }}
                />
              )}
              <img
                src={toplogo}
                alt='Youtarr'
                style={{ width: isMobile ? '150px' : '200px', height: isMobile ? '44px' : '56px' }}
              />
            </div>
            <Typography
              style={{ fontSize: isMobile ? 'small' : 'large' }}
              align='center'
            >
              YouTube Video Manager
            </Typography>
          </Box>
          <Box
            style={{
              position: 'absolute',
              top: 5,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end'
            }}
          >
            <Typography
              fontSize='small'
              color={'textSecondary'}
            >
              {clientVersion}
            </Typography>
            {ytDlpVersion && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {ytDlpUpdateAvailable && (
                  <Tooltip title={`yt-dlp update available (${ytDlpLatestVersion}). Go to Configuration to update.`}>
                    <IconButton
                      component={Link}
                      to="/configuration"
                      size="small"
                      aria-label={`yt-dlp update available (${ytDlpLatestVersion}). Click to go to Configuration.`}
                      sx={{ p: 0.25 }}
                    >
                      <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Typography
                  fontSize='x-small'
                  color={'textSecondary'}
                  style={{ opacity: 0.7 }}
                >
                  yt-dlp: {ytDlpVersion}
                </Typography>
              </Box>
            )}
          </Box>
          {/* This is the matching invisible IconButton */}
          <IconButton
            color='inherit'
            aria-label='menu space'
            edge='start'
            sx={{ mx: 0.25, visibility: 'hidden', color: 'text.primary' }}
          >
            <MenuIcon fontSize='large' />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Grid container>
        <Grid
          item
          xs={12}
          sm={3}
          md={1}
          style={{ maxWidth: drawerWidth, paddingTop: isMobile ?'0px' : '100px' }}
        >
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={handleDrawerToggle}
            style={{ width: drawerWidth }}
            PaperProps={{
              sx: {
                width: drawerWidth,
                bgcolor: 'background.default',
                maxWidth: '50vw',
                marginTop: isMobile ? '0' : '100px',
              },
            }}
            ModalProps={{ keepMounted: true }} // Better open performance on mobile.
          >
            {isMobile && (
              <IconButton
                color='inherit'
                aria-label='close drawer'
                edge='end'
                onClick={handleDrawerToggle}
                sx={{ mx: 2, mb: 0, mt: 2, alignSelf: 'flex-end' }}
              >
                <CloseIcon fontSize='large' />
              </IconButton>
            )}
            <List>
              <ListItem
                button
                component={Link}
                to='/configuration'
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: location.pathname === '/configuration' ? 'action.selected' : 'transparent',
                  borderLeft: location.pathname === '/configuration' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    bgcolor: location.pathname === '/configuration' ? 'action.hover' : 'action.hover',
                  },
                  paddingX: isMobile ? '8px' : '16px'
                }}
              >
                <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                  <SettingsIcon sx={{ color: location.pathname === '/configuration' ? 'primary.main' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: isMobile ? 'small' : 'medium',
                    fontWeight: location.pathname === '/configuration' ? 'bold' : 'normal'
                  }}
                  primary='Configuration'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/channels'
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: location.pathname === '/channels' ? 'action.selected' : 'transparent',
                  borderLeft: location.pathname === '/channels' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  paddingX: isMobile ? '8px' : '16px'
                }}
              >
                <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                  <SubscriptionsIcon sx={{ color: location.pathname === '/channels' ? 'primary.main' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: isMobile ? 'small' : 'medium',
                    fontWeight: location.pathname === '/channels' ? 'bold' : 'normal'
                  }}
                  primary='Your Channels'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/downloads'
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: location.pathname === '/downloads' ? 'action.selected' : 'transparent',
                  borderLeft: location.pathname === '/downloads' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  paddingX: isMobile ? '8px' : '16px'
                }}
              >
                <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                  <DownloadIcon sx={{ color: location.pathname === '/downloads' ? 'primary.main' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: isMobile ? 'small' : 'medium',
                    fontWeight: location.pathname === '/downloads' ? 'bold' : 'normal'
                  }}
                  primary='Manage Downloads'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/videos'
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: location.pathname === '/videos' ? 'action.selected' : 'transparent',
                  borderLeft: location.pathname === '/videos' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  paddingX: isMobile ? '8px' : '16px'
                }}
              >
                <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                  <VideoLibraryIcon sx={{ color: location.pathname === '/videos' ? 'primary.main' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: isMobile ? 'small' : 'medium',
                    fontWeight: location.pathname === '/videos' ? 'bold' : 'normal'
                  }}
                  primary='Downloaded Videos'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/changelog'
                onClick={handleDrawerToggle}
                sx={{
                  bgcolor: location.pathname === '/changelog' ? 'action.selected' : 'transparent',
                  borderLeft: location.pathname === '/changelog' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  paddingX: isMobile ? '8px' : '16px'
                }}
              >
                <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                  <NewReleasesIcon sx={{ color: location.pathname === '/changelog' ? 'primary.main' : 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: isMobile ? 'small' : 'medium',
                    fontWeight: location.pathname === '/changelog' ? 'bold' : 'normal'
                  }}
                  primary='Changelog'
                />
              </ListItem>
              {!token && !isPlatformManaged && (
                <ListItem
                  button
                  component={Link}
                  to='/login'
                  onClick={handleDrawerToggle}
                  sx={{
                    bgcolor: location.pathname === '/login' ? 'action.selected' : 'transparent',
                    borderLeft: location.pathname === '/login' ? (theme) => `4px solid ${theme.palette.primary.main}` : 'none',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    paddingX: isMobile ? '8px' : '16px'
                  }}
                >
                  <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                    <LoginIcon sx={{ color: location.pathname === '/login' ? 'primary.main' : 'inherit' }} />
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{
                      fontSize: isMobile ? 'small' : 'medium',
                      fontWeight: location.pathname === '/login' ? 'bold' : 'normal'
                    }}
                    primary='Login'
                  />
                </ListItem>
              )}
              {token && !isPlatformManaged && (
                <ListItem
                  button
                  onClick={() => {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('plexAuthToken');
                    setToken(null);
                    handleDrawerToggle();
                  }}
                  sx={{
                    paddingX: isMobile ? '8px' : '16px'
                  }}
                >
                  <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                    <LogoutIcon />
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ fontSize: isMobile ? 'small' : 'medium' }}
                    primary='Logout'
                  />
                </ListItem>
              )}
              {isPlatformManaged && (
                <ListItem sx={{ paddingX: isMobile ? '8px' : '16px' }}>
                  <ListItemIcon sx={{ minWidth: isMobile ? 46 : 56 }}>
                    <ShieldIcon sx={{ color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Platform Authentication"
                    primaryTypographyProps={{ fontSize: isMobile ? 'small' : 'medium' }}
                    secondary={platformName?.toLowerCase() === "elfhosted" ? "Managed by Elfhosted" : "Managed by platform"}
                    secondaryTypographyProps={{ fontSize: 'x-small' }}
                  />
                </ListItem>
              )}
            </List>
          </Drawer>
        </Grid>
        <Grid
          item
          xs={12}
          style={{
            marginLeft: isMobile ? '0' : drawerWidth,
          }}
        >
          <Container
            style={{
              paddingTop: isMobile ? '100px' : '32px',
              width: '100%',
              ...(location.pathname === '/channels'
                ? (isMobile
                    ? {
                        height: '100vh',
                        maxHeight: 'calc(100vh - 16px)',
                      }
                    : {
                        height: 'calc(100vh - 132px)',
                        maxHeight: 'calc(100vh - 132px)',
                        display: 'flex',
                        flexDirection: 'column',
                      })
                : {}),
            }}
          >
            {checkingSetup ? (
              <div>Loading...</div>
            ) : (
              <ErrorBoundary
                fallbackMessage="An unexpected error occurred. Please refresh the page to continue."
              >
                <Routes>
                <Route path='/setup' element={<InitialSetup onSetupComplete={(newToken) => {
                  setToken(newToken);
                  setRequiresSetup(false);
                  window.location.href = '/configuration';
                }} />} />
                <Route
                  path='/login'
                  element={
                    isPlatformManaged ? (
                      <Navigate to='/configuration' replace />
                    ) : (
                      <LocalLogin setToken={setToken} />
                    )
                  }
                />
                <Route
                  path='/changelog'
                  element={<ChangelogPage />}
                />
                {token ? (
                  <>
                    <Route
                      path='/configuration'
                      element={<Configuration token={token} />}
                    />
                    <Route
                      path='/channels'
                      element={<ChannelManager token={token} />}
                    />
                    <Route
                      path='/downloads'
                      element={<DownloadManager token={token} />}
                    />
                    <Route
                      path='/videos'
                      element={<VideosPage token={token} />}
                    />
                    <Route
                      path='/channel/:channel_id'
                      element={<ChannelPage token={token} />}
                    />
                    <Route path='/*' element={<Navigate to='/downloads' />} />
                  </>
                ) : (
                  // If setup is required, redirect to setup, otherwise to login
                  <Route path='/*' element={<Navigate to={requiresSetup ? '/setup' : '/login'} />} />
                )}
                </Routes>
              </ErrorBoundary>
            )}
          </Container>
        </Grid>
      </Grid>
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          width: '100%',
          bgcolor: 'background.paper',
          textAlign: 'center',
        }}
      >
        <Typography variant='subtitle1' color='textSecondary'>
          {serverVersion && serverVersion !== clientVersion && platformName?.toLowerCase() !== 'elfhosted' && (
            <Typography color='error'>
              New version ({serverVersion}) available! Please shut down and pull the latest image and files to update.
            </Typography>
          )}
        </Typography>
      </Box>

      {/* Persistent warning for temp directory */}
      <Snackbar
        open={showTmpWarning}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
        onClose={() => setShowTmpWarning(false)}
      >
        <Alert
          severity="error"
          icon={<WarningAmberIcon />}
          onClose={() => setShowTmpWarning(false)}
          sx={{
            maxWidth: '600px',
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Box>
            <Typography variant="body2" gutterBottom>
              <strong>Warning:</strong> Your video directory is mounted to {tmpDirectory}. This means your downloaded videos will not persist between restarts.
            </Typography>
            {platformName && platformName.toLowerCase() === 'elfhosted' && (
              <Typography variant="body2">
                Please see the{' '}
                <a
                  href="https://docs.elfhosted.com/app/youtarr"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Elfhosted setup guide
                </a>
              </Typography>
            )}
          </Box>
        </Alert>
      </Snackbar>
      </>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
