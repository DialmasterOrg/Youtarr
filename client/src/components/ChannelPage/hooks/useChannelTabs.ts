import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import axios from 'axios';
import { describeRequestError } from '../../../utils/requestError';

const TABS_POLL_INTERVAL_MS = 2000;

interface UseChannelTabsParams {
  channelId: string | undefined;
  token: string | null;
  // The parent's copy of the channel's tabs (comma separated). Undefined
  // leaves the tabs alone; a new list replaces them.
  channelAvailableTabs?: string | null;
}

interface UseChannelTabsResult {
  availableTabs: string[];
  selectedTab: string | null;
  setSelectedTab: Dispatch<SetStateAction<string | null>>;
  setAvailableTabs: Dispatch<SetStateAction<string[]>>;
}

interface TabsResponse {
  availableTabs?: string[];
}

const pickDefaultTab = (tabs: string[]): string => (tabs.includes('videos') ? 'videos' : tabs[0]);

const requestTabs = async (channelId: string, token: string): Promise<string[] | undefined> => {
  const response = await axios.get<TabsResponse>(`/api/channels/${channelId}/tabs`, {
    headers: { 'x-access-token': token },
  });
  return response.data.availableTabs;
};

// The server answered, with an error status. No response at all is a failed request.
const isErrorStatus = (err: unknown): boolean =>
  Boolean((err as { response?: unknown } | null)?.response);

export function useChannelTabs({
  channelId,
  token,
  channelAvailableTabs,
}: UseChannelTabsParams): UseChannelTabsResult {
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);

  // The first request waits while the server detects the channel's tabs, so
  // the same question is asked again every two seconds until one of them is
  // answered. Only the first answer is used: a later one would put the
  // selection back on the default tab after the user chose another. The same
  // goes for an answer that arrives after the page moved to another channel,
  // which the reused page would show as this channel's tabs.
  useEffect(() => {
    if (!channelId || !token) return;
    let settled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    const settle = (tabs: string[] | undefined) => {
      settled = true;
      clearInterval(pollInterval);
      const nextTabs = tabs && tabs.length > 0 ? tabs : ['videos'];
      setAvailableTabs(nextTabs);
      setSelectedTab(pickDefaultTab(nextTabs));
    };

    // Whatever the first request comes back with ends the wait: its tabs, or
    // the Videos tab alone when it fails.
    const loadTabs = async () => {
      try {
        const tabs = await requestTabs(channelId, token);
        if (!settled) settle(tabs);
      } catch (err: unknown) {
        if (settled) return;
        if (!isErrorStatus(err)) {
          console.error('Error fetching available tabs:', describeRequestError(err));
        }
        settle(undefined);
      }
    };

    pollInterval = setInterval(async () => {
      try {
        const tabs = await requestTabs(channelId, token);
        if (!settled) settle(tabs);
      } catch {
        /* asked again on the next tick */
      }
    }, TABS_POLL_INTERVAL_MS);
    void loadTabs();

    return () => {
      settled = true;
      clearInterval(pollInterval);
    };
  }, [channelId, token]);

  useEffect(() => {
    if (channelAvailableTabs === undefined) return;
    const nextTabs = channelAvailableTabs
      ? channelAvailableTabs.split(',').map((tab) => tab.trim()).filter((tab) => tab.length > 0)
      : [];
    if (nextTabs.length === 0) return;
    setAvailableTabs(nextTabs);
    setSelectedTab((current) => {
      if (current && nextTabs.includes(current)) return current;
      return pickDefaultTab(nextTabs);
    });
  }, [channelAvailableTabs]);

  return { availableTabs, selectedTab, setSelectedTab, setAvailableTabs };
}
