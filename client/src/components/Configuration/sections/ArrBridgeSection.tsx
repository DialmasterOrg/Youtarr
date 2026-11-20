import React, { ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, FormControlLabel, Switch, Tab, Tabs, Typography } from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { ConfigState, SnackbarState } from '../types';
import { useArrBridgeKey } from '../hooks/useArrBridgeKey';
import { useArrBridgeConnections } from '../hooks/useArrBridgeConnections';
import { useArrBridgeGrabs } from '../hooks/useArrBridgeGrabs';
import { useArrBridgeSearches } from '../hooks/useArrBridgeSearches';
import { useArrBridgeFolderCheck } from '../hooks/useArrBridgeFolderCheck';
import {
  ARR_APPS, ARR_DOCS_URL, releaseResolution, removeAfterImportWarning, stagingFolderOnHost,
} from '../utils/arrBridgeSetup';
import { ArrBridgeSetupValues } from './components/ArrBridgeSetupValues';
import { ArrBridgeMatchingSettings } from './components/ArrBridgeMatchingSettings';
import { ArrBridgeCategories } from './components/ArrBridgeCategories';
import { ArrBridgeResolutionField } from './components/ArrBridgeResolutionField';
import { ArrBridgeSharedFolder } from './components/ArrBridgeSharedFolder';
import { ArrConnectionCard } from './components/ArrConnectionCard';
import { ArrBridgeGrabList } from './components/ArrBridgeGrabList';
import { ArrBridgeSearchList } from './components/ArrBridgeSearchList';

// The tab is in the address, so the docs and a bookmark can open the lists.
const TAB_PARAM = 'tab';
const SETUP_TAB = 'setup';
const ACTIVITY_TAB = 'activity';

interface ArrBridgeSectionProps {
  token: string | null;
  config: ConfigState;
  savedConfig: ConfigState | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

/**
 * Settings -> Sonarr / Radarr. The Setup tab is in the order someone sets
 * it up: turn it on, add Youtarr to the apps, connect them, check the
 * shared folder; the settings to tune come after. The Activity tab lists
 * the grabs and the searches. The switch and the settings are saved with
 * the page's Save button; the key and the connections are server-owned and
 * change through their own buttons.
 */
export const ArrBridgeSection: React.FC<ArrBridgeSectionProps> = ({
  token,
  config,
  savedConfig,
  onConfigChange,
  setSnackbar,
}) => {
  const enabled = config.arrBridgeEnabled;
  const removeAfterImport = config.arrBridgeRemoveAfterImport;
  const { bridgeKey, loading, error, regenerating, regenerate } = useArrBridgeKey(token, enabled);
  const connections = useArrBridgeConnections(enabled ? token : null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Only once the bridge is saved as on: a link to the activity must not
  // hide the switch and step 1 the moment an unsaved switch is flipped.
  const showTabs = enabled && Boolean(savedConfig?.arrBridgeEnabled);
  const showActivity = showTabs && searchParams.get(TAB_PARAM) === ACTIVITY_TAB;
  const grabs = useArrBridgeGrabs(token, showActivity);
  const searches = useArrBridgeSearches(token, showActivity);
  const status = connections.status;
  const connected = {
    sonarr: Boolean(status?.connections.sonarr.keySet),
    radarr: Boolean(status?.connections.radarr.keySet),
  };
  const connectionWarning = removeAfterImportWarning(connected);
  // The server checks what is saved: the path it tells the apps, and the
  // connections it asks. A change to either is a reason to ask again.
  const savedStagingPath = savedConfig?.arrBridgeStagingPath ?? '';
  const folderCheck = useArrBridgeFolderCheck(
    enabled && savedConfig?.arrBridgeEnabled ? token : null,
    connected,
    [savedStagingPath, status?.connections.sonarr.url ?? '', status?.connections.radarr.url ?? ''].join('|')
  );

  const selectTab = (_event: React.SyntheticEvent, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === ACTIVITY_TAB) next.set(TAB_PARAM, ACTIVITY_TAB);
      else next.delete(TAB_PARAM);
      return next;
    }, { replace: true });
  };

  const setup = (
    <>
      <ConfigurationCard
        title="Sonarr / Radarr"
        subtitle={`Sonarr and Radarr can search YouTube through Youtarr and import what it downloads. ${
          removeAfterImport ? 'Youtarr removes its own copy after the import.' : 'Youtarr keeps its own copy.'
        }`}
      >
        <Box
          className="rounded-[var(--radius-ui)] border border-[var(--border)] bg-muted/30 p-3"
          role="group"
          aria-label="What to expect"
        >
          <Typography variant="subtitle2">What to expect</Typography>
          <ul className="m-0 mt-1 list-disc pl-5 text-sm">
            <li>
              Youtarr answers the searches Sonarr and Radarr run. It does not announce new uploads, so a new episode
              is found when a search runs, not on its own.
            </li>
            <li>
              A grab is a one-off download, separate from your subscriptions. Youtarr does not subscribe to the channel
              or download anything else from it, and nothing is added to your Channels page.
            </li>
            <li>
              {removeAfterImport
                ? 'A grab is downloaded by Youtarr like any other video. Once Sonarr or Radarr confirms the import through the connection in step 3, Youtarr removes its own copy.'
                : 'A grab is downloaded by Youtarr like any other video and stays in your Youtarr library, where it shows in Download History and on the Videos page. Sonarr or Radarr import their own copy.'}
            </li>
            <li>
              Setup takes the four steps on this page.{' '}
              <a href={ARR_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Setup guide
              </a>
            </li>
          </ul>
        </Box>

        <Typography variant="subtitle2" className="mt-4">
          Step 1: Turn it on and save
        </Typography>
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
      </ConfigurationCard>

      {enabled && (
        <>
          <ConfigurationCard
            title="Step 2: Add Youtarr to Sonarr and Radarr"
            subtitle="In each app, add Youtarr as an indexer and as a download client, with these values."
          >
            <ArrBridgeSetupValues
              bridgeKey={bridgeKey}
              loading={loading}
              error={error}
              regenerating={regenerating}
              onRegenerate={regenerate}
              categories={config.arrBridgeCategories}
              saved={Boolean(savedConfig?.arrBridgeEnabled)}
              resolution={releaseResolution(
                config.arrBridgeResolution, config.preferredResolution, config.arrBridgeLabelLimit
              )}
              setSnackbar={setSnackbar}
            />
          </ConfigurationCard>

          <ConfigurationCard
            title="Step 3: Connect your Sonarr and Radarr (recommended)"
            subtitle="Youtarr reads episode titles and runtimes from your own Sonarr and Radarr. Without it, most official uploads are not found: they are titled with the episode's name and carry no season number. It also lets Youtarr check the shared folder in step 4. It only reads."
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

          <ConfigurationCard
            title="Step 4: Check the shared folder"
            subtitle="The folder Sonarr and Radarr import finished grabs from."
          >
            <ArrBridgeSharedFolder
              hostFolder={stagingFolderOnHost(config.youtubeOutputDirectory)}
              connected={connected}
              checks={folderCheck.results}
              checking={folderCheck.checking}
              onRecheck={folderCheck.recheck}
              stagingPath={config.arrBridgeStagingPath}
              stagingPathSaved={config.arrBridgeStagingPath === savedStagingPath}
              onStagingPathChange={(path) => onConfigChange({ arrBridgeStagingPath: path })}
              retentionDays={config.arrBridgeStagingRetentionDays}
              onRetentionDaysChange={(days) => onConfigChange({ arrBridgeStagingRetentionDays: days })}
            />
          </ConfigurationCard>

          <ConfigurationCard
            title="Downloads"
            subtitle="The quality grabs are downloaded at, and where they are saved."
          >
            <Box className="flex flex-col gap-4">
              <ArrBridgeResolutionField
                resolution={config.arrBridgeResolution}
                labelLimit={config.arrBridgeLabelLimit}
                preferredResolution={config.preferredResolution}
                onChange={onConfigChange}
              />
              <ArrBridgeCategories
                token={token}
                categories={config.arrBridgeCategories}
                onChange={(categories) => onConfigChange({ arrBridgeCategories: categories })}
              />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={removeAfterImport}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        onConfigChange({ arrBridgeRemoveAfterImport: event.target.checked })
                      }
                    />
                  }
                  label="Remove a video from Youtarr after Sonarr or Radarr imports it"
                />
                <Typography variant="body2" color="text.secondary">
                  Off, a grabbed video stays in your Youtarr library. On, Youtarr deletes its own copy once Sonarr or
                  Radarr confirms the import: only a video it downloaded for the grab, never one you already had.
                  This needs the connection in step 3, because Youtarr asks the app whether it imported the grab. A
                  video whose import is not confirmed is kept.
                </Typography>
                {removeAfterImport && status && connectionWarning && (
                  <Alert severity="warning" className="mt-2">
                    {connectionWarning}
                  </Alert>
                )}
              </Box>
            </Box>
          </ConfigurationCard>

          <ConfigurationCard title="Matching" subtitle="Which YouTube videos Youtarr offers for an episode or a movie.">
            <ArrBridgeMatchingSettings
              config={config}
              onConfigChange={onConfigChange}
              sonarrConnected={connected.sonarr}
              radarrConnected={connected.radarr}
            />
          </ConfigurationCard>

        </>
      )}
    </>
  );

  return (
    <>
      {showTabs && (
        <Tabs
          value={showActivity ? ACTIVITY_TAB : SETUP_TAB}
          onChange={selectTab}
          aria-label="Sonarr / Radarr"
          className="mb-4"
        >
          <Tab value={SETUP_TAB} label="Setup" />
          <Tab value={ACTIVITY_TAB} label="Activity" />
        </Tabs>
      )}

      {/* Hidden, not unmounted: a key typed into a connection card stays in its field. */}
      <div hidden={showActivity}>{setup}</div>

      {showActivity && (
        <>
          <ConfigurationCard title="Recent grabs" subtitle="What Sonarr and Radarr grabbed, and what became of each grab.">
            <ArrBridgeGrabList list={grabs} />
          </ConfigurationCard>

          <ConfigurationCard
            title="Recent searches"
            subtitle="What Sonarr and Radarr asked for, what Youtarr found on YouTube, and why each video was or was not offered."
          >
            <ArrBridgeSearchList list={searches} />
          </ConfigurationCard>
        </>
      )}
    </>
  );
};

export default ArrBridgeSection;
