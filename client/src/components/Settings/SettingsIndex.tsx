import React from 'react';
import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export const SETTINGS_PAGES = [
  { key: 'core', title: 'Core', description: 'Downloads folder, quality, defaults, and core behavior.' },
  { key: 'advanced', title: 'Advanced', description: 'Power-user settings and advanced toggles.' },
  { key: 'api-keys', title: 'API Keys', description: 'API key settings and rate limits.' },
  { key: 'appearance', title: 'Appearance', description: 'Theme, animations, and visual preferences.' },
  { key: 'autoremove', title: 'Auto Removal', description: 'Automated cleanup and retention policies.' },
  { key: 'cookies', title: 'Cookies', description: 'Cookie configuration and login helpers.' },
  { key: 'kodi', title: 'Kodi', description: 'Kodi compatibility and metadata options.' },
  { key: 'notifications', title: 'Notifications', description: 'Toast notifications and alert behavior.' },
  { key: 'performance', title: 'Performance', description: 'Concurrency, throttling, and performance tuning.' },
  { key: 'plex', title: 'Plex', description: 'Plex integration and library configuration.' },
  { key: 'security', title: 'Account Security', description: 'Authentication and password management.' },
  { key: 'sponsorblock', title: 'SponsorBlock', description: 'Skip segments and SponsorBlock settings.' },
];

export function SettingsIndex() {
  return (
    <Box>
      {/* Page title is rendered by the parent Settings page; keep this index compact */}

      <Grid container spacing={2}>
        {SETTINGS_PAGES.map((page) => (
          <Grid item xs={12} md={6} lg={4} key={page.key} sx={{ display: 'flex' }}>
            <Card 
              className="settings-splash-card"
              variant="outlined" 
              sx={{ 
                borderRadius: 'var(--radius-ui)', 
                width: '100%', 
                height: '100%',
                // Ensure border weight respects theme
                border: 'var(--border-weight) solid var(--border)',
              }}
            >
              <CardActionArea
                component={RouterLink}
                to={`/settings/${page.key}`}
                sx={{ height: '100%', display: 'flex' }}
              >
                <CardContent
                  sx={{
                    flex: 1,
                    // fixed height so all cards are uniform; allow two-line descriptions
                    height: { xs: 80, md: 72 },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    gap: 0.5,
                    px: { xs: 2, md: 1.5 },
                    py: { xs: 1.5, md: 1 },
                  }}
                >
                  <Box sx={{ ml: '25px', minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25, lineHeight: 1 }}>
                      {page.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.15,
                      }}
                    >
                      {page.description}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
