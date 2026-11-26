import { useEffect, useRef, RefObject } from 'react';

// The sentinel counts as in range from this far below the viewport.
const OBSERVER_ROOT_MARGIN = '0px 0px 200px 0px';

interface UseInfiniteScrollTriggerParams {
  enabled: boolean;
  loading: boolean;
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
}: UseInfiniteScrollTriggerParams): RefObject<HTMLDivElement> {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadNextPageRef = useRef(onLoadNextPage);
  onLoadNextPageRef.current = onLoadNextPage;

  // True from asking for a page until that page starts loading. The sentinel
  // can be reported again in between, and asking twice would skip a page.
  const awaitingLoadRef = useRef(false);
  useEffect(() => {
    if (loading) awaitingLoadRef.current = false;
  }, [loading]);

  useEffect(() => {
    if (!enabled || loading || !hasNextPage) return;
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || awaitingLoadRef.current) return;
        awaitingLoadRef.current = true;
        onLoadNextPageRef.current();
      },
      { root: null, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [enabled, loading, hasNextPage]);

  return sentinelRef;
}
