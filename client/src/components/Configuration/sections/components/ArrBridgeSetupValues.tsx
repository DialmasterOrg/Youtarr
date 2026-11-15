import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '../../../ui';
import { SnackbarState } from '../../types';
import {
  ARR_APPS,
  ARR_APP_NAMES,
  ARR_DOCS_URL,
  ArrApp,
  ArrCategory,
  getSetupValues,
} from '../../utils/arrBridgeSetup';
import { locationUtils } from '../../../../utils/location';

const DEFAULT_CATEGORY: Record<ArrApp, string> = { sonarr: 'tv', radarr: 'movies' };

interface ArrBridgeSetupValuesProps {
  bridgeKey: string | null;
  loading: boolean;
  error: string | null;
  regenerating: boolean;
  onRegenerate: () => Promise<boolean>;
  categories: ArrCategory[];
  /** Whether the saved config already has the bridge on. */
  saved: boolean;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

// The category to type into this app: its usual one when Youtarr still has
// it, otherwise whichever the user set up.
function categoryFor(app: ArrApp, categories: ArrCategory[]): string {
  const names = categories.map((category) => category.name);
  return names.includes(DEFAULT_CATEGORY[app]) ? DEFAULT_CATEGORY[app] : names.join(' or ');
}

interface ValueListProps {
  title: string;
  where: string;
  rows: Array<[string, string]>;
}

const ValueList: React.FC<ValueListProps> = ({ title, where, rows }) => (
  <Box className="rounded-[var(--radius-ui)] border border-[var(--border)] bg-muted/30 p-3">
    <Typography variant="subtitle2">{title}</Typography>
    <Typography variant="caption" color="text.secondary">
      {where}
    </Typography>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 break-all font-mono">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  </Box>
);

/**
 * The bridge key and the exact values to type into Sonarr and Radarr.
 */
export const ArrBridgeSetupValues: React.FC<ArrBridgeSetupValuesProps> = ({
  bridgeKey,
  loading,
  error,
  regenerating,
  onRegenerate,
  categories,
  saved,
  setSnackbar,
}) => {
  const [confirmingNewKey, setConfirmingNewKey] = useState(false);

  const values = getSetupValues({
    protocol: locationUtils.getProtocol(),
    hostname: locationUtils.getHostname(),
    port: locationUtils.getPort(),
  });

  const copy = async (text: string, what: string) => {
    try {
      // navigator.clipboard is undefined on plain http, except on localhost.
      await navigator.clipboard.writeText(text);
      setSnackbar({ open: true, message: `${what} copied`, severity: 'success' });
    } catch {
      setSnackbar({
        open: true,
        message: 'Your browser blocked copying. Select the text and copy it yourself.',
        severity: 'warning',
      });
    }
  };

  const createNewKey = async () => {
    setConfirmingNewKey(false);
    const succeeded = await onRegenerate();
    setSnackbar(
      succeeded
        ? { open: true, message: 'Created a new key. Update it in Sonarr and Radarr.', severity: 'success' }
        : { open: true, message: 'Could not create a new key.', severity: 'error' }
    );
  };

  return (
    <Box className="mt-4 flex flex-col gap-4">
      {error && <Alert severity="error">{error}</Alert>}
      {!error && loading && (
        <Typography variant="body2" color="text.secondary">
          Loading the key...
        </Typography>
      )}
      {!error && bridgeKey && (
        <>
          <Box className="flex flex-col gap-3">
            <TextField
              fullWidth
              label="API key"
              value={bridgeKey}
              InputProps={{ readOnly: true }}
              inputProps={{ readOnly: true, onFocus: (event) => event.target.select() }}
            />
            <Box className="flex flex-wrap gap-2">
              <Button variant="contained" onClick={() => copy(bridgeKey, 'API key')}>
                Copy key
              </Button>
              <Button variant="outlined" onClick={() => copy(values.indexerUrl, 'Indexer URL')}>
                Copy indexer URL
              </Button>
              <Button variant="outlined" disabled={regenerating} onClick={() => setConfirmingNewKey(true)}>
                Create new key
              </Button>
            </Box>
            {!saved && <Alert severity="info">These values start working after you save.</Alert>}
          </Box>

          <Box className="grid gap-4 md:grid-cols-2">
            {ARR_APPS.map((app) => (
              <Box key={app} className="flex flex-col gap-2" role="group" aria-label={`In ${ARR_APP_NAMES[app]}`}>
                <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                  In {ARR_APP_NAMES[app]}
                </Typography>
                <ValueList
                  title="Indexer"
                  where="Settings -> Indexers -> Add -> Newznab"
                  rows={[
                    ['URL', values.indexerUrl],
                    ['API Path', values.apiPath],
                    ['API Key', 'the key above'],
                    ['Categories', 'leave the defaults'],
                  ]}
                />
                <ValueList
                  title="Download client"
                  where="Settings -> Download Clients -> Add -> SABnzbd"
                  rows={[
                    ['Host', values.host],
                    ['Port', values.port],
                    ['Use SSL', values.useSsl ? 'Yes' : 'No'],
                    ['URL Base', values.urlBase],
                    ['API Key', 'the key above'],
                    ['Category', categoryFor(app, categories)],
                  ]}
                />
              </Box>
            ))}
          </Box>

          <Typography variant="body2" color="text.secondary">
            The address above is the one this page is open at. If Sonarr or Radarr run in Docker on the same network
            as Youtarr, use Youtarr&apos;s container name and port 3011 instead.
          </Typography>

          <Alert severity="warning">
            <Typography variant="body2">
              Sonarr and Radarr can&apos;t log in, so they use this key. Anyone with it can search and start downloads,
              so treat it like a password. If you use a login proxy like Authelia or Cloudflare Access, add an exception
              for <code>/arr/</code>.{' '}
              <a href={ARR_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Read more
              </a>
            </Typography>
          </Alert>
        </>
      )}

      <Dialog open={confirmingNewKey} onClose={() => setConfirmingNewKey(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a new key?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The current key stops working right away. Update the indexer and the download client in Sonarr and Radarr.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingNewKey(false)}>Cancel</Button>
          <Button variant="contained" onClick={createNewKey}>
            Replace key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArrBridgeSetupValues;
