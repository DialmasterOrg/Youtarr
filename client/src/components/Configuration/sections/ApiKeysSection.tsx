import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography,
  Alert,
  Skeleton,
  Snackbar,
  Divider,
} from '../../ui';
import { Warning as WarningIcon } from '../../../lib/icons';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';

import { locationUtils } from '../../../utils/location';
import BookmarkletKeysSection from './ApiKeysSection/BookmarkletKeysSection';
import ConfirmDialog from '../../shared/ConfirmDialog';
import CreateKeyDialog from './ApiKeysSection/CreateKeyDialog';
import CreatedKeyDialog from './ApiKeysSection/CreatedKeyDialog';
import EditKeyDialog from './ApiKeysSection/EditKeyDialog';
import ExternalKeysSection from './ApiKeysSection/ExternalKeysSection';
import { apiKeyError } from './ApiKeysSection/apiKeyError';
import {
  ApiKey,
  ApiKeyRole,
  ApiKeyCreatedResponse,
  isSimpleKeyRole,
  useApiKeys,
} from './ApiKeysSection/useApiKeys';

const SECTION_TITLE = 'API Keys & Bookmarklet';

interface CreatedKey {
  key: ApiKeyCreatedResponse;
  role: ApiKeyRole;
  action: 'created' | 'regenerated';
}

// The key a revoke or regenerate confirmation is for; a revoke needs only its id and name.
interface KeyConfirm {
  key: (Pick<ApiKey, 'id' | 'name'> & Partial<Pick<ApiKey, 'role'>>) | null;
  busy: boolean;
}

const CLOSED_CONFIRM: KeyConfirm = { key: null, busy: false };

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
  // The key type whose create dialog is open, or null when it is closed.
  const [createKeyType, setCreateKeyType] = useState<'external' | 'legacy' | null>(null);
  // The one-time secret on show, with how it came about.
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const apiKeyApi = useApiKeys(token);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [revokeConfirm, setRevokeConfirm] = useState<KeyConfirm>(CLOSED_CONFIRM);
  const [regenerateConfirm, setRegenerateConfirm] = useState<KeyConfirm>(CLOSED_CONFIRM);
  const isHttpWarning =
    locationUtils.getProtocol() !== 'https:' && locationUtils.getHostname() !== 'localhost';

  const loadSequence = useRef(0);
  const sessionSequence = useRef(0);
  const mutationBusy = useRef(false);
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
    setCreateKeyType(null); setEditKey(null); setCreated(null);
    void fetchApiKeys();
    return () => { ++loadSequence.current; ++sessionSequence.current; };
  }, [fetchApiKeys]);

  const openEditDialog = (key: ApiKey) => {
    if (token && !isSimpleKeyRole(key.role) && !key.revoked_at) setEditKey(key);
  };

  const handleDeleteKey = async () => {
    const { key } = revokeConfirm;
    if (!token || !key || mutationBusy.current) return;
    mutationBusy.current = true; setRevokeConfirm({ key, busy: true }); setError(null);
    const session = sessionSequence.current;
    try {
      await apiKeyApi.revokeApiKey(key.id);
      if (session !== sessionSequence.current) return;
      setSnackbar({ open: true, message: 'API key revoked' });
      void fetchApiKeys();
    } catch (err) {
      if (session === sessionSequence.current) setError(apiKeyError(err, 'Failed to revoke API key'));
    } finally {
      mutationBusy.current = false;
      setRevokeConfirm(CLOSED_CONFIRM);
    }
  };

  const openDeleteConfirmDialog = (id: number, name: string) => {
    setRevokeConfirm({ key: { id, name }, busy: false });
  };

  const handleRegenerateKey = async () => {
    const { key } = regenerateConfirm;
    if (!token || !key?.role || mutationBusy.current) return;
    const { role } = key;
    mutationBusy.current = true; setRegenerateConfirm({ key, busy: true }); setError(null);
    const session = sessionSequence.current;
    try {
      const body = await apiKeyApi.regenerateApiKey(key.id);
      if (session !== sessionSequence.current) return;
      setCreated({ key: body, role, action: 'regenerated' });
      await fetchApiKeys();
    } catch (err) {
      // The confirmation closes either way, so the error alert behind it is visible.
      if (session === sessionSequence.current) setError(apiKeyError(err, 'Failed to regenerate API key'));
    } finally {
      mutationBusy.current = false;
      setRegenerateConfirm(CLOSED_CONFIRM);
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

  if (loading) {
    return (
      <ConfigurationAccordion title={SECTION_TITLE}>
        <Skeleton variant="rectangular" height={200} />
      </ConfigurationAccordion>
    );
  }

  const externalKeys = apiKeys.filter((key) => !isSimpleKeyRole(key.role));
  // GET /api/keys returns revoked keys for the external audit trail; the
  // bookmarklet list shows only the keys that still work.
  const bookmarkletKeys = apiKeys.filter((key) => isSimpleKeyRole(key.role) && !key.revoked_at);
  // Active external keys still count toward the key limit while the External
  // API is off, so they stay listed where they can be revoked.
  const showExternalKeys = externalApiEnabled ||
    externalKeys.some((key) => key.is_active && !key.revoked_at);

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
        onCreate={() => setCreateKeyType('legacy')}
        onRevoke={openDeleteConfirmDialog}
      />

      {showExternalKeys && (
        <>
          <Divider className="my-6" />
          <ExternalKeysSection
            keys={externalKeys}
            externalApiEnabled={externalApiEnabled}
            onCreate={() => setCreateKeyType('external')}
            onEdit={openEditDialog}
            onRegenerate={(key) => setRegenerateConfirm({ key, busy: false })}
            onRevoke={openDeleteConfirmDialog}
          />
        </>
      )}

      {createKeyType && (createKeyType === 'legacy' || externalApiEnabled) && (
        <CreateKeyDialog
          key={token}
          api={apiKeyApi}
          createKeyType={createKeyType}
          onClose={() => setCreateKeyType(null)}
          onCreated={(key, role) => {
            setCreated({ key, role, action: 'created' });
            setCreateKeyType(null);
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
        open={created !== null}
        createdKey={created?.key ?? null}
        role={created?.role ?? 'legacy_download'}
        action={created?.action ?? 'created'}
        onClose={() => setCreated(null)}
        onCopy={(text, label) => void copyToClipboard(text, label)}
      />

      <ConfirmDialog
        open={regenerateConfirm.key !== null}
        tone="danger"
        title="Regenerate API Key?"
        confirmLabel="Regenerate Key"
        busyLabel="Regenerating…"
        busy={regenerateConfirm.busy}
        onCancel={() => setRegenerateConfirm(CLOSED_CONFIRM)}
        onConfirm={handleRegenerateKey}
      >
        <Alert severity="warning" className="mb-3">
          The current key will stop working immediately.
        </Alert>
        <Typography>
          Regenerate <strong>&quot;{regenerateConfirm.key?.name}&quot;</strong>?
        </Typography>
        <Typography variant="body2" color="secondary" className="mt-2">
          Its permissions and approved channels will stay the same. The replacement key is
          shown only once, so copy it before closing the next dialog.
        </Typography>
      </ConfirmDialog>

      <ConfirmDialog
        open={revokeConfirm.key !== null}
        tone="danger"
        title="Revoke API Key?"
        confirmLabel="Revoke"
        busy={revokeConfirm.busy}
        onCancel={() => setRevokeConfirm(CLOSED_CONFIRM)}
        onConfirm={handleDeleteKey}
      >
        <Typography>
          Are you sure you want to revoke the API key <strong>"{revokeConfirm.key?.name}"</strong>?
        </Typography>
        <Typography variant="body2" color="secondary" className="mt-2">
          Any integration using this key will stop working immediately. Its audit history is retained.
        </Typography>
      </ConfirmDialog>

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
