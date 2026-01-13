import React from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const SETTINGS_PAGES = [
  { key: 'core', title: 'Core', description: 'Downloads folder, quality, defaults, and core behavior.' },
  { key: 'plex', title: 'Plex', description: 'Plex integration and library configuration.' },
  { key: 'sponsorblock', title: 'SponsorBlock', description: 'Skip segments and SponsorBlock settings.' },
  { key: 'kodi', title: 'Kodi', description: 'Kodi compatibility and metadata options.' },
  { key: 'cookies', title: 'Cookies', description: 'Cookie configuration and login helpers.' },
  { key: 'notifications', title: 'Notifications', description: 'Toast notifications and alert behavior.' },
  { key: 'performance', title: 'Download Performance', description: 'Concurrency, throttling, and performance tuning.' },
  { key: 'advanced', title: 'Advanced', description: 'Power-user settings and advanced toggles.' },
  { key: 'autoremove', title: 'Auto Removal', description: 'Automated cleanup and retention policies.' },
  { key: 'security', title: 'Account Security', description: 'Authentication and password management.' },
  { key: 'api-keys', title: 'API Keys', description: 'API key settings and rate limits.' },
];

export function SettingsIndex() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Settings
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Choose a settings area.
      </Typography>

      <Grid container spacing={2}>
        {SETTINGS_PAGES.map((page) => (
          <Grid item xs={12} md={6} lg={4} key={page.key}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardActionArea component={RouterLink} to={`/settings/${page.key}`}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {page.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {page.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
