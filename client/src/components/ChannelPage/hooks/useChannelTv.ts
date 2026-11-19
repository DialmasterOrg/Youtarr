import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ChannelTvState, LibraryLayout } from '../../../types/tvShows';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { toRequestError } from '../../shared/Reorganize/reorganizeErrors';

export interface ChannelLayoutSwitchResult {
  settings: { sub_folder: string | null };
  tv: ChannelTvState;
}

export interface UseChannelTvResult {
  tv: ChannelTvState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /**
   * Switch the channel between Videos and TV; throws with the server's refusal
   * message, or a ReorganizeRequiredError when the channel's files must move
   */
  switchLayout: (layout: LibraryLayout, folder?: string) => Promise<ChannelLayoutSwitchResult>;
}

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

/** A channel's TV layout state (GET/PUT /api/channels/:channelId/tv). */
export function useChannelTv(channelId: string | undefined, token: string | null, enabled = true): UseChannelTvResult {
  const [tv, setTv] = useState<ChannelTvState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may set state: a refetch started before a layout
  // switch (a folder layout change fires one) must not overwrite its result.
  const requestSeq = useRef(0);

  const fetchTv = useCallback(async () => {
    if (!token || !channelId || !enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<ChannelTvState>(`/api/channels/${encodeURIComponent(channelId)}/tv`, {
        headers: { 'x-access-token': token },
      });
      if (seq === requestSeq.current) setTv(response.data);
    } catch (err) {
      if (seq === requestSeq.current) setError(errorMessage(err, 'Failed to load the channel\'s TV settings'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [channelId, token, enabled]);

  const switchLayout = useCallback(async (layout: LibraryLayout, folder?: string) => {
    if (!token || !channelId) throw new Error('Not signed in');
    const seq = ++requestSeq.current;
    setLoading(false);
    try {
      const response = await axios.put<ChannelLayoutSwitchResult>(
        `/api/channels/${encodeURIComponent(channelId)}/tv/layout`,
        folder === undefined ? { layout } : { layout, folder },
        { headers: { 'x-access-token': token } }
      );
      if (seq === requestSeq.current) setTv(response.data.tv);
      return response.data;
    } catch (err) {
      throw toRequestError(err, 'Failed to switch the channel\'s layout');
    }
  }, [channelId, token]);

  useEffect(() => {
    fetchTv();
  }, [fetchTv]);

  // A folder's layout change changes the layout of the channels in it.
  useEffect(() => {
    const handler = () => { fetchTv(); };
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
  }, [fetchTv]);

  return { tv, loading, error, refetch: fetchTv, switchLayout };
}

export default useChannelTv;
