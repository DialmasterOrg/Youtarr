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
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, PlatformManagedState, PlexConnectionStatus } from '../types';
import { PlexSubfolderMappings } from './PlexSubfolderMappings';
import { PlexLibrary } from '../../../utils/plexLibraries';
import { DefaultPlexLibraryDisplay } from './components/DefaultPlexLibraryDisplay';

interface PlexIntegrationSectionProps {
  config: ConfigState;
  isPlatformManaged: PlatformManagedState;
  plexConnectionStatus: PlexConnectionStatus;
  plexLibraries: PlexLibrary[];
  hasPlexServerConfigured: boolean;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onTestConnection: () => void;
  onOpenLibrarySelector: () => void;
  onOpenPlexAuthDialog: () => void;
  onMobileTooltipClick?: (text: string) => void;
  token?: string | null;
}

export const PlexIntegrationSection: React.FC<PlexIntegrationSectionProps> = ({
  config,
  isPlatformManaged,
  plexConnectionStatus,
  plexLibraries,
  hasPlexServerConfigured,
  onConfigChange,
  onTestConnection,
  onOpenLibrarySelector,
  onOpenPlexAuthDialog,
  onMobileTooltipClick,
  token = null,
}) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    let parsedValue: string = value;

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
  const plexIntegrationEnabled = Boolean(hasPlexServerConfigured && config.plexApiKey);

  const getChipLabel = (): string => {
    switch (plexConnectionStatus) {
      case 'connected':
        return 'Connected';
      case 'not_connected':
        return 'Unreachable';
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
      statusBanner={{
        enabled: plexIntegrationEnabled,
        onText: 'Plex Integration Enabled',
        offText: 'Plex Integration Disabled',
        showToggle: false,
      }}
      defaultExpanded={false}
    >
      <Alert severity="info" className="mb-4">
        <AlertTitle>Optional Plex Integration</AlertTitle>
        <Typography variant="body2">
          • Automatic library refresh after downloads
          <br />• Direct library selection from Plex server
          <br />
          If you don't use Plex, your videos will still download to your specified directory.
          <br />
          You <b>must</b> select a library once connected for automatic refresh to work.
        </Typography>
      </Alert>

      {plexConnectionStatus === 'not_connected' && (
        <Alert severity="warning" className="mb-6">
          Plex is currently unreachable. Verify your Plex server is running and
          that the IP, port, and API key above are correct, then click "Test Connection".
        </Alert>
      )}

      {plexConnectionStatus === 'not_tested' && hasPlexServerConfigured && config.plexApiKey && (
        <Alert severity="info" className="mb-4">
          Plex configuration has changed. Click "Test Connection" to verify your settings.
        </Alert>
      )}

      {(!hasPlexServerConfigured || !config.plexApiKey) && (
        <Alert severity="info" className="mb-4">
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
              <Box className="flex items-center">
                Plex Server IP
                {isPlatformManaged.plexUrl ? (
                  <Chip
                    label="Platform Managed"
                    size="small"
                    className="ml-2"
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
              <Box className="flex items-center">
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
          <Box className="flex items-center">
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
          <Typography variant="caption" color="secondary" className="ml-8 block">
            {isPlatformManaged.plexUrl
              ? 'Protocol managed by platform'
              : 'Default: HTTP'}
          </Typography>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Box>
            <Box className="flex flex-col gap-2 md:flex-row md:items-start">
              <TextField
                fullWidth
                label="Plex API Key"
                name="plexApiKey"
                value={config.plexApiKey}
                onChange={handleInputChange}
                inputProps={{ 'data-testid': 'plex-api-key-input' }}
              />
              <Box className="flex flex-wrap items-center gap-2 self-start md:flex-nowrap md:pt-0.5" data-testid="plex-api-key-actions">
                <Button
                  variant="contained"
                  color="success"
                  onClick={onOpenPlexAuthDialog}
                  className="h-10 min-w-[150px] whitespace-nowrap"
                  data-testid="get-key-button"
                >
                  Get Key
                </Button>
                <InfoTooltip
                  text="Click 'Get Key' to automatically obtain your Plex API key by logging into Plex, or enter it manually."
                  onMobileClick={onMobileTooltipClick}
                />
                <Typography variant="caption" color="secondary">
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
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box className="flex items-center flex-wrap gap-2">
            <Button
              variant="contained"
              onClick={onTestConnection}
              disabled={!hasPlexServerConfigured || !config.plexApiKey || plexConnectionStatus === 'testing'}
              color={plexConnectionStatus === 'connected' ? 'success' : 'primary'}
              className="h-10 min-w-[150px] whitespace-nowrap"
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
              Select Default Library
            </Button>
            <InfoTooltip
              text="Test Connection will verify and auto-save your Plex credentials if successful."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
          <DefaultPlexLibraryDisplay
            libraries={plexLibraries}
            libraryId={config.plexYoutubeLibraryId}
            plexConnectionStatus={plexConnectionStatus}
            hasPlexServerConfigured={hasPlexServerConfigured}
            hasPlexApiKey={Boolean(config.plexApiKey)}
            onMobileTooltipClick={onMobileTooltipClick}
          />
        </Grid>

        <Grid item xs={12}>
          <PlexSubfolderMappings
            mappings={config.plexSubfolderLibraryMappings ?? []}
            onMappingsChange={(mappings) => onConfigChange({ plexSubfolderLibraryMappings: mappings })}
            token={token}
            plexConnectionStatus={plexConnectionStatus}
            plexLibraries={plexLibraries}
          />
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};
