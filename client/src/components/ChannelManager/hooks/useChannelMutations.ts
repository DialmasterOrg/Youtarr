import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { Channel } from '../../../types/Channel';
import { normalizeChannelUrl } from '../../../utils/channelHelpers';

interface UseChannelMutationsOptions {
  token: string | null;
  onRefresh: () => Promise<void> | void;
}

interface OperationResult {
  success: boolean;
  message?: string;
}

export const useChannelMutations = ({ token, onRefresh }: UseChannelMutationsOptions) => {
  const [pendingAdditions, setPendingAdditions] = useState<Channel[]>([]);
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const deletedSet = useMemo(() => new Set(deletedChannels), [deletedChannels]);

  const checkChannelExists = useCallback(async (normalizedUrl: string) => {
    if (!token) return false;

    try {
      const response = await axios.get('/getchannels', {
        headers: { 'x-access-token': token },
        params: {
          page: 1,
          pageSize: 16,
          search: normalizedUrl,
        },
      });

      const existing = response.data?.channels || [];
      return existing.some((channel: Channel) => channel.url === normalizedUrl);
    } catch (err) {
      console.error('Failed to verify existing channel', err);
      return false;
    }
  }, [token]);

  const addChannel = useCallback(async (input: string): Promise<OperationResult> => {
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

    if (pendingAdditions.some((channel) => channel.url === normalizedUrl)) {
      return { success: false, message: 'Channel already added and pending save' };
    }

    if (deletedSet.has(normalizedUrl)) {
      setDeletedChannels((prev) => prev.filter((url) => url !== normalizedUrl));
      return { success: true, message: 'Channel restored from pending removal' };
    }

    setIsAddingChannel(true);

    try {
      const alreadyExists = await checkChannelExists(normalizedUrl);
      if (alreadyExists) {
        return { success: false, message: 'Channel already exists' };
      }

      const response = await axios.post('/addchannelinfo', { url: normalizedUrl }, {
        headers: { 'x-access-token': token },
      });

      if (response.data?.status !== 'success' || !response.data?.channelInfo) {
        return {
          success: false,
          message: 'Failed to add channel. Please try again.',
        };
      }

      const channelInfo = response.data.channelInfo;
      const formattedChannel: Channel = {
        url: normalizedUrl,
        uploader: channelInfo.uploader || channelInfo.title || normalizedUrl,
        channel_id: channelInfo.channel_id || channelInfo.id,
        auto_download_enabled_tabs: channelInfo.auto_download_enabled_tabs,
        available_tabs: channelInfo.available_tabs,
        sub_folder: channelInfo.sub_folder,
        video_quality: channelInfo.video_quality,
        min_duration: channelInfo.min_duration,
        max_duration: channelInfo.max_duration,
        title_filter_regex: channelInfo.title_filter_regex,
        default_rating: channelInfo.default_rating,
      };

      setPendingAdditions((prev) => [...prev, formattedChannel]);
      return { success: true };
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
  }, [token, pendingAdditions, deletedSet, checkChannelExists]);

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
          channel_id: channel.channel_id
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
      const message = err?.response?.data?.message || 'Failed to save channels. Please try again.';
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
    addChannel,
    queueChannelForDeletion,
    undoChanges,
    saveChanges,
    hasPendingChanges: pendingAdditions.length > 0 || deletedChannels.length > 0,
  };
};
