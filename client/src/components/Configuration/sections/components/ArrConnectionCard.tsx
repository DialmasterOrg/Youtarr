import React, { ChangeEvent, useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '../../../ui';
import { ARR_APP_NAMES, ArrApp, ArrConnectionResult, ArrConnectionView } from '../../utils/arrBridgeSetup';

const DEFAULT_PORT: Record<ArrApp, number> = { sonarr: 8989, radarr: 7878 };

interface ArrConnectionCardProps {
  app: ArrApp;
  connection: ArrConnectionView;
  busy: boolean;
  onSave: (url: string, apiKey: string) => Promise<ArrConnectionResult>;
  onTest: () => Promise<ArrConnectionResult>;
  onRemove: () => Promise<boolean>;
}

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '');

/**
 * The connection to the user's own Sonarr or Radarr. It is saved by its own
 * button, not the page's Save: the server tests the address and key and
 * stores them together. A saved key is never loaded into this page. A key
 * typed here stays in the field while the page is open, so a wrong address
 * is corrected by editing the address alone.
 */
export const ArrConnectionCard: React.FC<ArrConnectionCardProps> = ({
  app,
  connection,
  busy,
  onSave,
  onTest,
  onRemove,
}) => {
  const appName = ARR_APP_NAMES[app];
  const [url, setUrl] = useState(connection.url ?? '');
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<ArrConnectionResult | null>(null);

  const urlChanged = withoutTrailingSlash(url) !== (connection.url ?? '');
  const canSave = !busy && url.trim() !== '' && apiKey.trim() !== '';
  const canTest = !busy && connection.keySet && !urlChanged;
  const hasConnection = connection.keySet || connection.url !== null;

  let keyHelp = `In ${appName}: Settings -> General -> API Key.`;
  if (connection.keySet) keyHelp = 'A key is saved. Type it again only to change the address or the key.';
  if (connection.keySet && urlChanged && apiKey === '') {
    keyHelp = 'Type the API key again. Youtarr never sends a saved key to a new address.';
  }

  // A result describes what was tested, so it goes once the fields differ.
  const edit = (setField: (value: string) => void, value: string) => {
    setField(value);
    setResult(null);
  };

  const save = async () => {
    setResult(null);
    const outcome = await onSave(url.trim(), apiKey.trim());
    setResult(outcome);
    if (outcome.ok && outcome.connection?.url) setUrl(outcome.connection.url);
  };

  const test = async () => {
    setResult(null);
    setResult(await onTest());
  };

  const remove = async () => {
    setResult(null);
    if (!(await onRemove())) {
      setResult({ ok: false, message: `Could not remove the ${appName} connection.` });
      return;
    }
    setUrl('');
    setApiKey('');
  };

  return (
    <Box
      className="flex flex-col gap-3 rounded-[var(--radius-ui)] border border-[var(--border)] p-3"
      role="group"
      aria-label={`${appName} connection`}
    >
      <Box className="flex flex-wrap items-center justify-between gap-2">
        <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
          {appName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {connection.keySet ? 'Saved' : 'Not set up'}
        </Typography>
      </Box>

      <TextField
        fullWidth
        label={`${appName} address`}
        value={url}
        placeholder={`http://${app}:${DEFAULT_PORT[app]}`}
        onChange={(event: ChangeEvent<HTMLInputElement>) => edit(setUrl, event.target.value)}
        helperText={`The address Youtarr reaches ${appName} at, with its URL Base if it has one. Not an address behind a login page.`}
      />
      <TextField
        fullWidth
        type="password"
        autoComplete="off"
        label={`${appName} API key`}
        value={apiKey}
        onChange={(event: ChangeEvent<HTMLInputElement>) => edit(setApiKey, event.target.value)}
        helperText={keyHelp}
      />

      <Box className="flex flex-wrap gap-2">
        <Button variant="contained" disabled={!canSave} onClick={save}>
          Test and save
        </Button>
        <Button variant="outlined" disabled={!canTest} onClick={test}>
          Test saved connection
        </Button>
        {hasConnection && (
          <Button disabled={busy} onClick={remove}>
            Remove
          </Button>
        )}
      </Box>

      {result?.ok && (
        <Alert severity="success">
          {`Connected to ${result.appName ?? appName}${result.version ? ` ${result.version}` : ''}.`}
        </Alert>
      )}
      {result && !result.ok && (
        <Alert severity="error">{result.message ?? `Could not connect to ${appName}.`}</Alert>
      )}
    </Box>
  );
};

export default ArrConnectionCard;
