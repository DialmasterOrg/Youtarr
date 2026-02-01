import React, { useState, useCallback } from 'react';
import {
  TextField,
  FormHelperText,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState } from '../types';
import { validateProxyUrl } from '../utils/configValidation';

interface AdvancedSettingsSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const [proxyError, setProxyError] = useState<string | null>(null);

  const handleProxyChange = useCallback((value: string) => {
    // Always update the config value so the input remains controlled
    onConfigChange({ proxy: value });

    // Clear error while typing to allow user to complete the URL
    setProxyError(null);
  }, [onConfigChange]);

  const handleProxyBlur = useCallback(() => {
    // Validate only on blur when user is done typing
    const error = validateProxyUrl(config.proxy || '');
    setProxyError(error);
  }, [config.proxy]);

  return (
    <ConfigurationAccordion
      title="Network & Rate Limits"
      chipLabel="Network"
      chipColor="default"
      defaultExpanded={false}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Network & Rate Limits</AlertTitle>
        <Typography variant="body2">
          Fine-tune yt-dlp networking with request pacing and proxy settings. These apply to all yt-dlp operations.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Sleep Between Requests (seconds)"
            type="number"
            inputProps={{ min: 0, max: 30, step: 1 }}
            value={config.sleepRequests ?? 1}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 0 && value <= 30) {
                onConfigChange({ sleepRequests: value });
              }
            }}
            helperText={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                Delay between yt-dlp API requests (0-30). Higher values prevent YouTube rate limiting but slow downloads.
                <InfoTooltip
                  text="YouTube may block requests if too many are made in a short period. A delay of 1-2 seconds usually works well. Increase to 5-10 seconds if you experience 429 errors or frequent throttling."
                  onMobileClick={onMobileTooltipClick}
                />
              </Box>
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Proxy URL"
            type="text"
            value={config.proxy || ''}
            onChange={(e) => handleProxyChange(e.target.value)}
            onBlur={handleProxyBlur}
            error={Boolean(proxyError)}
            helperText={
              <Box component="span">
                {proxyError || (
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    Optional proxy URL (e.g., socks5://user:pass@127.0.0.1:1080/). Leave empty for direct connection.
                    <InfoTooltip
                      text="Supported protocols: http://, https://, socks4://, socks5://. Authentication is optional: protocol://user:pass@host:port. Pass empty string to disable proxy."
                      onMobileClick={onMobileTooltipClick}
                    />
                  </Box>
                )}
              </Box>
            }
          />
        </Grid>

        <Grid item xs={12}>
          <FormHelperText sx={{ mt: 1 }}>
            <strong>Note:</strong> These settings apply to all yt-dlp operations including channel metadata fetching, video downloads, and thumbnail downloads.
          </FormHelperText>
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};
