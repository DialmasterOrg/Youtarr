import React, { ChangeEvent } from 'react';
import {
  TextField,
  Grid,
  Box,
  Chip,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  AlertTitle,
  Typography,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, PlatformManagedState, PlexConnectionStatus } from '../types';

interface PlexIntegrationSectionProps {
  config: ConfigState;
  isPlatformManaged: PlatformManagedState;
  plexConnectionStatus: PlexConnectionStatus;
  hasPlexServerConfigured: boolean;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onTestConnection: () => void;
  onOpenLibrarySelector: () => void;
  onOpenPlexAuthDialog: () => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const PlexIntegrationSection: React.FC<PlexIntegrationSectionProps> = ({
  config,
  isPlatformManaged,
  plexConnectionStatus,
  hasPlexServerConfigured,
  onConfigChange,
  onTestConnection,
  onOpenLibrarySelector,
  onOpenPlexAuthDialog,
  onMobileTooltipClick,
}) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    let parsedValue: any = value;

    if (name === 'plexPort') {
      const digitsOnly = value.replace(/[^0-9]/g, '');
      if (digitsOnly.length === 0) {
        parsedValue = '';
      } else {
        const numericPort = Math.min(65535, Math.max(1, Number.parseInt(digitsOnly, 10)));
        parsedValue = String(numericPort);
      }
    }

    onConfigChange({ [name]: parsedValue });
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [event.target.name]: event.target.checked });
  };

  const getChipLabel = (): string => {
    switch (plexConnectionStatus) {
      case 'connected':
        return 'Connected';
      case 'not_connected':
        return 'Not Connected';
      case 'testing':
        return 'Testing...';
      default:
        return 'Not Tested';
    }
  };

  const getChipColor = (): 'success' | 'error' | 'info' | 'warning' => {
    switch (plexConnectionStatus) {
      case 'connected':
        return 'success';
      case 'not_connected':
        return 'error';
      case 'testing':
        return 'info';
      default:
        return 'warning';
    }
  };

  return (
    <ConfigurationAccordion
      title="Plex Media Server Integration"
      chipLabel={getChipLabel()}
      chipColor={getChipColor()}
      defaultExpanded={false}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Optional Plex Integration</AlertTitle>
        <Typography variant="body2">
          • Automatic library refresh after downloads
          <br />• Direct library selection from Plex server
          <br />
          If you don&apos;t use Plex, your videos will still download to your specified directory.
          <br />
          You <b>must</b> select a library once connected for automatic refresh to work.
        </Typography>
      </Alert>

      {plexConnectionStatus === 'not_connected' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Unable to connect to Plex server. Library refresh will not work.
          Please check your IP and API key, then click &quot;Test Connection&quot;.
        </Alert>
      )}

      {plexConnectionStatus === 'not_tested' && hasPlexServerConfigured && config.plexApiKey && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Plex configuration has changed. Click &quot;Test Connection&quot; to verify your settings.
        </Alert>
      )}

      {(!hasPlexServerConfigured || !config.plexApiKey) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {!hasPlexServerConfigured
            ? 'Enter your Plex server IP to enable Plex integration.'
            : 'Enter your Plex API Key to enable Plex integration.'}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <TextField
            fullWidth
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Plex Server IP
                {isPlatformManaged.plexUrl ? (
                  <Chip
                    label="Platform Managed"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                ) : (
                  <InfoTooltip
                    text="The IP address of your Plex server. Use 'host.docker.internal' on Docker Desktop (Windows/macOS), or the machine's LAN IP (e.g., 192.168.x.x) when running Docker natively on Linux. You can also use your public IP for your Plex server."
                    onMobileClick={onMobileTooltipClick}
                  />
                )}
              </Box>
            }
            name="plexIP"
            value={config.plexIP}
            onChange={handleInputChange}
            disabled={isPlatformManaged.plexUrl}
            helperText={isPlatformManaged.plexUrl
              ? "Plex URL is configured by your platform deployment"
              : "e.g., host LAN IP (192.168.x.x) or host.docker.internal (Docker Desktop)"}
            inputProps={{ 'data-testid': 'plex-ip-input' }}
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            fullWidth
            type="number"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Plex Port
                <InfoTooltip
                  text="The TCP port Plex listens on. Defaults to 32400. Update this if you have changed the port in Plex settings or use a reverse proxy mapping."
                  onMobileClick={onMobileTooltipClick}
                />
              </Box>
            }
            name="plexPort"
            value={config.plexPort}
            onChange={handleInputChange}
            disabled={isPlatformManaged.plexUrl}
            inputProps={{ min: 1, max: 65535, step: 1, 'data-testid': 'plex-port-input' }}
            helperText={isPlatformManaged.plexUrl
              ? 'Plex port is configured by your platform deployment'
              : 'Default: 32400'}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="plexViaHttps"
                  checked={isPlatformManaged.plexUrl ? false : config.plexViaHttps}
                  onChange={handleCheckboxChange}
                  disabled={isPlatformManaged.plexUrl}
                  inputProps={{ 'data-testid': 'plex-https-checkbox' } as any}
                />
              }
              label="Use HTTPS"
            />
            <InfoTooltip
              text={
                isPlatformManaged.plexUrl
                  ? 'HTTPS setting managed by platform'
                  : 'Enable if your Plex server uses HTTPS (e.g., via reverse proxy with SSL/TLS)'
              }
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
            {isPlatformManaged.plexUrl
              ? 'Protocol managed by platform'
              : 'Default: HTTP'}
          </Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="Plex API Key"
                name="plexApiKey"
                value={config.plexApiKey}
                onChange={handleInputChange}
                inputProps={{ 'data-testid': 'plex-api-key-input' }}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={onOpenPlexAuthDialog}
                sx={{
                  minWidth: '120px',
                  height: '56px',
                  fontWeight: 'bold'
                }}
                startIcon={<InfoIcon />}
                data-testid="get-key-button"
              >
                Get Key
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <InfoTooltip
                text="Click 'Get Key' to automatically obtain your Plex API key by logging into Plex, or enter it manually."
                onMobileClick={onMobileTooltipClick}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                <a
                  href="https://www.plexopedia.com/plex-media-server/general/plex-token/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit' }}
                  data-testid="manual-instructions-link"
                >
                  Manual instructions
                </a>
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              onClick={onTestConnection}
              disabled={!hasPlexServerConfigured || !config.plexApiKey || plexConnectionStatus === 'testing'}
              color={plexConnectionStatus === 'connected' ? 'success' : 'primary'}
              data-testid="test-connection-button"
            >
              {plexConnectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              variant="outlined"
              onClick={onOpenLibrarySelector}
              disabled={plexConnectionStatus !== 'connected'}
              data-testid="select-library-button"
            >
              Select Plex Library
            </Button>
            <InfoTooltip
              text="Test Connection will verify and auto-save your Plex credentials if successful."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
          {config.plexYoutubeLibraryId && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected Library ID: {config.plexYoutubeLibraryId}
            </Typography>
          )}
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};
