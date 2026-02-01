import './App.css';
import packageJson from '../package.json';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Container,
  Typography,
  Snackbar,
  Alert,
  Box,
  CssBaseline,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { AppShell } from './components/layout/AppShell';
import { Settings } from './components/Settings/Settings';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import VideosPage from './components/VideosPage';
import LocalLogin from './components/LocalLogin';
import InitialSetup from './components/InitialSetup';
import ChannelPage from './components/ChannelPage';
import ChangelogPage from './components/ChangelogPage';
import { AuthSplash } from './components/AuthSplash';
import { useConfig } from './hooks/useConfig';
import ErrorBoundary from './components/ErrorBoundary';
import DatabaseErrorOverlay from './components/DatabaseErrorOverlay';
import { useThemeEngine } from './contexts/ThemeEngineContext';
import { createAppTheme } from './themes';
import { YTDLP_UPDATED_EVENT } from './components/Configuration/hooks/useYtDlpUpdate';

// Event name for database error detection
const DB_ERROR_EVENT = 'db-error-detected';

function AppContent() {
  const { themeMode } = useThemeEngine();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('authToken') // Only use the new authToken, no fallback to plexAuthToken
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [ytDlpVersion, setYtDlpVersion] = useState('');
  const [ytDlpUpdateAvailable, setYtDlpUpdateAvailable] = useState(false);
  const [ytDlpLatestVersion, setYtDlpLatestVersion] = useState('');
  const [requiresSetup, setRequiresSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isPlatformManaged, setIsPlatformManaged] = useState(false);
  const [showTmpWarning, setShowTmpWarning] = useState(false);
  const [shouldShowWarning, setShouldShowWarning] = useState(false);
  const [platformName, setPlatformName] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [dbErrors, setDbErrors] = useState<string[]>([]);
  const [dbRecovered, setDbRecovered] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const location = useLocation();

  // Use config hook for global configuration access
  const { config: appConfig, deploymentEnvironment } = useConfig(token);
  const { version } = packageJson;
  const clientVersion = `v${version}`; // Create a version with 'v' prefix for comparison
  const tmpDirectory = '/tmp';
  const isElfHosted = platformName?.toLowerCase() === 'elfhosted';
  const updateAvailable = Boolean(
    serverVersion &&
    serverVersion !== clientVersion &&
    !isElfHosted
  );
  const updateTooltip = updateAvailable
    ? `New version (${serverVersion}) available! Please shut down and pull the latest image and files to update.`
    : undefined;

  const ytDlpLabel = ytDlpVersion ? `yt-dlp: ${ytDlpVersion}` : '';
  const ytDlpUpdateTooltip = ytDlpUpdateAvailable && ytDlpLatestVersion
    ? `yt-dlp update available (${ytDlpLatestVersion}). Go to Settings to update.`
    : undefined;

  const selectedTheme = useMemo(() => {
    return createAppTheme('light', themeMode); // Mode hardcoded for now, can be dynamic later
  }, [themeMode]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('plexAuthToken');
    // Redirect to login splash screen
    window.location.href = '/login';
    setToken(null);
  };

  const handleDatabaseRetry = () => {
    // In Vitest/jsdom, Location.reload can trigger an unimplemented navigation path.
    // The UI intent is "retry by reloading"; keep that behavior in real runtime only.
    if (import.meta.env.MODE === 'test') {
      return;
    }

    // Reload the page to re-check database status
    window.location.reload();
  };

  // Override global fetch to automatically detect database errors
  useEffect(() => {
    // Skip fetch override in test environment to preserve Vitest/Jest mock functionality
    if (import.meta.env.MODE === 'test') {
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

    countdownRef.current = 15;
    setCountdown(15);

    // Check database status every 15 seconds
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/db-status');
        const data = await response.json();

        if (data.status === 'healthy') {
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
      .then(response => response.json())
      .then(data => {
        setRequiresSetup(data.requiresSetup);
        setCheckingSetup(false);

        if (data.platformManaged) {
          setIsPlatformManaged(true);
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
                if (response.ok) {
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

        {checkingSetup ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <Typography>Loading...</Typography>
          </Box>
        ) : (
          <Routes>
            {/* Setup Route - Full Screen */}
            <Route
              path="/setup"
              element={
                requiresSetup ? (
                  <InitialSetup
                    onSetupComplete={(newToken) => {
                      setToken(newToken);
                      setRequiresSetup(false);
                      window.location.href = '/channels';
                    }}
                  />
                ) : (
                  <Navigate to="/channels" replace />
                )
              }
            />

            {/* Login Route - Full Screen Splash */}
            <Route
              path="/login"
              element={
                isPlatformManaged ? (
                  <Navigate to="/channels" replace />
                ) : token ? (
                  <Navigate to="/channels" replace />
                ) : (
                  <AuthSplash setToken={setToken} />
                )
              }
            />

            {/* Authenticated Routes - Wrapped in AppShell */}
            <Route
              path="*"
              element={
                token ? (
                  <AppShell
                    token={token}
                    isPlatformManaged={isPlatformManaged}
                    appName="Youtarr"
                    versionLabel={ytDlpLabel ? `${clientVersion} • ${ytDlpLabel}` : clientVersion}
                    updateAvailable={updateAvailable}
                    updateTooltip={updateTooltip}
                    ytDlpUpdateAvailable={ytDlpUpdateAvailable}
                    ytDlpUpdateTooltip={ytDlpUpdateTooltip}
                    onLogout={handleLogout}
                  >
                    <Container
                      maxWidth={false}
                      sx={{
                        width: '100%',
                        ...(location.pathname === '/channels'
                          ? {
                              display: 'flex',
                              flexDirection: 'column',
                              minHeight: 'calc(100vh - 140px)',
                            }
                          : {}),
                      }}
                    >
                      <ErrorBoundary fallbackMessage="An unexpected error occurred. Please refresh the page to continue.">
                        <Routes>
                          <Route path="/changelog" element={<ChangelogPage />} />
                          <Route path="/settings/*" element={<Settings token={token} />} />
                          <Route path="/configuration" element={<Navigate to="/settings" replace />} />
                          <Route path="/channels" element={<ChannelManager token={token} />} />
                          <Route path="/downloads/*" element={<DownloadManager token={token} />} />
                          <Route path="/videos" element={<VideosPage token={token} />} />
                          <Route path="/channel/:channel_id" element={<ChannelPage token={token} />} />
                          <Route path="/" element={<Navigate to="/channels" replace />} />
                          <Route path="/*" element={<Navigate to="/channels" replace />} />
                        </Routes>
                      </ErrorBoundary>
                    </Container>
                  </AppShell>
                ) : (
                  <Navigate to={requiresSetup ? '/setup' : '/login'} replace />
                )
              }
            />
          </Routes>
        )}

        {/* Persistent warning for temp directory */}
        <Snackbar
          open={showTmpWarning}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            mt: 8,
            width: '100%',
            justifyContent: 'center',
            zIndex: (theme) => theme.zIndex.drawer + 10,
          }}
          onClose={() => setShowTmpWarning(false)}
        >
          <Alert
            severity="error"
            icon={<WarningAmberIcon />}
            onClose={() => setShowTmpWarning(false)}
            sx={{
              maxWidth: '600px',
              '& .MuiAlert-message': {
                width: '100%',
              },
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
