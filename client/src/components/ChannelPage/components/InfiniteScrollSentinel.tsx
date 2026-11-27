import React, { Ref } from 'react';
import { Typography } from '../../ui';
import LoadMoreFailed from '../../shared/LoadMoreFailed';

interface InfiniteScrollSentinelProps {
  // From useInfiniteScrollTrigger: scrolling this element into view loads the next page.
  sentinelRef: Ref<HTMLDivElement>;
  loadingMore: boolean;
  // Every page is loaded.
  caughtUp: boolean;
  // A load failed with rows on screen; nothing more loads until a retry works.
  loadFailed: boolean;
  onRetry: () => void;
}

function InfiniteScrollSentinel({
  sentinelRef,
  loadingMore,
  caughtUp,
  loadFailed,
  onRetry,
}: InfiniteScrollSentinelProps) {
  return (
    <>
      <div
        ref={sentinelRef}
        style={{ height: 24, width: '100%', marginTop: 32, marginBottom: 32 }}
      />
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <div className="playful-loading-dots" aria-label="Loading more videos">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {loadFailed && <LoadMoreFailed message="Could not load videos." onRetry={onRetry} />}
      {caughtUp && (
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          style={{ display: 'block', padding: '16px 0' }}
        >
          {"You're all caught up."}
        </Typography>
      )}
    </>
  );
}

export default InfiniteScrollSentinel;
