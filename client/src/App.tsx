import './App.css';
import packageJson from '../package.json';
import React, { useState, useEffect } from 'react';
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
  IconButton,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Configuration from './components/Configuration';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import VideosPage from './components/VideosPage';
import LocalLogin from './components/LocalLogin';
import InitialSetup from './components/InitialSetup';
import ChannelPage from './components/ChannelPage';
import StorageStatus from './components/StorageStatus';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('authToken') // Only use the new authToken, no fallback to plexAuthToken
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [requiresSetup, setRequiresSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isPlatformManaged, setIsPlatformManaged] = useState(false);
  const [showTmpWarning, setShowTmpWarning] = useState(false);
  const [shouldShowWarning, setShouldShowWarning] = useState(false);
  const [platformName, setPlatformName] = useState<string | null>(null);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const drawerWidth = isMobile ? '50%' : 240; // specify your drawer width
  const { version } = packageJson;
  const clientVersion = `v${version}`; // Create a version with 'v' prefix for comparison
  const tmpDirectory = '/tmp';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Check configuration for temp directory warning
  useEffect(() => {
    console.log('Useeffect for temp directory warning');
    if (token && !checkingSetup) {
      fetch('/getconfig', {
        headers: {
          'x-access-token': token,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          const dataPath = data.youtubeOutputDirectory;
          if (dataPath && dataPath.toLowerCase().includes(tmpDirectory.toLowerCase())) {
            setShouldShowWarning(true);
            setShowTmpWarning(true);
          }

          // Check for platform from deployment environment
          if (data.deploymentEnvironment?.platform) {
            setPlatformName(data.deploymentEnvironment.platform);
          }
        })
        .catch((error) => console.error('Failed to fetch config for tmp check:', error));
    }
  }, [token, checkingSetup]);

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
      })
      .catch((err) => {
        console.error('Failed to fetch server version:', err);
      });
  }, []);

  return (
    <>
      <AppBar
        position={isMobile ? 'static' : 'fixed'}
        style={{
          backgroundColor: '#DDD',
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
            }}
          >
            <MenuIcon fontSize='large' />
          </IconButton>
          <StorageStatus token={token} />
          <div
            style={{
              marginTop: '8px',
              color: '#000',
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
          </div>
          <Typography
            fontSize='small'
            color={'textSecondary'}
            style={{ position: 'absolute', top: 5, right: 10 }}
          >
            {clientVersion}
          </Typography>
          {/* This is the matching invisible IconButton */}
          <IconButton
            color='inherit'
            aria-label='menu space'
            edge='start'
            sx={{ mx: 0.25, visibility: 'hidden' }}
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
          style={{ maxWidth: drawerWidth, paddingTop: isMobile ? 0 : '100px' }}
        >
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={handleDrawerToggle}
            style={{ width: drawerWidth }}
            PaperProps={{
              style: {
                width: drawerWidth,
                backgroundColor: '#CCC',
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
              >
                <ListItemText
                  primaryTypographyProps={{ fontSize: 'large' }}
                  primary='Configuration'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/channels'
                onClick={handleDrawerToggle}
              >
                <ListItemText
                  primaryTypographyProps={{ fontSize: 'large' }}
                  primary='Your Channels'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/downloads'
                onClick={handleDrawerToggle}
              >
                <ListItemText
                  primaryTypographyProps={{ fontSize: 'large' }}
                  primary='Manage Downloads'
                />
              </ListItem>
              <ListItem
                button
                component={Link}
                to='/videos'
                onClick={handleDrawerToggle}
              >
                <ListItemText
                  primaryTypographyProps={{ fontSize: 'large' }}
                  primary='Downloaded Videos'
                />
              </ListItem>
              {!token && !isPlatformManaged && (
                <ListItem
                  button
                  component={Link}
                  to='/login'
                  onClick={handleDrawerToggle}
                >
                  <ListItemText
                    primaryTypographyProps={{ fontSize: 'large' }}
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
                >
                  <ListItemText
                    primaryTypographyProps={{ fontSize: 'large' }}
                    primary='Logout'
                  />
                </ListItem>
              )}
              {isPlatformManaged && (
                <ListItem>
                  <ListItemText
                    primary="Platform Authentication"
                    secondary={platformName?.toLowerCase() === "elfhosted" ? "Managed by Elfhosted" : "Managed by platform"}
                    secondaryTypographyProps={{ fontSize: 'small' }}
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
              paddingTop: '32px',
              width: '100%',
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
                <Route path='/login' element={<LocalLogin setToken={setToken} />} />
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
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          width: '100%',
          backgroundColor: '#DDD',
          textAlign: 'center',
        }}
      >
        <Typography variant='subtitle1' color='textSecondary'>
          {serverVersion && serverVersion !== clientVersion && (
            <Typography color='error'>
              New version ({serverVersion}) available! Please restart the app to
              update.
            </Typography>
          )}
        </Typography>
      </footer>

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
