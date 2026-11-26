import React, { RefObject } from 'react';
import { Button, Typography } from '../../ui';

interface InfiniteScrollSentinelProps {
  // From useInfiniteScrollTrigger: scrolling this element into view loads the next page.
  sentinelRef: RefObject<HTMLDivElement>;
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
      {loadFailed && (
        <div
          role="alert"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 0' }}
        >
          <Typography variant="body2" color="text.secondary">
            Could not load videos.
          </Typography>
          <Button onClick={onRetry} variant="outlined" size="small" color="inherit">
            Retry
          </Button>
        </div>
      )}
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
