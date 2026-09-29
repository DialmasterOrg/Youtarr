import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { Channel } from '../../../types/Channel';
import { normalizeChannelUrl } from '../../../utils/channelHelpers';
import { NewChannelSettings, PendingChannel, toNewChannelSettingsPayload } from '../newChannelSettings';

interface UseChannelMutationsOptions {
  token: string | null;
  onRefresh: () => Promise<void> | void;
}

interface OperationResult {
  success: boolean;
  message?: string;
}

export interface ChannelLookupResult extends OperationResult {
  /** The looked-up channel, ready for the Add Channel dialog. */
  channel?: PendingChannel;
  /** True when `channel` is the entry already waiting in the pending list. */
  alreadyPending?: boolean;
}

interface AddChannelInfoResponse {
  status?: string;
  channelInfo?: Channel & {
    id?: string;
    // True when the channel row already existed in the database.
    existing?: boolean;
    // The row's actual enabled state; false means soft-deleted (restorable).
    enabled?: boolean;
  };
}

export const useChannelMutations = ({ token, onRefresh }: UseChannelMutationsOptions) => {
  const [pendingAdditions, setPendingAdditions] = useState<PendingChannel[]>([]);
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const deletedSet = useMemo(() => new Set(deletedChannels), [deletedChannels]);

  const lookupChannel = useCallback(async (input: string): Promise<ChannelLookupResult> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const normalizedUrl = normalizeChannelUrl(input);
    if (!normalizedUrl) {
      return {
        success: false,
        message: 'Invalid channel URL or handle. Please double-check the format.',
      };
    }

    const pendingMatch = pendingAdditions.find((channel) => channel.url === normalizedUrl);
    if (pendingMatch) {
      return { success: true, alreadyPending: true, channel: pendingMatch };
    }

    if (deletedSet.has(normalizedUrl)) {
      setDeletedChannels((prev) => prev.filter((url) => url !== normalizedUrl));
      return { success: true, message: 'Channel restored from pending removal' };
    }

    setIsAddingChannel(true);

    try {
      const response = await axios.post<AddChannelInfoResponse>('/addchannelinfo', { url: normalizedUrl }, {
        headers: { 'x-access-token': token },
      });

      if (response.data?.status !== 'success' || !response.data?.channelInfo) {
        return {
          success: false,
          message: 'Failed to add channel. Please try again.',
        };
      }

      const channelInfo = response.data.channelInfo;

      // Server-reported state, so URL and case variants of an active subscription are caught.
      if (channelInfo.enabled) {
        return { success: false, message: 'Channel already exists' };
      }
      const channel: PendingChannel = {
        url: normalizedUrl,
        uploader: channelInfo.uploader || channelInfo.title || normalizedUrl,
        channel_id: channelInfo.channel_id || channelInfo.id,
        auto_download_enabled_tabs: channelInfo.auto_download_enabled_tabs,
        available_tabs: channelInfo.available_tabs,
        sub_folder: channelInfo.sub_folder,
        video_quality: channelInfo.video_quality,
        audio_format: channelInfo.audio_format,
        min_duration: channelInfo.min_duration,
        max_duration: channelInfo.max_duration,
        title_filter_regex: channelInfo.title_filter_regex,
        restored: Boolean(channelInfo.existing),
      };

      return { success: true, channel };
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 503) {
        return {
          success: false,
          message: 'Channel not found. Please check the URL or channel name and try again.',
        };
      }
      if (response?.status === 403) {
        return {
          success: false,
          message: 'Authentication issue. Please check your cookies configuration.',
        };
      }
      if (response?.status === 404) {
        return {
          success: false,
          message: 'Channel not found. Please check the URL and try again.',
        };
      }

      return {
        success: false,
        message: response?.data?.message || 'Failed to add channel. Please try again.',
      };
    } finally {
      setIsAddingChannel(false);
    }
  }, [token, pendingAdditions, deletedSet]);

  const addPendingChannel = useCallback((channel: PendingChannel) => {
    setPendingAdditions((prev) => [...prev.filter((item) => item.url !== channel.url), channel]);
  }, []);

  const updatePendingChannel = useCallback((url: string, settings: NewChannelSettings) => {
    setPendingAdditions((prev) => prev.map((item) => (item.url === url ? { ...item, ...settings } : item)));
  }, []);

  const queueChannelForDeletion = useCallback((channel: Channel) => {
    const isPendingAddition = pendingAdditions.some((item) => item.url === channel.url);
    if (isPendingAddition) {
      setPendingAdditions((prev) => prev.filter((item) => item.url !== channel.url));
      return;
    }

    if (!deletedSet.has(channel.url)) {
      setDeletedChannels((prev) => [...prev, channel.url]);
    }
  }, [pendingAdditions, deletedSet]);

  const undoChanges = useCallback(() => {
    setPendingAdditions([]);
    setDeletedChannels([]);
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  const saveChanges = useCallback(async (): Promise<OperationResult> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    if (pendingAdditions.length === 0 && deletedChannels.length === 0) {
      return { success: false, message: 'No pending changes to save' };
    }

    setIsSaving(true);

    try {
      await axios.post('/updatechannels', {
        add: pendingAdditions.map((channel) => ({
          url: channel.url,
          channel_id: channel.channel_id,
          settings: toNewChannelSettingsPayload(channel),
        })),
        remove: deletedChannels,
      }, {
        headers: { 'x-access-token': token },
      });

      setPendingAdditions([]);
      setDeletedChannels([]);
      if (onRefresh) {
        await onRefresh();
      }

      return { success: true, message: 'Channels updated successfully' };
    } catch (err: any) {
      const data = err?.response?.data;
      const message = data?.error || data?.message || 'Failed to save channels. Please try again.';
      return { success: false, message };
    } finally {
      setIsSaving(false);
    }
  }, [token, pendingAdditions, deletedChannels, onRefresh]);

  return {
    pendingAdditions,
    deletedChannels,
    isAddingChannel,
    isSaving,
    lookupChannel,
    addPendingChannel,
    updatePendingChannel,
    queueChannelForDeletion,
    undoChanges,
    saveChanges,
    hasPendingChanges: pendingAdditions.length > 0 || deletedChannels.length > 0,
  };
};
