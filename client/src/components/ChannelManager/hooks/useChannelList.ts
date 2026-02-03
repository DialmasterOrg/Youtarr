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
}: UseChannelListParams) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subFolders, setSubFolders] = useState<string[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!token) {
      setChannels([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const headers = { 'x-access-token': token };
      const params = {
        page,
        pageSize,
        search: searchTerm || undefined,
        sortOrder,
        subFolder: subFolder || '',
      };

      const response = await axios.get<ChannelListResponse>('/getchannels', {
        headers,
        params,
      });

      const payload = response.data;
      const channelsData = payload.channels || [];
      
      setChannels(channelsData);
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
  }, [token, page, pageSize, searchTerm, sortOrder, subFolder]);

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
