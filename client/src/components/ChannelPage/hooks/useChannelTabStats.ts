import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { TabDownloadStatsByTab } from '../../../types/Channel';

interface ChannelTabStatsResponse {
  channelId: string;
  tabs: TabDownloadStatsByTab;
}

interface UseChannelTabStatsResult {
  data: TabDownloadStatsByTab | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// The server refreshes YouTube totals older than 24 hours before answering,
// so the first load of a stale channel can take a few seconds.
export function useChannelTabStats(
  channelId: string | undefined,
  token: string | null
): UseChannelTabStatsResult {
  const [data, setData] = useState<TabDownloadStatsByTab | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // A stale channel's request can outlive navigation to another channel (the
  // page component is reused), so only the newest request may set state.
  const latestRequestId = useRef(0);

  const refetch = useCallback(async () => {
    if (!channelId || !token) return;
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const response = await axios.get<ChannelTabStatsResponse>(
        `/api/channels/${channelId}/tab-stats`,
        { headers: { 'x-access-token': token } }
      );
      if (requestId !== latestRequestId.current) return;
      setData(response.data.tabs);
      setError(null);
    } catch {
      if (requestId !== latestRequestId.current) return;
      setError('Could not load download stats');
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [channelId, token]);

  useEffect(() => {
    setData(null);
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
