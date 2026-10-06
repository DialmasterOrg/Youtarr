import React from 'react';
import { Alert, LinearProgress, Typography } from '../ui';
import { useActiveReorganize } from '../shared/Reorganize/hooks/useActiveReorganize';

interface ReorganizeBannerProps {
  token: string | null;
}

/**
 * App-wide notice while a reorganize moves downloaded files: downloads wait
 * in the queue until it ends, which would otherwise look like a stall.
 */
export const ReorganizeBanner: React.FC<ReorganizeBannerProps> = ({ token }) => {
  const { operation } = useActiveReorganize(token);
  if (!operation) return null;

  const total = operation.total ?? 0;
  const handled = (operation.done ?? 0) + (operation.failed ?? 0);
  return (
    <Alert severity="info" className="mb-4">
      <Typography variant="body2">
        Moving downloaded videos for {operation.label}{total > 0 ? `: ${handled} of ${total}` : ''}.
        {' '}Downloads wait in the queue until it finishes.
      </Typography>
      {total > 0 && (
        <LinearProgress variant="determinate" value={Math.round((handled / total) * 100)} height={6} className="mt-2" />
      )}
    </Alert>
  );
};

export default ReorganizeBanner;
