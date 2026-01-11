import { useState, useEffect, useRef, useCallback } from 'react';

interface FetchStatus {
  isFetching: boolean;
  startTime?: string;
  type?: string;
  tabType?: string;
}

interface UseChannelFetchStatusResult {
  isFetching: boolean;
  startTime: string | null;
  onFetchComplete: (callback: () => void) => void;
  startPolling: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function useChannelFetchStatus(
  channelId: string | undefined,
  tabType: string | null,
  token: string | null
): UseChannelFetchStatusResult {
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState<boolean>(false);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);
  const previousIsFetchingRef = useRef<boolean>(false);

  const checkFetchStatus = useCallback(async () => {
    if (!channelId || !token || !tabType) return;

    try {
      const response = await fetch(`/api/channels/${channelId}/fetch-status?tabType=${tabType}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (response.ok) {
        const data: FetchStatus = await response.json();

        // Detect transition from fetching to not fetching
        if (previousIsFetchingRef.current && !data.isFetching) {
          // Fetch just completed - stop polling and trigger callback
          setShouldPoll(false);
          if (onCompleteCallbackRef.current) {
            onCompleteCallbackRef.current();
          }
        }

        // If we detected an active fetch, enable polling
        if (data.isFetching && !shouldPoll) {
          setShouldPoll(true);
        }

        previousIsFetchingRef.current = data.isFetching;
        setIsFetching(data.isFetching);
        setStartTime(data.startTime || null);
      }
    } catch (error) {
      console.error('Error checking fetch status:', error);
    }
  }, [channelId, tabType, token, shouldPoll]);

  // Single check on mount to detect any background fetches
  useEffect(() => {
    if (!channelId || !token || !tabType) return;
    checkFetchStatus();
  }, [channelId, tabType, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling interval - only active when shouldPoll is true
  useEffect(() => {
    if (!channelId || !token || !tabType || !shouldPoll) return;

    const intervalId = setInterval(checkFetchStatus, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [channelId, tabType, token, shouldPoll, checkFetchStatus]);

  const onFetchComplete = useCallback((callback: () => void) => {
    onCompleteCallbackRef.current = callback;
  }, []);

  // Allow callers to start polling (e.g., when they initiate a fetch)
  const startPolling = useCallback(() => {
    setShouldPoll(true);
  }, []);

  return {
    isFetching,
    startTime,
    onFetchComplete,
    startPolling,
  };
}
