import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Channel } from '../../../types/Channel';
import { normalizeSubFolderKey } from '../../../utils/channelHelpers';

interface UseChannelListParams {
  token: string | null;
  page: number;
  pageSize: number;
  searchTerm: string;
  sortOrder: 'asc' | 'desc';
  subFolder?: string;
  append?: boolean;
}

interface ChannelListResponse {
  channels: Channel[] | { rows?: Channel[]; count?: number; totalPages?: number } | null;
  total?: number | null;
  totalPages?: number | null;
  subFolders?: Array<string | null> | null;
  subfolders?: Array<string | null> | null;
}

export const useChannelList = ({
  token,
  page,
  pageSize,
  searchTerm,
  sortOrder,
  subFolder,
  append = false,
}: UseChannelListParams) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subFolders, setSubFolders] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const hookInstanceId = useRef(Math.random().toString(36).substring(7));
  const filterKeyRef = useRef('');

  const filterKey = JSON.stringify({ token, searchTerm, sortOrder, subFolder, pageSize });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!append) {
      filterKeyRef.current = filterKey;
      return;
    }
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      setChannels([]);
      setTotal(0);
      setTotalPages(0);
    }
  }, [append, filterKey]);

  // Removed noisy per-render diagnostic log that flooded the console.

  const fetchChannels = useCallback(async () => {

    if (!token) {
      if (!isMountedRef.current) return;
      setChannels([]);
      setTotal(0);
      setTotalPages(0);
      setSubFolders([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!isMountedRef.current) return;
    setLoading(true);
    setError(null);

    const requestStartedAt = performance.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
      const response = await axios.get<ChannelListResponse>('/getchannels', {
        headers: { 'x-access-token': token },
        timeout: 15000,
        params: {
          page,
          pageSize,
          search: searchTerm || undefined,
          sortOrder,
          subFolder: subFolder || undefined,
          _t: Date.now() // Cache buster to bypass potentially problematic 304s in some environments
        },
      });

      const payload = response.data;
      if (!isMountedRef.current) {
        return;
      }

      // Robust check for channels array in different possible response shapes
      let rawChannels: Channel[] = [];
      if (Array.isArray(payload?.channels)) {
        rawChannels = payload.channels;
      } else if (payload?.channels && typeof payload.channels === 'object' && Array.isArray((payload.channels as any).rows)) {
        rawChannels = (payload.channels as any).rows;
      }

      // Robust check for total count
      let rawTotal = 0;
      if (typeof payload?.total === 'number') {
        rawTotal = payload.total;
      } else if (payload?.channels && typeof payload.channels === 'object' && typeof (payload.channels as any).count === 'number') {
        rawTotal = (payload.channels as any).count;
      }

      // Robust check for total pages
      let rawTotalPages = 0;
      if (typeof payload?.totalPages === 'number') {
        rawTotalPages = payload.totalPages;
      } else if (payload?.channels && typeof payload.channels === 'object' && typeof (payload.channels as any).totalPages === 'number') {
        rawTotalPages = (payload.channels as any).totalPages;
      }

      const rawSubFolders = (payload?.subFolders || payload?.subfolders || []) as Array<string | null>;

      setChannels((prev) => {
        if (!append || page === 1) {
          return rawChannels;
        }
        const combined = [...prev, ...rawChannels];
        const seen = new Set<string>();
        return combined.filter((channel) => {
          const key = channel.channel_id ? String(channel.channel_id) : channel.url;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setTotal(rawTotal || 0);
      setTotalPages(rawTotalPages || 0);
      setSubFolders(rawSubFolders.map((value) => normalizeSubFolderKey(value)).filter(Boolean));
    } catch (err: any) {
      const requestDurationMs = Math.round(performance.now() - requestStartedAt);
      console.error(`[useChannelList] [${hookInstanceId.current}] [Req:${requestId}] Fetch failed`, { 
        durationMs: requestDurationMs,
        error: {
          message: err?.message,
          code: err?.code,
          status: err?.response?.status,
          data: err?.response?.data,
        },
      });
      const message = err?.code === 'ECONNABORTED'
        ? 'Channel sync timed out. Please try again.'
        : err?.response?.data?.error || 'Failed to load channels';
      if (isMountedRef.current) {
        setError(message);
        if (!append || page === 1) {
          setChannels([]);
          setTotal(0);
          setTotalPages(0);
          setSubFolders([]);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [token, page, pageSize, searchTerm, sortOrder, subFolder, append]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return {
    channels,
    total,
    totalPages,
    loading,
    error,
    refetch: fetchChannels,
    subFolders,
  };
};
