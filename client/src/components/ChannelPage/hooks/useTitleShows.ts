import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ChannelTitleShows, TitleShowDraft } from '../../../types/titleShows';
import { serverMessageOf, toRequestError } from '../../shared/Reorganize/reorganizeErrors';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';

/** A show's folder is taken; the server suggests another name, or a removed show to restore. */
export class ShowFolderTakenError extends Error {
  readonly suggestion: string | null;
  readonly retiredShowId: number | null;

  constructor(message: string, suggestion: string | null, retiredShowId: number | null) {
    super(message);
    this.name = 'ShowFolderTakenError';
    this.suggestion = suggestion;
    this.retiredShowId = retiredShowId;
  }
}

interface FolderRefusal {
  suggestion?: unknown;
  retiredShowId?: unknown;
}

function toSaveError(err: unknown, fallback: string): Error {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as FolderRefusal | undefined;
    if (data && typeof data.suggestion === 'string') {
      return new ShowFolderTakenError(
        serverMessageOf(err, fallback),
        data.suggestion,
        typeof data.retiredShowId === 'number' ? data.retiredShowId : null
      );
    }
  }
  return toRequestError(err, fallback);
}

export interface UseTitleShowsResult {
  data: ChannelTitleShows | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /**
   * The changes below throw a ReorganizeRequiredError when downloaded videos
   * would move, a ShowFolderTakenError for a taken folder, else an Error
   * with the server's message.
   */
  createShow: (draft: TitleShowDraft) => Promise<void>;
  updateShow: (showId: number, draft: TitleShowDraft) => Promise<void>;
  retireShow: (showId: number) => Promise<void>;
  restoreShow: (showId: number) => Promise<void>;
  reorderShows: (showIds: number[]) => Promise<void>;
  setShowOnly: (enabled: boolean) => Promise<void>;
  /** "Use this copy instead" for a duplicate */
  takeDuplicateCopy: (youtubeId: string) => Promise<void>;
  /** Classify the channel's titles again (after a classification error) */
  recheck: () => Promise<void>;
}

/** A channel's title shows (GET/POST/PUT/DELETE /api/channels/:channelId/tv/shows...). */
export function useTitleShows(channelId: string | undefined, token: string | null, enabled = true): UseTitleShowsResult {
  const [data, setData] = useState<ChannelTitleShows | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may set the state.
  const requestSeq = useRef(0);

  const base = channelId ? `/api/channels/${encodeURIComponent(channelId)}/tv` : '';
  const headers = useCallback(() => ({ headers: { 'x-access-token': token || '' } }), [token]);

  const refetch = useCallback(async () => {
    if (!token || !channelId || !enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<ChannelTitleShows>(`${base}/shows`, headers());
      if (seq === requestSeq.current) setData(response.data);
    } catch (err) {
      if (seq === requestSeq.current) setError(serverMessageOf(err, 'Failed to load the channel\'s shows'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [base, channelId, token, enabled, headers]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // A new TV folder changes where shows can go.
  useEffect(() => {
    const handler = () => { void refetch(); };
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, handler);
  }, [refetch]);

  // Every change answers with the channel's shows after it.
  const change = useCallback(async (request: () => Promise<{ data: ChannelTitleShows }>, fallback: string) => {
    const seq = ++requestSeq.current;
    try {
      const response = await request();
      if (seq === requestSeq.current) setData(response.data);
    } catch (err) {
      throw toSaveError(err, fallback);
    }
  }, []);

  const createShow = useCallback((draft: TitleShowDraft) => change(
    () => axios.post<ChannelTitleShows>(`${base}/shows`, draft, headers()), 'Failed to add the show'
  ), [base, change, headers]);

  const updateShow = useCallback((showId: number, draft: TitleShowDraft) => change(
    () => axios.put<ChannelTitleShows>(`${base}/shows/${showId}`, draft, headers()), 'Failed to save the show'
  ), [base, change, headers]);

  const retireShow = useCallback((showId: number) => change(
    () => axios.delete<ChannelTitleShows>(`${base}/shows/${showId}`, headers()), 'Failed to remove the show'
  ), [base, change, headers]);

  const restoreShow = useCallback((showId: number) => change(
    () => axios.post<ChannelTitleShows>(`${base}/shows/${showId}/restore`, {}, headers()), 'Failed to restore the show'
  ), [base, change, headers]);

  const reorderShows = useCallback((showIds: number[]) => change(
    () => axios.put<ChannelTitleShows>(`${base}/shows/order`, { showIds }, headers()), 'Failed to reorder the shows'
  ), [base, change, headers]);

  const takeDuplicateCopy = useCallback((youtubeId: string) => change(
    () => axios.post<ChannelTitleShows>(`${base}/conflicts/${encodeURIComponent(youtubeId)}/use-copy`, {}, headers()),
    'Failed to use the copy'
  ), [base, change, headers]);

  const recheck = useCallback(() => change(
    () => axios.post<ChannelTitleShows>(`${base}/recheck`, {}, headers()), 'Failed to check the titles'
  ), [base, change, headers]);

  const setShowOnly = useCallback(async (value: boolean) => {
    try {
      const response = await axios.put<{ showOnlyDownloads: boolean }>(`${base}/show-only`, { enabled: value }, headers());
      setData((current) => (current ? { ...current, showOnlyDownloads: response.data.showOnlyDownloads } : current));
    } catch (err) {
      throw toRequestError(err, 'Failed to save the switch');
    }
  }, [base, headers]);

  return {
    data, loading, error, refetch, createShow, updateShow, retireShow, restoreShow, reorderShows, setShowOnly, takeDuplicateCopy, recheck,
  };
}

export default useTitleShows;
