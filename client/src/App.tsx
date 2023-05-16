import './App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppBar, Toolbar, Box, Container, Typography, Drawer, List, ListItem, ListItemText } from '@mui/material';
import Configuration from './components/Configuration';
import ChannelManager from './components/ChannelManager';
import DownloadManager from './components/DownloadManager';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('plexAuthToken'));

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
      <Drawer
        variant="permanent"
        open
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
    </Router>
  );
}

export default App;