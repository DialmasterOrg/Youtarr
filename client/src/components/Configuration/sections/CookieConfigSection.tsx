import React from 'react';
import {
  FormControlLabel,
  Switch,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { useCookieManagement } from '../hooks/useCookieManagement';
import { ConfigState, SnackbarState } from '../types';

interface CookieConfigSectionProps {
  token: string | null;
  config: ConfigState;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  onMobileTooltipClick?: (text: string) => void;
}

export const CookieConfigSection: React.FC<CookieConfigSectionProps> = ({
  token,
  config,
  setConfig,
  onConfigChange,
  setSnackbar,
  onMobileTooltipClick,
}) => {
  const {
    cookieStatus,
    uploadingCookie,
    uploadCookieFile,
    deleteCookies,
  } = useCookieManagement({ token, setConfig, setSnackbar });

  const handleCookieUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadCookieFile(file);
    event.target.value = '';
  };
  return (
    <ConfigurationAccordion
      title="Cookie Configuration"
      chipLabel={config.cookiesEnabled ? "Cookies Enabled" : "Cookies Disabled"}
      chipColor={config.cookiesEnabled ? "success" : "default"}
      defaultExpanded={false}
    >
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>Security Warning</AlertTitle>
        <Typography variant="body2" paragraph>
          Cookie files contain authentication information for your Google account.
          We strongly recommend using a throwaway account instead of your main account.
        </Typography>
        <Typography variant="body2">
          Learn more about cookie security:{' '}
          <a href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
             target="_blank"
             rel="noopener noreferrer"
             style={{ color: 'inherit', textDecoration: 'underline' }}>
            yt-dlp Cookie FAQ
          </a>
        </Typography>
      </Alert>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Cookies help bypass YouTube's bot detection. If you encounter "Sign in to confirm you're not a bot" errors,
          enabling cookies can resolve the issue.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.cookiesEnabled}
                onChange={(e) => onConfigChange({ cookiesEnabled: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Enable Cookies
                <InfoTooltip
                  text="Use cookies to bypass YouTube bot detection and access age-restricted content."
                  onMobileClick={onMobileTooltipClick}
                />
              </Box>
            }
          />
        </Grid>

        {config.cookiesEnabled && (
          <>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    component="label"
                    disabled={uploadingCookie}
                  >
                    {uploadingCookie ? 'Uploading...' : 'Upload Cookie File'}
                    <input
                      type="file"
                      hidden
                      accept=".txt,text/plain"
                      data-testid="cookie-file-input"
                      onChange={handleCookieUpload}
                    />
                  </Button>
                  {cookieStatus?.customFileExists && (
                    <>
                      <Chip
                        label="Custom cookies uploaded"
                        color="success"
                        size="small"
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={deleteCookies}
                      >
                        Delete Custom Cookies
                      </Button>
                    </>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Upload a Netscape format cookie file exported from your browser.
                  File must be less than 1MB.
                </Typography>
              </Box>
            </Grid>

            {cookieStatus && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Status: {cookieStatus.customFileExists ?
                    'Using custom cookies' :
                    'No cookie file uploaded'}
                </Typography>
              </Grid>
            )}
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
