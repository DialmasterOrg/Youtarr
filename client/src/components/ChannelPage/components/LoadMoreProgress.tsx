import React from 'react';
import { LinearProgress, Typography } from '../../ui';
import { FetchProgress } from '../hooks/useChannelFetchStatus';
import { LOAD_MORE_MAX_VIDEOS } from './TabDownloadSummary';

// The listing can run past YouTube's public total (members-only entries are
// listed but not counted), so the bar holds short of full until it finishes.
const MAX_LISTING_PERCENT = 99;

interface LoadMoreProgressProps {
  progress: FetchProgress | null;
  // YouTube's public count for the tab; null or undefined until it is known.
  total: number | null | undefined;
}

function describeProgress(progress: FetchProgress, target: number | null): string {
  const read = progress.itemsFetched.toLocaleString();
  if (progress.stage === 'saving') {
    return `Saving ${read} videos...`;
  }
  if (target !== null && progress.itemsFetched <= target) {
    return `Read ${read} of ${target.toLocaleString()} videos from YouTube`;
  }
  return `Read ${read} videos from YouTube`;
}

// Fills against the tab's public total (capped at the Load More limit) while
// yt-dlp lists the tab; without a total, or while saving, it stays indeterminate.
const LoadMoreProgress: React.FC<LoadMoreProgressProps> = ({ progress, total }) => {
  const target = total ? Math.min(total, LOAD_MORE_MAX_VIDEOS) : null;
  const percent = progress?.stage === 'listing' && target !== null
    ? Math.min(MAX_LISTING_PERCENT, (progress.itemsFetched / target) * 100)
    : null;

  return (
    <div className="mt-2">
      <LinearProgress
        aria-label="Load More progress"
        variant={percent === null ? 'indeterminate' : 'determinate'}
        value={percent ?? undefined}
      />
      {progress && (
        <Typography variant="caption" color="text.secondary" className="mt-1 block">
          {describeProgress(progress, target)}
        </Typography>
      )}
    </div>
  );
};

export default LoadMoreProgress;
