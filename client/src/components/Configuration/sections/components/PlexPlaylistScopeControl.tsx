import React, { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '../../../ui';

// Sentinel understood by the backend Plex adapter: send playlist requests with
// no token, matching the anonymous session Plex Web uses on an unclaimed server.
export const UNCLAIMED_SERVER_SENTINEL = 'UNCLAIMED_SERVER';

export type PlexPlaylistScopeMode = 'admin' | 'unclaimed' | 'user';

export const deriveScopeMode = (value: string): PlexPlaylistScopeMode => {
  if (value === UNCLAIMED_SERVER_SENTINEL) return 'unclaimed';
  if (value && value.trim() !== '') return 'user';
  return 'admin';
};

interface PlexPlaylistScopeControlProps {
  /** Current plexPlaylistToken config value ('' | 'UNCLAIMED_SERVER' | a token). */
  value: string;
  onChange: (value: string) => void;
  /** Claimed status from the last Plex connection test: true/false, or null if unknown. */
  serverClaimed?: boolean | null;
}

export const PlexPlaylistScopeControl: React.FC<PlexPlaylistScopeControlProps> = ({
  value,
  onChange,
  serverClaimed = null,
}) => {
  // Mode is tracked locally so that selecting "specific user account" before
  // typing a token does not collapse back to "admin" (both map to an empty
  // stored value until a token is entered).
  const [mode, setMode] = useState<PlexPlaylistScopeMode>(() => deriveScopeMode(value));

  const tokenValue = mode === 'user' ? value : '';

  const handleModeChange = (event: SelectChangeEvent) => {
    const next = event.target.value as PlexPlaylistScopeMode;
    setMode(next);
    if (next === 'admin') onChange('');
    else if (next === 'unclaimed') onChange(UNCLAIMED_SERVER_SENTINEL);
    else onChange(tokenValue); // 'user': preserve any token already typed
  };

  const handleTokenChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const showUnclaimedHint = serverClaimed === false && mode !== 'unclaimed';

  return (
    <Box className="flex flex-col gap-3">
      <Select
        fullWidth
        label="Playlist visibility scope"
        name="plexPlaylistScopeMode"
        value={mode}
        onChange={handleModeChange}
        inputProps={{ 'data-testid': 'plex-playlist-scope-select' }}
      >
        <MenuItem value="admin">Use my Plex admin account (default)</MenuItem>
        <MenuItem value="unclaimed">Unclaimed server (anonymous LAN access)</MenuItem>
        <MenuItem value="user">A specific Plex user account</MenuItem>
      </Select>

      {mode === 'user' && (
        <TextField
          fullWidth
          label="Plex user account token"
          name="plexPlaylistToken"
          value={tokenValue}
          onChange={handleTokenChange}
          helperText="Paste the X-Plex-Token for the account that should own Youtarr playlists."
          inputProps={{ 'data-testid': 'plex-playlist-token-input' }}
        />
      )}

      {showUnclaimedHint && (
        <Alert severity="warning" data-testid="plex-unclaimed-hint">
          <AlertTitle>This Plex server appears to be unclaimed</AlertTitle>
          <Typography variant="body2">
            On an unclaimed server, Plex Web browses without a token, so playlists
            created under your admin account will not be visible. Choose{' '}
            <b>Unclaimed server (anonymous LAN access)</b> above so Youtarr playlists
            appear in your Plex Web session.
          </Typography>
        </Alert>
      )}

      <Alert severity="info">
        <Typography variant="body2">
          On a claimed Plex server, Youtarr playlists are created under your admin
          account and are visible to you. To let other Plex users see a playlist,
          share it from Plex Web (open the playlist &rarr; menu &rarr; Share). Youtarr
          cannot grant per-user access automatically.
        </Typography>
      </Alert>
    </Box>
  );
};
