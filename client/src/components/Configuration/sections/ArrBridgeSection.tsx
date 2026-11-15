import React, { ChangeEvent } from 'react';
import { Alert, Box, FormControlLabel, Switch, TextField, Typography } from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { ConfigState, SnackbarState } from '../types';
import { useArrBridgeKey } from '../hooks/useArrBridgeKey';
import { useArrBridgeConnections } from '../hooks/useArrBridgeConnections';
import { useArrBridgeGrabs } from '../hooks/useArrBridgeGrabs';
import { ARR_APPS, ARR_DOCS_URL, MAX_RETENTION_DAYS } from '../utils/arrBridgeSetup';
import { ArrBridgeNumberField } from './components/ArrBridgeNumberField';
import { ArrBridgeSetupValues } from './components/ArrBridgeSetupValues';
import { ArrBridgeMatchingSettings } from './components/ArrBridgeMatchingSettings';
import { ArrBridgeCategories } from './components/ArrBridgeCategories';
import { ArrConnectionCard } from './components/ArrConnectionCard';
import { ArrBridgeGrabList } from './components/ArrBridgeGrabList';

interface ArrBridgeSectionProps {
  token: string | null;
  config: ConfigState;
  savedConfig: ConfigState | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

/**
 * Settings -> Sonarr / Radarr. The switch, matching, categories and staging
 * settings are saved with the page's Save button; the key and the
 * connections are server-owned and change through their own buttons.
 */
export const ArrBridgeSection: React.FC<ArrBridgeSectionProps> = ({
  token,
  config,
  savedConfig,
  onConfigChange,
  setSnackbar,
}) => {
  const enabled = config.arrBridgeEnabled;
  const { bridgeKey, loading, error, regenerating, regenerate } = useArrBridgeKey(token, enabled);
  const connections = useArrBridgeConnections(enabled ? token : null);
  const grabs = useArrBridgeGrabs(token, enabled);
  const status = connections.status;

  return (
    <>
      <ConfigurationCard
        title="Sonarr / Radarr"
        subtitle="Sonarr and Radarr can search YouTube through Youtarr and import what it downloads. Youtarr keeps its own copy."
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onConfigChange({ arrBridgeEnabled: event.target.checked })
              }
            />
          }
          label="Enable the Sonarr / Radarr bridge"
        />
        <Typography variant="body2" color="text.secondary" className="mt-1">
          Sonarr and Radarr also need to see Youtarr&apos;s staging folder.{' '}
          <a href={ARR_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Setup guide
          </a>
        </Typography>

        {enabled && (
          <ArrBridgeSetupValues
            bridgeKey={bridgeKey}
            loading={loading}
            error={error}
            regenerating={regenerating}
            onRegenerate={regenerate}
            categories={config.arrBridgeCategories}
            saved={Boolean(savedConfig?.arrBridgeEnabled)}
            setSnackbar={setSnackbar}
          />
        )}
      </ConfigurationCard>

      {enabled && (
        <>
          <ConfigurationCard title="Matching" subtitle="Which YouTube videos Youtarr offers for an episode or a movie.">
            <ArrBridgeMatchingSettings
              config={config}
              onConfigChange={onConfigChange}
              sonarrConnected={Boolean(status?.connections.sonarr.keySet)}
              radarrConnected={Boolean(status?.connections.radarr.keySet)}
            />
          </ConfigurationCard>

          <ConfigurationCard
            title="Categories and shared folder"
            subtitle="Where grabbed videos are downloaded, and the folder Sonarr and Radarr import them from."
          >
            <ArrBridgeCategories
              token={token}
              categories={config.arrBridgeCategories}
              onChange={(categories) => onConfigChange({ arrBridgeCategories: categories })}
            />
            <Box className="mt-4 flex flex-col gap-3">
              {status && (
                <Typography variant="body2">
                  Staging folder in Youtarr: <code className="break-all">{status.stagingRoot}</code>
                </Typography>
              )}
              <Box className="grid gap-4 md:grid-cols-2">
                <TextField
                  fullWidth
                  label="The same folder as Sonarr and Radarr see it"
                  value={config.arrBridgeStagingPath}
                  placeholder="Leave empty when the path is the same"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onConfigChange({ arrBridgeStagingPath: event.target.value })
                  }
                  helperText="Only when the folder is mounted at another path in Sonarr and Radarr. An absolute path."
                />
                <ArrBridgeNumberField
                  label="Keep staged files for (days)"
                  value={config.arrBridgeStagingRetentionDays}
                  min={1}
                  max={MAX_RETENTION_DAYS}
                  onChange={(days) => onConfigChange({ arrBridgeStagingRetentionDays: days })}
                  helperText="A staged file nobody imported is removed after this long. Your library copy stays."
                />
              </Box>
            </Box>
          </ConfigurationCard>

          <ConfigurationCard
            title="Connect to Sonarr and Radarr (optional)"
            subtitle="With a connection, Youtarr reads episode titles and runtimes from your own Sonarr and Radarr to find official uploads that have no season number. It only reads."
          >
            {connections.error && <Alert severity="error">{connections.error}</Alert>}
            {!connections.error && !status && (
              <Typography variant="body2" color="text.secondary">
                Loading the connections...
              </Typography>
            )}
            {status && (
              <Box className="grid gap-4 md:grid-cols-2">
                {ARR_APPS.map((app) => (
                  <ArrConnectionCard
                    key={app}
                    app={app}
                    connection={status.connections[app]}
                    busy={connections.busyApp === app}
                    onSave={(url, apiKey) => connections.save(app, url, apiKey)}
                    onTest={() => connections.test(app)}
                    onRemove={() => connections.remove(app)}
                  />
                ))}
              </Box>
            )}
          </ConfigurationCard>

          <ConfigurationCard title="Recent grabs">
            <ArrBridgeGrabList
              grabs={grabs.grabs}
              loading={grabs.loading}
              error={grabs.error}
              onRefresh={grabs.refresh}
            />
          </ConfigurationCard>
        </>
      )}
    </>
  );
};

export default ArrBridgeSection;
