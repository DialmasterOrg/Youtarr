import { useState, useEffect, useRef, useCallback } from 'react';

// Load More only: entries read from the tab so far, then the save that follows.
export interface FetchProgress {
  itemsFetched: number;
  stage: 'listing' | 'saving';
}

interface FetchStatus {
  isFetching: boolean;
  startTime?: string;
  type?: string;
  tabType?: string;
  progress?: FetchProgress;
}

interface UseChannelFetchStatusResult {
  isFetching: boolean;
  startTime: string | null;
  progress: FetchProgress | null;
  onFetchComplete: (callback: () => void) => void;
  startPolling: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function useChannelFetchStatus(
  channelId: string | undefined,
  tabType: string | null,
  token: string | null
): UseChannelFetchStatusResult {
  // The status is stamped with the channel/tab it describes, so after a switch
  // nothing from the previous tab renders before the new tab's check returns.
  const statusKey = channelId && tabType ? `${channelId}:${tabType}` : null;
  const [status, setStatus] = useState<{ key: string; data: FetchStatus } | null>(null);
  const [shouldPoll, setShouldPoll] = useState<boolean>(false);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);
  const previousIsFetchingRef = useRef<boolean>(false);
  // Bumped on every channel/tab/token change: a response from an earlier
  // generation describes a view that is no longer showing and is dropped.
  const generationRef = useRef(0);
  // The generation with a check in flight. One check at a time per view, so a
  // slow response is still applied and responses cannot land out of order.
  const inFlightGenerationRef = useRef<number | null>(null);

  const checkFetchStatus = useCallback(async () => {
    if (!channelId || !token || !tabType) return;
    const generation = generationRef.current;
    if (inFlightGenerationRef.current === generation) return;
    inFlightGenerationRef.current = generation;
    const requestKey = `${channelId}:${tabType}`;

    try {
      const response = await fetch(`/api/channels/${channelId}/fetch-status?tabType=${tabType}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (response.ok) {
        const data: FetchStatus = await response.json();
        if (generation !== generationRef.current) return;

        // Detect transition from fetching to not fetching
        if (previousIsFetchingRef.current && !data.isFetching) {
          // Fetch just completed - stop polling and trigger callback
          setShouldPoll(false);
          if (onCompleteCallbackRef.current) {
            onCompleteCallbackRef.current();
          }
        }

        // If we detected an active fetch, enable polling
        if (data.isFetching) {
          setShouldPoll(true);
        }

        previousIsFetchingRef.current = data.isFetching;
        setStatus({ key: requestKey, data });
      }
    } catch (error) {
      console.error('Error checking fetch status:', error);
    } finally {
      if (inFlightGenerationRef.current === generation) {
        inFlightGenerationRef.current = null;
      }
    }
  }, [channelId, tabType, token]);

  // Check once per channel/tab to detect any background fetch. A fetch on the
  // previous tab is not a completion here, and polling restarts only if this
  // tab is fetching (or the caller starts one).
  useEffect(() => {
    generationRef.current++;
    previousIsFetchingRef.current = false;
    setShouldPoll(false);
    if (!channelId || !token || !tabType) return;
    checkFetchStatus();
  }, [channelId, tabType, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while shouldPoll is true. Each poll is scheduled after the previous
  // check settles, so a response slower than the interval is never outrun.
  useEffect(() => {
    if (!channelId || !token || !tabType || !shouldPoll) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await checkFetchStatus();
      if (!cancelled) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [channelId, tabType, token, shouldPoll, checkFetchStatus]);

  const current = status && status.key === statusKey ? status.data : null;

  const onFetchComplete = useCallback((callback: () => void) => {
    onCompleteCallbackRef.current = callback;
  }, []);

  // Allow callers to start polling (e.g., when they initiate a fetch)
  const startPolling = useCallback(() => {
    setShouldPoll(true);
  }, []);

  return {
    isFetching: current?.isFetching ?? false,
    startTime: current?.startTime || null,
    progress: current?.progress || null,
    onFetchComplete,
    startPolling,
  };
}
