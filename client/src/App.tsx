import './App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Grid, AppBar, Toolbar, Box, Container, Typography, Drawer, List, ListItem, ListItemText } from '@mui/material';
import Configuration from './components/Configuration';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('plexAuthToken'));
  const drawerWidth = 240; // specify your drawer width

  useEffect(() => {
    const storedToken = localStorage.getItem('plexAuthToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  return (
    <Router>
      <AppBar position="static" style={{ backgroundColor: '#DDD' }}>
        <Toolbar style={{ paddingBottom: '15px' }}>
          <div style={{ color: '#000', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h2" align="center">
              YouTubePlexArr
            </Typography>
            <Typography variant="h5" align="center">
              Youtube Video Downloader for Plex
            </Typography>
          </div>
        </Toolbar>
      </AppBar>
      <Grid container>
        <Grid item xs={12} sm={3} md={1} style={{ maxWidth: drawerWidth }}>
          <Drawer
            variant="permanent"
            open
            style={{ width: drawerWidth }}
            PaperProps={{ style: { width: drawerWidth } }}
          >
            <List>
              <ListItem button component={Link} to="/configuration">
                <ListItemText primary="Configuration" />
              </ListItem>
              <ListItem button component={Link} to="/channels">
                <ListItemText primary="Channels" />
              </ListItem>
              <ListItem button component={Link} to="/downloads">
                <ListItemText primary="Manage Downloads" />
              </ListItem>
              { !token && <ListItem button component={Link} to="/login">
                <ListItemText primary="Login" />
              </ListItem>}

            </List>
          </Drawer>
        </Grid>
        <Grid item xs={12} sm={9} md={11} style={{ paddingLeft: drawerWidth }}>
          <Container style={{ paddingTop: '50px' }}>
            <Routes>
              <Route path="/login" element={<Login setToken={setToken} />} />
              {token ? (
                <>
                  <Route path="/configuration" element={<Configuration token={token} />} />
                  <Route path="/channels" element={<ChannelManager token={token} />} />
                  <Route path="/downloads" element={<DownloadManager token={token} />} />
                  <Route path="/*" element={<Navigate to="/configuration" />} />
                </>
              ) : (
                <Route path="/*" element={<Navigate to="/login" />} />
              )}
            </Routes>
          </Container>
        </Grid>
      </Grid>
    </Router>
  );
}

export default App;