import React from 'react';
import { Card, CardActionArea, CardContent, Grid, Typography } from '../ui';
import { Link as RouterLink } from 'react-router-dom';

export const SETTINGS_PAGES = [
  { key: 'core', title: 'Core', description: 'Downloads folder, quality, defaults, and core behavior.' },
  { key: 'downloading', title: 'YT-DLP', description: 'yt-dlp backend settings for downloads and reliability.' },
  { key: 'api-keys', title: 'API Keys', description: 'API key settings and rate limits.' },
  { key: 'appearance', title: 'Appearance', description: 'Theme, animations, and visual preferences.' },
  { key: 'autoremove', title: 'Auto Removal', description: 'Automated cleanup and retention policies.' },
  { key: 'cookies', title: 'Cookies', description: 'Cookie configuration and login helpers.' },
  { key: 'notifications', title: 'Notifications', description: 'Toast notifications and alert behavior.' },
  { key: 'plex', title: 'Plex', description: 'Plex integration and library configuration.' },
  { key: 'security', title: 'Account Security', description: 'Authentication and password management.' },
  { key: 'sponsorblock', title: 'SponsorBlock', description: 'Skip segments and SponsorBlock settings.' },
];

export function SettingsIndex() {
  return (
    <div>
      {/* Page title is rendered by the parent Settings page; keep this index compact */}

      <Grid container spacing={2}>
        {SETTINGS_PAGES.map((page) => (
          <Grid item xs={12} md={6} lg={4} key={page.key} style={{ display: 'flex' }}>
            <Card 
              className="settings-splash-card"
              variant="outlined" 
              style={{ 
                borderRadius: 'var(--radius-ui)', 
                width: '100%', 
                height: '100%',
                border: 'var(--border-weight) solid var(--border)',
              }}
            >
              <CardActionArea
                component={RouterLink}
                to={`/settings/${page.key}`}
                style={{ height: '100%', display: 'flex' }}
              >
                <CardContent
                  style={{
                    flex: 1,
                    height: 72,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    gap: 4,
                    padding: '12px 12px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 2, lineHeight: 1 }}>
                      {page.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.15,
                      } as React.CSSProperties}
                    >
                      {page.description}
                    </Typography>
                  </div>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}
