import { useEffect, useRef, useState } from 'react';
import type { ChannelListEntry } from '../../../Subscriptions/hooks/useChannelList';
import { ApiKey, ApiKeyPolicy, NormalizedApiKeyPolicy, normalizePolicy, useApiKeys } from './useApiKeys';
import { increasesPrivilege, policyFromKey } from './policy';
import { apiKeyError } from './apiKeyError';

interface Update { keyId: number; policy: NormalizedApiKeyPolicy; channelIds: number[]; }
interface Props { apiKey: ApiKey; api: ReturnType<typeof useApiKeys>; onClose: () => void; onSaved: () => void; }
interface LoadState { channels: ChannelListEntry[]; originalIds: number[]; loading: boolean; error: string | null; }
export function useExternalAccessEditor({ apiKey, api, onClose, onSaved }: Props) {
  const [editPolicy, setPolicy] = useState(() => policyFromKey(apiKey));
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [load, setLoad] = useState<LoadState>({ channels: [], originalIds: [], loading: true, error: null });
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [pendingExternalUpdate, setPendingExternalUpdate] = useState<Update | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoad(state => ({ ...state, loading: true, error: null }));
    void Promise.all([
      api.fetchAvailableChannels(controller.signal), api.fetchChannelGrants(apiKey.id, controller.signal),
    ]).then(([channels, ids]) => {
      if (controller.signal.aborted) return;
      setSelectedChannelIds(ids);
      setLoad({ channels: channels.filter(channel => !channel.terminated_at), originalIds: ids, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setLoad(state => ({ ...state, loading: false, error: apiKeyError(error, 'Failed to load channel grants and available channels') }));
    });
    return () => controller.abort();
  }, [api, apiKey.id, reloadToken]);

  const submit = async (update: Update) => {
    if (busy.current) return;
    busy.current = true;
    setSavingPolicy(true);
    setEditSubmitError(null);
    try {
      await api.updateExternalAccess(update.keyId, { policy: update.policy, channelIds: update.channelIds });
      if (active.current) onSaved();
    } catch (error) {
      if (active.current) {
        setPendingExternalUpdate(null);
        setEditSubmitError(apiKeyError(error, 'Failed to save external access'));
      }
    } finally {
      busy.current = false;
      if (active.current) setSavingPolicy(false);
    }
  };
  const saveExternalAccess = async () => {
    if (busy.current || load.loading || load.error) return;
    setEditSubmitError(null);
    const result = normalizePolicy(editPolicy);
    if (!result.policy) { setEditSubmitError(result.error || 'Invalid policy values'); return; }
    const update = { keyId: apiKey.id, policy: result.policy, channelIds: selectedChannelIds };
    if (increasesPrivilege(apiKey, result.policy, selectedChannelIds, load.originalIds)) {
      setPendingExternalUpdate(update);
    } else await submit(update);
  };
  return {
    editPolicy, channelOptions: load.channels, channelSearch, selectedChannelIds, savingPolicy,
    loading: load.loading, editLoadError: load.error, editSubmitError, pendingExternalUpdate,
    setEditPolicy: (policy: ApiKeyPolicy) => { setPolicy(policy); setEditSubmitError(null); },
    setChannelSearch, setSelectedChannelIds,
    closeEditDialog: () => { if (!busy.current) onClose(); },
    reload: () => setReloadToken(value => value + 1), saveExternalAccess,
    cancelPrivilegeConfirmation: () => { if (!busy.current) setPendingExternalUpdate(null); },
    confirmPrivilegeIncrease: () => pendingExternalUpdate && submit(pendingExternalUpdate),
  };
}
