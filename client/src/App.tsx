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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import Configuration from './components/Configuration';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import VideosPage from './components/VideosPage';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('plexAuthToken')
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const drawerWidth = isMobile ? '50%' : 240; // specify your drawer width
  const { version } = packageJson;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('plexAuthToken');
    if (storedToken) {
      setToken(storedToken);
    }
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
    <Router>
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
            <img
              src={toplogo}
              alt='Youtarr'
              style={{ width: isMobile ? '150px' : '200px' }}
            />
            <Typography
              style={{ fontSize: isMobile ? 'small' : 'large' }}
              align='center'
            >
              Youtube Video Management For Plex
            </Typography>
          </div>
          <Typography
            fontSize='small'
            color={'textSecondary'}
            style={{ position: 'absolute', top: 5, right: 10 }}
          >
            v{version}
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
          style={{ maxWidth: drawerWidth, paddingTop: isMobile ? 0 : '112px' }}
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
                marginTop: isMobile ? '0' : '110px',
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
                  primary='Channels'
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
                  primary='Videos'
                />
              </ListItem>
              {!token && (
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
            <Routes>
              <Route path='/login' element={<Login setToken={setToken} />} />
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

                  <Route path='/*' element={<Navigate to='/downloads' />} />
                </>
              ) : (
                <Route path='/*' element={<Navigate to='/login' />} />
              )}
            </Routes>
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
          {serverVersion && serverVersion !== version && (
            <Typography color='error'>
              New version ({serverVersion}) available! Please restart the app to
              update.
            </Typography>
          )}
        </Typography>
      </footer>
    </Router>
  );
}

export default App;
