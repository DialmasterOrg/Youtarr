import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TextField,
  Typography,
} from '../../../ui';
import { AlertTriangle as WarningIcon } from 'lucide-react';
import {
  ApiKeyCreatedResponse,
  ApiKeyRole,
  normalizePolicy,
  useApiKeys,
} from './useApiKeys';
import { defaultPolicy } from './policy';
import { apiKeyError } from './apiKeyError';
import type { ChannelListEntry } from '../../../Subscriptions/hooks/useChannelList';
import PolicyEditor from './PolicyEditor';
import ChannelGrantPicker from './ChannelGrantPicker';

interface Props {
  api: ReturnType<typeof useApiKeys>;
  createKeyType: 'external' | 'legacy';
  onClose: () => void;
  onCreated: (key: ApiKeyCreatedResponse, role: ApiKeyRole) => void;
}
export default function CreateKeyDialog({
  api,
  createKeyType,
  onClose,
  onCreated,
}: Props) {
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPolicy, setNewKeyPolicy] = useState(defaultPolicy);
  const [newKeyChannelIds, setNewKeyChannelIds] = useState<number[]>([]);
  const [newKeyChannelSearch, setNewKeyChannelSearch] = useState('');
  const [channelState, setChannelState] = useState<{
    channels: ChannelListEntry[];
    loading: boolean;
    error: string | null;
  }>({ channels: [], loading: createKeyType === 'external', error: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const active = useRef(true);
  const {
    channels: channelOptions,
    loading: channelsLoading,
    error: channelsError,
  } = channelState;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (createKeyType === 'legacy') return;
    const controller = new AbortController();
    setChannelState({ channels: [], loading: true, error: null });
    void api
      .fetchAvailableChannels(controller.signal)
      .then((channels) => {
        if (!controller.signal.aborted)
          setChannelState({
            channels: channels.filter((channel) => !channel.terminated_at),
            loading: false,
            error: null,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setChannelState({
            channels: [],
            loading: false,
            error: apiKeyError(error, 'Failed to load channels'),
          });
      });
    return () => controller.abort();
  }, [api, createKeyType, reload]);
  const close = () => {
    if (!submitting.current) onClose();
  };
  const handleCreateKey = async () => {
    if (
      submitting.current ||
      !newKeyName.trim() ||
      (createKeyType === 'external' && (channelsLoading || channelsError))
    )
      return;
    const normalized =
      createKeyType === 'legacy' ? null : normalizePolicy(newKeyPolicy);
    if (normalized && !normalized.policy) {
      setError(normalized.error || 'Invalid policy values');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createApiKey(
        newKeyName.trim(),
        normalized?.policy,
        createKeyType === 'external' ? newKeyChannelIds : undefined
      );
      if (!active.current) return;
      if (!result.success) {
        setError(result.message || 'Failed to create API key');
        return;
      }
      onCreated(
        result,
        createKeyType === 'legacy' ? 'legacy_download' : newKeyPolicy.role
      );
    } catch (error) {
      if (active.current)
        setError(apiKeyError(error, 'Failed to create API key'));
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>
        {createKeyType === 'legacy'
          ? 'Create Legacy Download Key'
          : 'Create External Access Key'}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {channelsLoading && (
          <Alert severity="info">Loading available channels...</Alert>
        )}
        {channelsError && (
          <Alert severity="error">
            {channelsError}
            <Button onClick={() => setReload((value) => value + 1)}>
              Retry
            </Button>
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Key Name"
          placeholder={
            createKeyType === 'legacy'
              ? 'e.g., Bookmarklet'
              : 'e.g., External Client'
          }
          fullWidth
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          inputProps={{ maxLength: 100 }}
          helperText="A descriptive name to identify this key"
        />
        {createKeyType === 'external' && (
          <>
            <Typography variant="subtitle2" className="mt-4 mb-2">
              Access policy
            </Typography>
            <PolicyEditor policy={newKeyPolicy} onChange={setNewKeyPolicy} />
            <Divider className="my-5" />
            <Typography variant="subtitle2" className="mb-2">
              Approved channels ({newKeyChannelIds.length})
            </Typography>
            <Typography variant="body2" color="secondary" className="mb-3">
              The key cannot browse or request from channels that are not
              selected.
            </Typography>
            {newKeyChannelIds.length === 0 && (
              <Alert
                severity="warning"
                className="mb-3"
                icon={<WarningIcon size={18} />}
              >
                Saving with zero approved channels is allowed, but the key will
                fail closed and cannot view or request catalog content until
                grants are added.
              </Alert>
            )}
            <ChannelGrantPicker
              channels={channelOptions}
              selectedIds={newKeyChannelIds}
              search={newKeyChannelSearch}
              onSearchChange={setNewKeyChannelSearch}
              onSelectedIdsChange={setNewKeyChannelIds}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          onClick={handleCreateKey}
          variant="contained"
          disabled={
            busy ||
            !newKeyName.trim() ||
            (createKeyType === 'external' &&
              (channelsLoading || Boolean(channelsError)))
          }
        >
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
