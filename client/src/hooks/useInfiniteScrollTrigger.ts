import { useEffect, useRef, useState, RefCallback } from 'react';

// The sentinel counts as in range from this far below the viewport.
const OBSERVER_ROOT_MARGIN = '0px 0px 200px 0px';

interface UseInfiniteScrollTriggerParams {
  enabled: boolean;
  // Left out by a list that reveals rows it already holds: no fetch follows
  // an ask, so the sentinel is checked again right after each one.
  loading?: boolean;
  hasNextPage: boolean;
  onLoadNextPage: () => void;
}

// Returns a ref for a sentinel below the list. While the sentinel is in range
// and nothing is loading, the next page is asked for, however the sentinel
// got there: a slow scroll, a jump to the end, or a page too short to push it
// out of range, which then loads the page after it as well.
export function useInfiniteScrollTrigger({
  enabled,
  loading,
  hasNextPage,
  onLoadNextPage,
}: UseInfiniteScrollTriggerParams): RefCallback<HTMLDivElement> {
  // Kept in state, not a ref: a sentinel that mounts while nothing else
  // changes (a tab switched back to) still has to start being watched.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const onLoadNextPageRef = useRef(onLoadNextPage);
  onLoadNextPageRef.current = onLoadNextPage;

  // True from asking for a page until that page starts loading. The sentinel
  // can be reported again in between, and asking twice would skip a page.
  const awaitingLoadRef = useRef(false);
  useEffect(() => {
    if (loading) awaitingLoadRef.current = false;
  }, [loading]);

  // Asks that no fetch follows. Each one starts a new observer, which reports
  // where the sentinel is once the revealed rows are in.
  const [immediateAsks, setImmediateAsks] = useState(0);

  useEffect(() => {
    if (!enabled || loading || !hasNextPage || !sentinel) return;

    // disconnect() does not discard a report the browser has already queued.
    // One arriving after cleanup would set the wait with nothing left to end
    // it: the caller's load is already running, so no new one starts.
    let watching = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!watching) return;
        if (!entries[0]?.isIntersecting || awaitingLoadRef.current) return;
        awaitingLoadRef.current = loading !== undefined;
        onLoadNextPageRef.current();
        if (loading === undefined) setImmediateAsks((count) => count + 1);
      },
      { root: null, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      watching = false;
      observer.disconnect();
    };
  }, [enabled, loading, hasNextPage, immediateAsks, sentinel]);

  return setSentinel;
}
