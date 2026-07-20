import React, { ChangeEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Info } from 'lucide-react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  Tooltip,
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

const ID_PREFIX_LEN = 8;
const ID_SUFFIX_LEN = 6;
const truncateId = (id: string): string =>
  id.length > ID_PREFIX_LEN + ID_SUFFIX_LEN + 1
    ? `${id.slice(0, ID_PREFIX_LEN)}...${id.slice(-ID_SUFFIX_LEN)}`
    : id;

// Emby/Jellyfin user IDs are GUIDs: 32 hex chars, with or without dashes.
const SERVER_USER_ID_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const userLabelId = useId();
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'untested' | 'ok' | 'error'>('untested');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
      // Credentials changed, so the cached user list is stale.
      setUsers([]);
      setUsersError(null);
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
    [keys.url]: url.trim(),
    [keys.apiKey]: apiKey.trim(),
    [keys.userId]: userId.trim() || undefined,
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

  // `silent` skips the error alert for the background mount fetch, which just
  // falls back to the truncated id if it fails.
  const handleFetchUsers = useCallback(
    async (silent = false) => {
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
        if (!silent) {
          const message =
            (axios.isAxiosError(err) && err.response?.data?.error) ||
            'Failed to fetch users';
          setUsersError(typeof message === 'string' ? message : 'Failed to fetch users');
        }
        setUsers([]);
      } finally {
        setFetchingUsers(false);
      }
    },
    [token, kind, url, apiKey]
  );

  const hasCredentials = Boolean(url.trim() && apiKey.trim() && token);

  // Refetch the user list each time the dropdown opens so newly added server
  // accounts show up without re-entering credentials.
  const handleSelectOpen = useCallback(() => {
    if (hasCredentials && !fetchingUsers) {
      handleFetchUsers();
    }
  }, [hasCredentials, fetchingUsers, handleFetchUsers]);

  // Resolve a saved user id to its name on load, so the dropdown isn't showing a
  // raw id. Ref guard fires it once so typing new credentials doesn't refetch per keystroke.
  const didEagerFetch = useRef(false);
  useEffect(() => {
    if (didEagerFetch.current) return;
    if (enabled && hasCredentials && userId) {
      didEagerFetch.current = true;
      handleFetchUsers(true);
    }
  }, [enabled, hasCredentials, userId, handleFetchUsers]);

  const handleUserSelect = (event: SelectChangeEvent) => {
    onConfigChange({ [keys.userId]: String(event.target.value) } as Partial<ConfigState>);
  };

  const selectedUserInList = users.some((u) => u.id === userId);
  const userHelperText =
    !hasCredentials && !manualEntry
      ? `Enter the ${label} URL and API key above, then open this dropdown to load users.`
      : userId
      ? `Account that will own Youtarr-managed playlists. ID: ${truncateId(userId)}`
      : manualEntry
      ? `The user's internal ID from ${label}, not the username.`
      : 'Account that will own Youtarr-managed playlists.';

  const chipLabel = !enabled
    ? 'Disabled'
    : testStatus === 'ok'
    ? 'Connected'
    : testStatus === 'error'
    ? 'Connection Failed'
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
          {/* Masked with CSS rather than type="password" so the browser's
              password manager doesn't treat the URL + key as login credentials
              and prompt to save them. */}
          <TextField
            fullWidth
            type="text"
            autoComplete="off"
            label={`${label} API Key`}
            value={apiKey}
            onChange={handleStringChange(keys.apiKey)}
            helperText={`Create an API key in ${label} under Dashboard → API Keys`}
            style={
              { WebkitTextSecurity: showApiKey ? 'none' : 'disc' } as React.CSSProperties
            }
            inputProps={{ 'data-testid': `${kind}-api-key-input` }}
            InputProps={{
              endAdornment: (
                <IconButton
                  type="button"
                  aria-label={showApiKey ? `Hide ${label} API key` : `Show ${label} API key`}
                  size="small"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="h-5 w-5 text-muted-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </IconButton>
              ),
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Box className="mb-1.5 flex items-center gap-1">
            <InputLabel id={userLabelId}>{label} User</InputLabel>
            <Tooltip
              title={`Youtarr creates and updates playlists owned by this ${label} account. Open the dropdown to load the accounts on your server, then pick one.`}
            >
              <IconButton
                aria-label={`About the ${label} user setting`}
                size="small"
                className="h-5 w-5 text-muted-foreground"
              >
                <Info className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </Box>

          {manualEntry ? (
            <TextField
              fullWidth
              value={userId}
              onChange={handleStringChange(keys.userId)}
              placeholder="Paste the user ID"
              inputProps={{
                'aria-labelledby': userLabelId,
                'data-testid': `${kind}-user-id-input`,
              }}
            />
          ) : (
            <Select
              fullWidth
              value={userId || undefined}
              placeholder={
                <span className="text-muted-foreground">Select a user</span>
              }
              disabled={!hasCredentials}
              onOpen={handleSelectOpen}
              onChange={handleUserSelect}
              labelId={userLabelId}
              inputProps={{ 'data-testid': `${kind}-user-select` }}
            >
              {userId && !selectedUserInList && (
                <MenuItem value={userId}>{truncateId(userId)}</MenuItem>
              )}
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
              {fetchingUsers && (
                <Box className="px-3 py-1.5 text-sm text-muted-foreground">Loading users</Box>
              )}
              {!fetchingUsers && users.length === 0 && !usersError && (
                <Box className="px-3 py-1.5 text-sm text-muted-foreground">No users found</Box>
              )}
            </Select>
          )}

          <FormHelperText>{userHelperText}</FormHelperText>

          {userId.trim() !== '' && !SERVER_USER_ID_PATTERN.test(userId.trim()) && (
            <FormHelperText error>
              {`This doesn't look like ${kind === 'emby' ? 'an' : 'a'} ${label} user ID; IDs are 32-character codes, not usernames. If you can't load the user list, fix the URL/API key above, then pick the user from the dropdown.`}
            </FormHelperText>
          )}

          <Button
            variant="link"
            size="small"
            type="button"
            onClick={() => setManualEntry((prev) => !prev)}
            className="mt-1 h-auto px-0"
          >
            {manualEntry ? 'Choose from list' : 'Enter ID manually'}
          </Button>

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
              disabled={!hasCredentials || testing}
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
