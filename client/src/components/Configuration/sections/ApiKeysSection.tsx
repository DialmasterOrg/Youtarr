import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Chip,
  Skeleton,
  Snackbar,
  Divider,
} from '../../ui';
import {
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Copy as ContentCopyIcon,
  AlertTriangle as WarningIcon,
  Filter as FilterIcon,
} from 'lucide-react';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';

import { locationUtils } from '../../../utils/location';
import CreateKeyDialog from './ApiKeysSection/CreateKeyDialog';
import EditKeyDialog from './ApiKeysSection/EditKeyDialog';
import ExternalKeyCard, { formatKeyDate } from './ApiKeysSection/ExternalKeyCard';
import { apiKeyError } from './ApiKeysSection/apiKeyError';
import { ApiKey, ApiKeyRole, ApiKeyCreatedResponse, useApiKeys } from './ApiKeysSection/useApiKeys';


interface ApiKeysSectionProps {
  token: string | null;
  apiKeyRateLimit: number;
  onRateLimitChange: (value: number) => void;
  externalApiEnabled?: boolean;
  showRequestsNavLink: boolean;
  onShowRequestsNavLinkChange: (value: boolean) => void;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  token,
  apiKeyRateLimit,
  onRateLimitChange,
  externalApiEnabled = false,
  showRequestsNavLink,
  onShowRequestsNavLinkChange,
}) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createKeyType, setCreateKeyType] = useState<'external' | 'legacy'>('external');
  const [createdKeyDialogOpen, setCreatedKeyDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [createdKeyRole, setCreatedKeyRole] = useState<ApiKeyRole>('legacy_download');
  const [createdKeyAction, setCreatedKeyAction] = useState<'created' | 'regenerated'>('created');
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const apiKeyApi = useApiKeys(token);
  const [externalKeySearch, setExternalKeySearch] = useState('');
  const [showActiveExternalKeys, setShowActiveExternalKeys] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; keyId: number | null; keyName: string }>({
    open: false,
    keyId: null,
    keyName: '',
  });
  const [regenerateConfirmDialog, setRegenerateConfirmDialog] = useState<{
    open: boolean;
    key: ApiKey | null;
  }>({ open: false, key: null });
  const [regenerating, setRegenerating] = useState(false);
  const [isHttpWarning] = useState(
    locationUtils.getProtocol() !== 'https:' && locationUtils.getHostname() !== 'localhost'
  );

  const loadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const mutationBusy = useRef(false);
  const [revoking, setRevoking] = useState(false);
  const fetchApiKeys = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const keys = await apiKeyApi.fetchApiKeys();
      if (sequence === loadSequence.current) { setApiKeys(keys); setError(null); }
    } catch (err) {
      if (sequence === loadSequence.current) setError(apiKeyError(err, 'Failed to fetch API keys'));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [apiKeyApi]);

  useEffect(() => {
    ++sessionSequence.current;
    setLoading(true);
    setCreateDialogOpen(false); setEditKey(null); setCreatedKeyDialogOpen(false); setCreatedKey(null);
    void fetchApiKeys();
    return () => { ++loadSequence.current; ++sessionSequence.current; };
  }, [fetchApiKeys]);

  const openCreateDialog = (type: 'external' | 'legacy' = 'external') => {
    setCreateKeyType(type); setCreateDialogOpen(true);
  };
  const openEditDialog = (key: ApiKey) => {
    if (token && key.role !== 'legacy_download' && !key.revoked_at) setEditKey(key);
  };

  const handleDeleteKey = async () => {
    if (!token || !deleteConfirmDialog.keyId || mutationBusy.current) return;
    mutationBusy.current = true; setRevoking(true); setError(null);
    const session = sessionSequence.current;
    try {
      await apiKeyApi.revokeApiKey(deleteConfirmDialog.keyId);
      if (session !== sessionSequence.current) return;
      setSnackbar({ open: true, message: 'API key revoked' });
      void fetchApiKeys();
    } catch (err) {
      if (session === sessionSequence.current) setError(apiKeyError(err, 'Failed to revoke API key'));
    } finally {
      mutationBusy.current = false; setRevoking(false);
      setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' });
    }
  };

  const openDeleteConfirmDialog = (id: number, name: string) => {
    setDeleteConfirmDialog({ open: true, keyId: id, keyName: name });
  };

  const handleRegenerateKey = async () => {
    if (!token || !regenerateConfirmDialog.key || mutationBusy.current) return;
    mutationBusy.current = true; setError(null);
    const session = sessionSequence.current;
    const key = regenerateConfirmDialog.key;
    setRegenerating(true);
    try {
      const body = await apiKeyApi.regenerateApiKey(key.id);
      if (session !== sessionSequence.current) return;
      setRegenerateConfirmDialog({ open: false, key: null });
      setCreatedKey(body);
      setCreatedKeyRole(key.role);
      setCreatedKeyAction('regenerated');
      setCreatedKeyDialogOpen(true);
      await fetchApiKeys();
    } catch (err) {
      if (session === sessionSequence.current) setError(apiKeyError(err, 'Failed to regenerate API key'));
    } finally {
      mutationBusy.current = false;
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbar({ open: true, message: `${label} copied to clipboard` });
    } catch {
      setSnackbar({ open: true, message: 'Unable to copy. Select and copy the key manually.' });
    }
  };


  if (loading) {
    return (
      <ConfigurationAccordion title="API Keys & External Access">
        <Skeleton variant="rectangular" height={200} />
      </ConfigurationAccordion>
    );
  }

  const externalKeys = apiKeys.filter((key) => key.role !== 'legacy_download');
  const legacyKeys = apiKeys.filter((key) => key.role === 'legacy_download');
  const normalizedExternalKeySearch = externalKeySearch.trim().toLocaleLowerCase();
  const visibleExternalKeys = externalKeys
    .filter((key) => !showActiveExternalKeys || (key.is_active && !key.revoked_at))
    .filter((key) => !normalizedExternalKeySearch ||
      key.name.toLocaleLowerCase().includes(normalizedExternalKeySearch))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <ConfigurationAccordion
      title="API Keys & External Access"
      statusBanner={externalApiEnabled ? {
        enabled: showRequestsNavLink,
        label: 'Show Requests in navigation',
        onToggle: onShowRequestsNavLinkChange,
        onText: 'Requests navigation link shown',
        offText: 'Requests navigation link hidden',
        toggleTestId: 'requests-nav-link-switch',
      } : undefined}
    >
      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {externalApiEnabled ? (
        <>
      <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="subtitle1">External access keys</Typography>
          <Typography variant="body2" color="secondary" className="mt-1 max-w-2xl">
            Every external key can view its approved channels. Add only the request permissions
            the integration needs.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon size={16} />}
          onClick={() => openCreateDialog('external')}
          size="small"
        >
          Create external key
        </Button>
      </Box>

      {isHttpWarning && (
        <Alert severity="warning" className="mb-4" icon={<WarningIcon size={20} />}>
          Creating API keys over HTTP is insecure. Use HTTPS in production.
        </Alert>
      )}


      {externalKeys.length > 0 && (
        <Box className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-stretch">
          <TextField
            label="Search external access keys"
            value={externalKeySearch}
            onChange={(event) => setExternalKeySearch(event.target.value)}
            fullWidth
            size="small"
          />
          <Button
            variant={showActiveExternalKeys ? 'contained' : 'outlined'}
            startIcon={<FilterIcon size={16} />}
            onClick={() => setShowActiveExternalKeys((current) => !current)}
            aria-pressed={showActiveExternalKeys}
            size="small"
            className="shrink-0 self-start sm:self-stretch"
            style={{ height: 'auto' }}
          >
            Active only
          </Button>
        </Box>
      )}

      {externalKeys.length === 0 ? (
        <Paper className="border border-dashed border-border p-6 text-center shadow-none">
          <Typography color="secondary">
            No external access keys yet.
          </Typography>
        </Paper>
      ) : visibleExternalKeys.length === 0 ? (
        <Paper className="border border-dashed border-border p-6 text-center shadow-none">
          <Typography color="secondary">
            No external access keys match the current search and filter.
          </Typography>
        </Paper>
      ) : (
        <div className="grid gap-3" aria-label="External API key cards">
          {visibleExternalKeys.map((key) => {
            return <ExternalKeyCard key={key.id} apiKey={key} onEdit={openEditDialog}
              onRegenerate={key => setRegenerateConfirmDialog({ open: true, key })} onRevoke={openDeleteConfirmDialog} />;
          })}
        </div>
      )}

        </>
      ) : (
        <Alert severity="info" className="mb-4">
          External API access is disabled by the EXTERNAL_API_ENABLED environment setting.
        </Alert>
      )}

      <Divider className="my-6" />

      <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="subtitle1">Legacy download keys</Typography>
          <Typography variant="body2" color="secondary" className="mt-1 max-w-2xl">
            For the deprecated bookmarklet and <code>/api/videos/download</code> workflow only.
            Legacy keys cannot access <code>/external-api/v1</code>.
          </Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<AddIcon size={16} />}
          onClick={() => openCreateDialog('legacy')}
          size="small"
        >
          Create legacy key
        </Button>
      </Box>

      <Box className="mb-4 flex items-center">
        <TextField
          type="number"
          label="Legacy rate limit (requests/min)"
          value={apiKeyRateLimit}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 100) {
              onRateLimitChange(val);
            }
          }}
          inputProps={{ min: 1, max: 100 }}
          size="small"
          className="w-[240px]"
        />
        <InfoTooltip text="Maximum bookmarklet download requests per minute for each legacy key." />
      </Box>

      {legacyKeys.length === 0 ? (
        <Typography variant="body2" color="secondary">
          No legacy download keys.
        </Typography>
      ) : (
        <div className="grid gap-2" aria-label="Legacy API key rows">
          {legacyKeys.map((key) => (
            <Paper
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border p-3 shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Typography variant="subtitle2" className="truncate">{key.name}</Typography>
                  <Chip
                    label={key.revoked_at ? 'Revoked' : 'Legacy download'}
                    size="small"
                    color={key.revoked_at ? 'error' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    label={`${key.usage_count} ${key.usage_count === 1 ? 'use' : 'uses'}`}
                    size="small"
                    variant="outlined"
                  />
                </div>
                <Typography variant="caption" color="secondary">
                  Last used {formatKeyDate(key.last_used_at)}
                </Typography>
              </div>
              {!key.revoked_at && (
                <Tooltip title="Revoke">
                  <IconButton
                    size="small"
                    onClick={() => openDeleteConfirmDialog(key.id, key.name)}
                    color="error"
                    aria-label={`Revoke ${key.name}`}
                  >
                    <DeleteIcon size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </div>
      )}

      {createDialogOpen && (createKeyType === 'legacy' || externalApiEnabled) && <CreateKeyDialog key={token} api={apiKeyApi} createKeyType={createKeyType}
        onClose={() => setCreateDialogOpen(false)} onCreated={(key, role) => {
          setCreatedKey(key); setCreatedKeyRole(role); setCreatedKeyAction('created');
          setCreateDialogOpen(false); setCreatedKeyDialogOpen(true); void fetchApiKeys();
        }} />}
      {externalApiEnabled && editKey && <EditKeyDialog key={`${token}:${editKey.id}`} apiKey={editKey} api={apiKeyApi}
        onClose={() => setEditKey(null)} onSaved={() => {
          setEditKey(null); setSnackbar({ open: true, message: 'External access updated' }); void fetchApiKeys();
        }} />}

      {/* Key Created Dialog */}
      <Dialog
        open={createdKeyDialogOpen}
        onClose={() => { setCreatedKeyDialogOpen(false); setCreatedKey(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          ✓ API Key {createdKeyAction === 'regenerated' ? 'Regenerated' : 'Created'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-6">
            Save this key now - it will not be shown again!
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Your API Key
          </Typography>
          <Paper
            className="p-4 mb-6 flex items-center justify-between bg-muted/50 font-mono break-all"
          >
            <code>{createdKey?.key}</code>
            <IconButton
              aria-label="Copy API key"
              onClick={() => void copyToClipboard(createdKey?.key || '', 'API key')}
              size="small"
            >
              <ContentCopyIcon size={16} />
            </IconButton>
          </Paper>

          {createdKeyRole === 'legacy_download' ? (
            <Paper className="p-4 bg-muted/50">
              <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                <strong>API endpoint:</strong> {locationUtils.getOrigin()}/api/videos/download
              </Typography>
            </Paper>
          ) : (
            <Paper className="p-4 bg-muted/50">
              <Typography variant="body2" className="mb-2">
                Use this key only with <strong>{locationUtils.getOrigin()}/external-api/v1</strong>.
              </Typography>
              <Typography variant="body2" color="secondary">
                Only approved channels are available. You can update grants from this key&apos;s edit action.
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreatedKeyDialogOpen(false); setCreatedKey(null); }} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={regenerateConfirmDialog.open}
        onClose={() => !regenerating &&
          setRegenerateConfirmDialog({ open: false, key: null })}
      >
        <DialogTitle>Regenerate API Key?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-3">
            The current key will stop working immediately.
          </Alert>
          <Typography>
            Regenerate <strong>&quot;{regenerateConfirmDialog.key?.name}&quot;</strong>?
          </Typography>
          <Typography variant="body2" color="secondary" className="mt-2">
            Its permissions and approved channels will stay the same. The replacement key is
            shown only once, so copy it before closing the next dialog.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRegenerateConfirmDialog({ open: false, key: null })}
            disabled={regenerating}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRegenerateKey}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => !revoking && setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}
      >
        <DialogTitle>Revoke API Key?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke the API key <strong>"{deleteConfirmDialog.keyName}"</strong>?
          </Typography>
          <Typography variant="body2" color="secondary" className="mt-2">
            Any integration using this key will stop working immediately. Its audit history is retained.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={revoking} onClick={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}>
            Cancel
          </Button>
          <Button disabled={revoking} onClick={handleDeleteKey} color="error" variant="contained">
            Revoke
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </ConfigurationAccordion>
  );
};

export default ApiKeysSection;
