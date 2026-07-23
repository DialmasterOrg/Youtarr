import React from 'react';
import { Alert, Box, Typography } from '../../../ui';
import { AutoRemovalDryRunResult } from '../../types';
import { formatBytes } from '../../helpers';

const MAX_SAMPLE_VIDEOS = 5;

interface AutoRemovalPreviewProps {
  result: AutoRemovalDryRunResult;
}

export const AutoRemovalPreview: React.FC<AutoRemovalPreviewProps> = ({ result }) => {
  const plan = result.plan;
  const simulation = result.simulationTotals;

  if (!plan || !simulation) {
    return null;
  }

  const sampleVideos = [
    ...(plan.ageStrategy.sampleVideos || []),
    ...(plan.watchedStrategy?.sampleVideos || []),
    ...(plan.spaceStrategy.sampleVideos || []),
  ].slice(0, MAX_SAMPLE_VIDEOS);
  const hasSpaceThreshold = plan.spaceStrategy.thresholdBytes != null;
  const keepRecent = plan.keepRecent;
  const watchedSkippedReason = plan.watchedStrategy?.skippedReason;
  const hasWarnings = result.errors.length > 0 || Boolean(watchedSkippedReason);

  return (
    <Alert severity={hasWarnings ? 'warning' : 'info'} className="mt-2">
      <Typography variant="body2" className="font-medium">
        Preview Summary
      </Typography>
      <Typography variant="body2">
        Would remove <strong>{simulation.total}</strong> videos (~{formatBytes(simulation.estimatedFreedBytes)}).
      </Typography>
      {plan.ageStrategy.enabled && plan.ageStrategy.candidateCount > 0 && (
        <Typography variant="body2">
          • Age threshold: {plan.ageStrategy.candidateCount} videos (~{formatBytes(plan.ageStrategy.estimatedFreedBytes)})
        </Typography>
      )}
      {plan.watchedStrategy?.enabled && plan.watchedStrategy.candidateCount > 0 && (
        <Typography variant="body2">
          • Watched: {plan.watchedStrategy.candidateCount} videos (~{formatBytes(plan.watchedStrategy.estimatedFreedBytes)})
        </Typography>
      )}
      {watchedSkippedReason && (
        <Typography variant="body2">
          {watchedSkippedReason}
        </Typography>
      )}
      {plan.spaceStrategy.enabled && plan.spaceStrategy.needsCleanup && (
        <Typography variant="body2">
          • Space threshold: {plan.spaceStrategy.candidateCount} videos (~{formatBytes(plan.spaceStrategy.estimatedFreedBytes)})
        </Typography>
      )}
      {hasSpaceThreshold && plan.spaceStrategy.needsCleanup === false && (
        <Typography variant="body2">
          Storage is currently above the free space threshold; no space-based deletions are needed.
        </Typography>
      )}
      {keepRecent && keepRecent.count > 0 && (
        <Typography variant="body2">
          The {keepRecent.protectedCount} most recent downloads are protected from removal.
        </Typography>
      )}
      {sampleVideos.length > 0 && (
        <Box className="mt-2">
          <Typography variant="body2" className="font-medium">
            Sample videos
          </Typography>
          {sampleVideos.map((video) => (
            <Typography key={`dryrun-video-${video.id}`} variant="body2">
              {video.title} ({video.youtubeId}) • {formatBytes(video.fileSize)}
            </Typography>
          ))}
        </Box>
      )}
      {result.errors.length > 0 && (
        <Box className="mt-2">
          <Typography variant="body2" className="font-medium">
            Warnings
          </Typography>
          {result.errors.map((err, index) => (
            <Typography key={`dryrun-warning-${index}`} variant="body2">
              {err}
            </Typography>
          ))}
        </Box>
      )}
    </Alert>
  );
};
