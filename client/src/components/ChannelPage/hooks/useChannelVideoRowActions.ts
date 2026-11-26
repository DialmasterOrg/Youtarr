import { useEffect } from 'react';
import axios from 'axios';
import { describeRequestError } from '../../../utils/requestError';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { useVideoProtection } from '../../shared/useVideoProtection';

interface UseChannelVideoRowActionsParams {
  channelId: string | undefined;
  token: string | null;
  // The rows on screen, with local changes applied.
  videos: ChannelVideo[];
  setIgnored: (ignoredById: Record<string, boolean>) => void;
  setProtected: (youtubeId: string, isProtected: boolean) => void;
  refetchTabStats: () => Promise<void>;
  notify: (message: string, severity?: 'success' | 'error') => void;
}

interface UseChannelVideoRowActionsResult {
  toggleIgnore: (youtubeId: string) => Promise<void>;
  toggleProtection: (youtubeId: string) => Promise<void>;
}

// The actions on a single row of the channel video list.
export function useChannelVideoRowActions({
  channelId,
  token,
  videos,
  setIgnored,
  setProtected,
  refetchTabStats,
  notify,
}: UseChannelVideoRowActionsParams): UseChannelVideoRowActionsResult {
  const {
    toggleProtection: saveProtection,
    successMessage: protectionSuccess,
    error: protectionError,
    clearMessages: clearProtectionMessages,
  } = useVideoProtection(token);

  useEffect(() => {
    if (!protectionSuccess) return;
    notify(protectionSuccess);
    clearProtectionMessages();
  }, [protectionSuccess, clearProtectionMessages, notify]);

  useEffect(() => {
    if (!protectionError) return;
    notify(protectionError, 'error');
    clearProtectionMessages();
  }, [protectionError, clearProtectionMessages, notify]);

  const toggleProtection = async (youtubeId: string) => {
    const video = videos.find((v) => v.youtube_id === youtubeId);
    if (!video || !video.id) return;
    const newState = await saveProtection(video.id, video.protected || false);
    if (newState !== undefined) setProtected(youtubeId, newState);
  };

  // The row changes at once and goes back if the request fails.
  const toggleIgnore = async (youtubeId: string) => {
    if (!channelId || !token) return;
    const wasIgnored = videos.find((v) => v.youtube_id === youtubeId)?.ignored ?? false;
    const endpoint = wasIgnored ? 'unignore' : 'ignore';

    setIgnored({ [youtubeId]: !wasIgnored });
    try {
      await axios.post(
        `/api/channels/${channelId}/videos/${youtubeId}/${endpoint}`,
        undefined,
        { headers: { 'x-access-token': token } }
      );
      void refetchTabStats();
      notify(
        wasIgnored
          ? 'Video unignored. Channel downloads will include this video'
          : 'Video ignored. Channel downloads will exclude this video'
      );
    } catch (error: unknown) {
      setIgnored({ [youtubeId]: wasIgnored });
      console.error('Error toggling ignore:', describeRequestError(error));
      notify(`Failed to ${endpoint} video`, 'error');
    }
  };

  return { toggleIgnore, toggleProtection };
}
