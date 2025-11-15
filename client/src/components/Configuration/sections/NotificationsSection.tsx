import React, { useState, ChangeEvent } from 'react';
import {
  FormControlLabel,
  Switch,
  TextField,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
  Button,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, SnackbarState } from '../types';

interface NotificationsSectionProps {
  token: string | null;
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  setSnackbar: (snackbar: SnackbarState) => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  token,
  config,
  onConfigChange,
  onMobileTooltipClick,
  setSnackbar,
}) => {
  const [testingNotification, setTestingNotification] = useState(false);
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [event.target.name]: event.target.value });
  };

    const handleTestNotification = async () => {
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
    };


  return (
    <ConfigurationAccordion
      title="Notifications"
      chipLabel={config.notificationsEnabled ? "Enabled" : "Disabled"}
      chipColor={config.notificationsEnabled ? "success" : "default"}
      defaultExpanded={false}
    >
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
                onChange={(e) => onConfigChange({ notificationsEnabled: e.target.checked })}
                inputProps={{ 'data-testid': 'notifications-enabled-switch' } as any}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Enable Notifications
                <InfoTooltip
                  text="Receive notifications when new videos are downloaded successfully."
                  onMobileClick={onMobileTooltipClick}
                />
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
                onClick={handleTestNotification}
                disabled={testingNotification}
                data-testid="test-notification-button"
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
    </ConfigurationAccordion>
  );
};
