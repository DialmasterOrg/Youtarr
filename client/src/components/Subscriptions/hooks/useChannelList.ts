import { useCallback, useEffect, useState } from 'react';
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
  channels: Channel[];
  total: number;
  totalPages: number;
  subFolders?: Array<string | null>;
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
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [subFolders, setSubFolders] = useState<string[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!token) {
      setChannels([]);
      setTotal(0);
      setTotalPages(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ChannelListResponse>('/getchannels', {
        headers: {
          'x-access-token': token,
        },
        params: {
          page,
          pageSize,
          search: searchTerm || undefined,
          sortOrder,
          subFolder: subFolder || undefined,
        },
      });

      const payload = response.data;
      const incomingChannels = payload.channels || [];
      setChannels((prev) => {
        if (!append || page <= 1) {
          return incomingChannels;
        }

        const merged = [...prev, ...incomingChannels];
        const seen = new Set<string>();
        return merged.filter((channel) => {
          const key = channel.channel_id || channel.url;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      });
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 0);
      setSubFolders(
        (payload.subFolders || []).map((value) => normalizeSubFolderKey(value)).filter(Boolean)
      );
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Failed to load channels';
      setError(message);
    } finally {
      setLoading(false);
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
