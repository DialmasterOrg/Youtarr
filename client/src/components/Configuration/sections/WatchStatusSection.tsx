import React, { ChangeEvent } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  Typography,
} from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { FREQUENCY_MAPPING } from '../constants';
import { reverseFrequencyMapping } from '../helpers';
import { ConfigState } from '../types';
import { MEDIA_SERVER_LABELS } from '../../../utils/mediaServerLabels';
import { formatDateTime } from '../../../utils/formatters';
import { useMediaServerStatus } from '../../../hooks/useMediaServerStatus';
import { useWatchStatusSync, WatchStatusSyncRun } from '../hooks/useWatchStatusSync';

// Each sync tick does a full library listing on every connected server, so
// sub-hourly schedules are excluded from this menu; "Sync Now" covers the
// impatient case.
const SUB_HOURLY_OPTIONS = new Set(['Every 15 minutes', 'Every 30 minutes']);
const FREQUENCY_OPTIONS = Object.keys(FREQUENCY_MAPPING).filter(
  (key) => !SUB_HOURLY_OPTIONS.has(key)
);

type ServerKey = 'plex' | 'jellyfin' | 'emby';

const ALL_USERS_CONFIG_KEY = {
  plex: 'plexWatchStatusAllUsers',
  jellyfin: 'jellyfinWatchStatusAllUsers',
  emby: 'embyWatchStatusAllUsers',
} as const;

const WATCHED_RULE_OPTIONS: Array<{ value: 'any' | 'primary'; label: string }> = [
  { value: 'any', label: 'Any user has watched' },
  { value: 'primary', label: 'Only the primary account has watched' },
];

interface WatchStatusSectionProps {
  config: ConfigState;
  token: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
}

function SyncRunSummary({ run }: { run: WatchStatusSyncRun }) {
  const completed = run.completedAt ? formatDateTime(run.completedAt) : null;
  if (run.skipped) {
    return (
      <Typography variant="body2" color="text.secondary">
        Last sync{completed ? ` (${completed})` : ''}: skipped, {run.skipped}
      </Typography>
    );
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        Last sync{completed ? `: ${completed}` : ''}
      </Typography>
      {run.error && (
        <Typography variant="body2" color="error">
          Failed: {run.error}
        </Typography>
      )}
      {Object.entries(run.servers || {}).map(([server, result]) => (
        <Typography
          key={server}
          variant="body2"
          color={result.error ? 'error' : 'text.secondary'}
        >
          {MEDIA_SERVER_LABELS[server] || server}:{' '}
          {result.error
            ? `failed (${result.error})`
            : `${result.updated} ${result.updated === 1 ? 'video' : 'videos'} updated`}
        </Typography>
      ))}
    </Box>
  );
}

export function WatchStatusSection({ config, token, onConfigChange }: WatchStatusSectionProps) {
  const {
    status: serverStatus,
    anyConfigured,
    loading: statusLoading,
    error: statusError,
  } = useMediaServerStatus(token);
  const { syncState, running, starting, startError, pollError, startSync } = useWatchStatusSync(token);

  const connectedServers = (Object.keys(MEDIA_SERVER_LABELS) as ServerKey[]).filter(
    (key) => serverStatus[key]
  );

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ watchStatusSyncEnabled: event.target.checked });
  };

  const handleFrequencyChange = (event: SelectChangeEvent) => {
    const mapped = FREQUENCY_MAPPING[String(event.target.value)];
    if (mapped) onConfigChange({ watchStatusSyncFrequency: mapped });
  };

  const handleRuleChange = (event: SelectChangeEvent) => {
    onConfigChange({ watchStatusWatchedRule: event.target.value as 'any' | 'primary' });
  };

  const currentFrequency = reverseFrequencyMapping(config.watchStatusSyncFrequency);
  // A saved value outside the curated list (e.g. a sub-hourly pick, or a
  // hand-edited cron) still has to render in the Select, so surface it as an
  // extra option instead of showing a blank.
  const frequencyOptions = FREQUENCY_OPTIONS.includes(currentFrequency)
    ? FREQUENCY_OPTIONS
    : [currentFrequency, ...FREQUENCY_OPTIONS];

  return (
    <ConfigurationCard title="Watch Status Sync">
      <Typography variant="body2" color="text.secondary" className="mb-4">
        Periodically pulls each video&apos;s watch status
        from your connected media servers into Youtarr. By default every server user is included;
        other Plex users are read from the server&apos;s play history. Sync is one-way: nothing is
        written back to your media servers.
      </Typography>

      <Accordion className="mb-4">
        <AccordionSummary>What determines if a video is &quot;watched&quot;?</AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" className="mb-2">
            Youtarr doesn&apos;t decide this; it shows whatever your media servers report. All
            three servers mark a video played once playback passes a percentage threshold (90% by
            default), and each server lets you change it:
          </Typography>
          <ul className="list-disc pl-5 mb-2 text-sm text-muted-foreground space-y-1">
            <li>
              <strong>Plex</strong>: Settings -&gt; Library -&gt;{' '}
              <strong>Video Played Threshold</strong>
            </li>
            <li>
              <strong>Emby</strong>: Emby Server -&gt; Library -&gt; edit the library -&gt;{' '}
              <strong>Max resume percentage</strong> (at the bottom of the dialog, per library)
            </li>
            <li>
              <strong>Jellyfin</strong>: Server -&gt; Playback -&gt; Resume -&gt;{' '}
              <strong>Maximum resume percentage</strong>
            </li>
          </ul>
          <Typography variant="body2" color="text.secondary">
            If a video you finished isn&apos;t showing as watched here, check that setting on the
            server you played it on, then run a sync.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {statusError && (
        <Alert severity="warning" className="mb-4">
          Could not check connected media servers: {statusError}
        </Alert>
      )}
      {!statusLoading && !statusError && !anyConfigured && (
        <Alert severity="info" className="mb-4">
          No media servers connected. Configure Plex, Jellyfin, or Emby first; watch status sync
          has nothing to do until then.
        </Alert>
      )}
      {/* useMediaServerStatus keeps the last successful status when a later
          poll fails, so suppress this while an error shows: rendering both
          "could not check" and "syncing from Plex" would contradict. */}
      {!statusError && connectedServers.length > 0 && (
        <Alert severity="success" className="mb-4">
          Syncing watch status from: {connectedServers.map((s) => MEDIA_SERVER_LABELS[s]).join(', ')}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.watchStatusSyncEnabled}
                onChange={handleToggle}
              />
            }
            label="Enable watch status sync"
          />
        </Grid>

        {connectedServers.length > 0 && (
          <Grid item xs={12}>
            <Box className="flex flex-col gap-2">
              {connectedServers.map((server) => (
                <FormControlLabel
                  key={server}
                  control={
                    <Switch
                      checked={config[ALL_USERS_CONFIG_KEY[server]]}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        onConfigChange({ [ALL_USERS_CONFIG_KEY[server]]: event.target.checked })
                      }
                      disabled={!config.watchStatusSyncEnabled}
                    />
                  }
                  label={`Include all ${MEDIA_SERVER_LABELS[server]} users`}
                />
              ))}
            </Box>
            <FormHelperText>
              When off, only the primary account is synced (Plex: the server owner; Jellyfin/Emby:
              the configured user).
            </FormHelperText>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <InputLabel>Sync Frequency</InputLabel>
          <Select
            fullWidth
            value={currentFrequency}
            onChange={handleFrequencyChange}
            disabled={!config.watchStatusSyncEnabled}
          >
            {frequencyOptions.map((key) => (
              <MenuItem key={key} value={key}>
                {key}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>How often Youtarr checks your media servers.</FormHelperText>
        </Grid>

        <Grid item xs={12} md={6}>
          <InputLabel>Show as watched when</InputLabel>
          <Select
            fullWidth
            value={config.watchStatusWatchedRule}
            onChange={handleRuleChange}
            disabled={!config.watchStatusSyncEnabled}
          >
            {WATCHED_RULE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Drives the Watched chip on the video listing pages.</FormHelperText>
        </Grid>

        <Grid item xs={12}>
          <Box className="flex items-center flex-wrap gap-2">
            <Button
              variant="contained"
              onClick={startSync}
              disabled={!token || starting || running || !anyConfigured}
              className="h-10 min-w-[150px] whitespace-nowrap"
            >
              {running ? 'Sync in progress...' : starting ? 'Starting...' : 'Sync Now'}
            </Button>
            {startError && (
              <Typography variant="body2" color="error">
                {startError}
              </Typography>
            )}
            {pollError && (
              <Typography variant="body2" color="error">
                {pollError}
              </Typography>
            )}
          </Box>
          {!running && syncState?.lastRun && (
            <Box className="mt-2">
              <SyncRunSummary run={syncState.lastRun} />
            </Box>
          )}
        </Grid>
      </Grid>
    </ConfigurationCard>
  );
}

export default WatchStatusSection;
