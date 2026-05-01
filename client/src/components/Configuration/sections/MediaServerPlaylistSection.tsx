import React, { ChangeEvent, useCallback, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { ConfigState } from '../types';

export type MediaServerKind = 'jellyfin' | 'emby';

interface MediaServerPlaylistSectionProps {
  kind: MediaServerKind;
  config: ConfigState;
  token: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
}

interface ServerUser {
  id: string;
  name: string;
}

const LABEL: Record<MediaServerKind, string> = {
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

type EnabledKey = 'jellyfinEnabled' | 'embyEnabled';
type UrlKey = 'jellyfinUrl' | 'embyUrl';
type ApiKeyKey = 'jellyfinApiKey' | 'embyApiKey';
type UserIdKey = 'jellyfinUserId' | 'embyUserId';
type LibraryIdsKey = 'jellyfinVideoLibraryIds' | 'embyVideoLibraryIds';

function fieldKeys(kind: MediaServerKind) {
  if (kind === 'jellyfin') {
    return {
      enabled: 'jellyfinEnabled' as EnabledKey,
      url: 'jellyfinUrl' as UrlKey,
      apiKey: 'jellyfinApiKey' as ApiKeyKey,
      userId: 'jellyfinUserId' as UserIdKey,
      libraryIds: 'jellyfinVideoLibraryIds' as LibraryIdsKey,
    };
  }
  return {
    enabled: 'embyEnabled' as EnabledKey,
    url: 'embyUrl' as UrlKey,
    apiKey: 'embyApiKey' as ApiKeyKey,
    userId: 'embyUserId' as UserIdKey,
    libraryIds: 'embyVideoLibraryIds' as LibraryIdsKey,
  };
}

export const MediaServerPlaylistSection: React.FC<MediaServerPlaylistSectionProps> = ({
  kind,
  config,
  token,
  onConfigChange,
}) => {
  const keys = fieldKeys(kind);
  const label = LABEL[kind];
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'untested' | 'ok' | 'error'>('untested');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);

  const enabled = Boolean(config[keys.enabled]);
  const url = (config[keys.url] as string) || '';
  const apiKey = (config[keys.apiKey] as string) || '';
  const userId = (config[keys.userId] as string) || '';
  const libraryIds = (config[keys.libraryIds] as string[]) || [];

  const handleStringChange = (field: UrlKey | ApiKeyKey | UserIdKey) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    onConfigChange({ [field]: event.target.value } as Partial<ConfigState>);
    if (field === keys.url || field === keys.apiKey) {
      setTestStatus('untested');
      setTestMessage(null);
    }
  };

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [keys.enabled]: event.target.checked } as Partial<ConfigState>);
  };

  const handleLibraryIdsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parts = event.target.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onConfigChange({ [keys.libraryIds]: parts } as Partial<ConfigState>);
  };

  const connectionPayload = () => ({
    url: url.trim(),
    apiKey: apiKey.trim(),
    userId: userId.trim() || undefined,
  });

  const handleTest = useCallback(async () => {
    if (!token) return;
    setTesting(true);
    setTestStatus('untested');
    setTestMessage(null);
    try {
      const res = await axios.post<{ ok: boolean; version?: string; error?: string }>(
        `/api/mediaservers/${kind}/test`,
        connectionPayload(),
        { headers: { 'x-access-token': token } }
      );
      if (res.data.ok) {
        setTestStatus('ok');
        setTestMessage(res.data.version ? `Connected (v${res.data.version})` : 'Connected');
      } else {
        setTestStatus('error');
        setTestMessage(res.data.error || 'Connection failed');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) ||
        (err instanceof Error ? err.message : 'Connection failed');
      setTestMessage(typeof message === 'string' ? message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  }, [token, kind, url, apiKey, userId]);

  const handleFetchUsers = useCallback(async () => {
    if (!token) return;
    setFetchingUsers(true);
    setUsersError(null);
    try {
      const res = await axios.post<{ users: ServerUser[] }>(
        `/api/mediaservers/${kind}/users`,
        connectionPayload(),
        { headers: { 'x-access-token': token } }
      );
      setUsers(res.data.users || []);
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) ||
        'Failed to fetch users';
      setUsersError(typeof message === 'string' ? message : 'Failed to fetch users');
      setUsers([]);
    } finally {
      setFetchingUsers(false);
    }
  }, [token, kind, url, apiKey]);

  const canTest = Boolean(url.trim() && apiKey.trim() && token);
  const canFetchUsers = Boolean(url.trim() && apiKey.trim() && token);

  const chipLabel = !enabled
    ? 'Disabled'
    : testStatus === 'ok'
    ? 'Connected'
    : testStatus === 'error'
    ? 'Unreachable'
    : 'Not Tested';
  const chipColor: 'default' | 'success' | 'error' | 'warning' =
    !enabled
      ? 'default'
      : testStatus === 'ok'
      ? 'success'
      : testStatus === 'error'
      ? 'error'
      : 'warning';

  return (
    <ConfigurationAccordion
      title={`${label} Integration`}
      chipLabel={chipLabel}
      chipColor={chipColor}
    >
      <Alert severity="info" className="mb-4">
        <AlertTitle>For native playlist support</AlertTitle>
        <Typography variant="body2">
          Connecting {label} is required for Youtarr-managed YouTube playlists to appear as native
          playlists in {label}. Channel downloads still work without this connection; this is
          specifically for the Playlists feature.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={handleToggle}
                inputProps={{ 'aria-label': `Enable ${label} integration` }}
              />
            }
            label={`Enable ${label} integration`}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={`${label} URL`}
            placeholder="http://host:port"
            value={url}
            onChange={handleStringChange(keys.url)}
            helperText={`Base URL of your ${label} server (e.g., http://192.168.1.100:8096)`}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="password"
            label={`${label} API Key`}
            value={apiKey}
            onChange={handleStringChange(keys.apiKey)}
            helperText={`Create an API key in ${label} under Dashboard → API Keys`}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Box className="flex items-end gap-2">
            <TextField
              fullWidth
              label={`${label} User ID`}
              value={userId}
              onChange={handleStringChange(keys.userId)}
              helperText="User account that will own Youtarr-managed playlists"
            />
            <Button
              variant="outlined"
              onClick={handleFetchUsers}
              disabled={!canFetchUsers || fetchingUsers}
              className="whitespace-nowrap"
            >
              {fetchingUsers ? 'Fetching…' : 'Fetch Users'}
            </Button>
          </Box>
          {users.length > 0 && (
            <Box className="mt-2 flex flex-wrap gap-1">
              {users.map((u) => (
                <Chip
                  key={u.id}
                  label={u.name}
                  color={userId === u.id ? 'primary' : 'default'}
                  onClick={() => onConfigChange({ [keys.userId]: u.id } as Partial<ConfigState>)}
                />
              ))}
            </Box>
          )}
          {usersError && (
            <Alert severity="error" className="mt-2">
              {usersError}
            </Alert>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Video Library IDs"
            placeholder="comma,separated,library,ids"
            value={libraryIds.join(', ')}
            onChange={handleLibraryIdsChange}
            helperText={`${label} library IDs that contain your Youtarr videos. Optional; used to narrow playlist item resolution.`}
          />
        </Grid>

        <Grid item xs={12}>
          <Box className="flex items-center flex-wrap gap-2">
            <Button
              variant="contained"
              onClick={handleTest}
              disabled={!canTest || testing}
              color={testStatus === 'ok' ? 'success' : 'primary'}
              className="h-10 min-w-[150px] whitespace-nowrap"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
            {testMessage && (
              <Typography
                variant="body2"
                color={testStatus === 'error' ? 'error' : 'text.secondary'}
              >
                {testMessage}
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};

export default MediaServerPlaylistSection;
