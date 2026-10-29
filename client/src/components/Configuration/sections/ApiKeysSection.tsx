import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography,
  Alert,
  Skeleton,
  Snackbar,
  Divider,
} from '../../ui';
import { AlertTriangle as WarningIcon } from 'lucide-react';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';

import { locationUtils } from '../../../utils/location';
import BookmarkletKeysSection from './ApiKeysSection/BookmarkletKeysSection';
import ConfirmKeyActionDialog from './ApiKeysSection/ConfirmKeyActionDialog';
import CreateKeyDialog from './ApiKeysSection/CreateKeyDialog';
import CreatedKeyDialog from './ApiKeysSection/CreatedKeyDialog';
import EditKeyDialog from './ApiKeysSection/EditKeyDialog';
import ExternalKeysSection from './ApiKeysSection/ExternalKeysSection';
import { apiKeyError } from './ApiKeysSection/apiKeyError';
import { ApiKey, ApiKeyRole, ApiKeyCreatedResponse, useApiKeys } from './ApiKeysSection/useApiKeys';

const SECTION_TITLE = 'API Keys & Bookmarklet';

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
      setSnackbar({ open: true, message: 'Unable to copy. Select and copy it manually.' });
    }
  };

  const closeCreatedKeyDialog = () => {
    setCreatedKeyDialogOpen(false);
    setCreatedKey(null);
  };

  if (loading) {
    return (
      <ConfigurationAccordion title={SECTION_TITLE}>
        <Skeleton variant="rectangular" height={200} />
      </ConfigurationAccordion>
    );
  }

  const externalKeys = apiKeys.filter((key) => key.role !== 'legacy_download');
  const bookmarkletKeys = apiKeys.filter((key) => key.role === 'legacy_download');

  return (
    <ConfigurationAccordion
      title={SECTION_TITLE}
      statusBanner={externalApiEnabled ? {
        enabled: showRequestsNavLink,
        label: 'Show Requests in navigation',
        onToggle: onShowRequestsNavLinkChange,
        onText: 'Requests navigation link shown',
        offText: 'Requests navigation link hidden',
        toggleTestId: 'requests-nav-link-switch',
      } : undefined}
    >
      {isHttpWarning && (
        <Alert severity="warning" className="mb-4" icon={<WarningIcon size={20} />}>
          Creating API keys over HTTP is insecure. Use HTTPS in production.
        </Alert>
      )}

      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <BookmarkletKeysSection
        keys={bookmarkletKeys}
        rateLimit={apiKeyRateLimit}
        onRateLimitChange={onRateLimitChange}
        onCreate={() => openCreateDialog('legacy')}
        onRevoke={openDeleteConfirmDialog}
      />

      {externalApiEnabled && (
        <>
          <Divider className="my-6" />
          <ExternalKeysSection
            keys={externalKeys}
            onCreate={() => openCreateDialog('external')}
            onEdit={openEditDialog}
            onRegenerate={(key) => setRegenerateConfirmDialog({ open: true, key })}
            onRevoke={openDeleteConfirmDialog}
          />
        </>
      )}

      {createDialogOpen && (createKeyType === 'legacy' || externalApiEnabled) && (
        <CreateKeyDialog
          key={token}
          api={apiKeyApi}
          createKeyType={createKeyType}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={(key, role) => {
            setCreatedKey(key);
            setCreatedKeyRole(role);
            setCreatedKeyAction('created');
            setCreateDialogOpen(false);
            setCreatedKeyDialogOpen(true);
            void fetchApiKeys();
          }}
        />
      )}
      {externalApiEnabled && editKey && (
        <EditKeyDialog
          key={`${token}:${editKey.id}`}
          apiKey={editKey}
          api={apiKeyApi}
          onClose={() => setEditKey(null)}
          onSaved={() => {
            setEditKey(null);
            setSnackbar({ open: true, message: 'External access updated' });
            void fetchApiKeys();
          }}
        />
      )}

      <CreatedKeyDialog
        open={createdKeyDialogOpen}
        createdKey={createdKey}
        role={createdKeyRole}
        action={createdKeyAction}
        onClose={closeCreatedKeyDialog}
        onCopy={(text, label) => void copyToClipboard(text, label)}
      />

      <ConfirmKeyActionDialog
        open={regenerateConfirmDialog.open}
        title="Regenerate API Key?"
        confirmLabel="Regenerate Key"
        busyLabel="Regenerating…"
        busy={regenerating}
        onCancel={() => setRegenerateConfirmDialog({ open: false, key: null })}
        onConfirm={handleRegenerateKey}
      >
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
      </ConfirmKeyActionDialog>

      <ConfirmKeyActionDialog
        open={deleteConfirmDialog.open}
        title="Revoke API Key?"
        confirmLabel="Revoke"
        busy={revoking}
        onCancel={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}
        onConfirm={handleDeleteKey}
      >
        <Typography>
          Are you sure you want to revoke the API key <strong>"{deleteConfirmDialog.keyName}"</strong>?
        </Typography>
        <Typography variant="body2" color="secondary" className="mt-2">
          Any integration using this key will stop working immediately. Its audit history is retained.
        </Typography>
      </ConfirmKeyActionDialog>

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
