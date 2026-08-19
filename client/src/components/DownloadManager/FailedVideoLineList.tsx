import React from 'react';
import { Box, Typography } from '../ui';
import { FailedVideo } from '../../types/Job';
import FailedVideoLine from './FailedVideoLine';

export const MAX_VISIBLE_FAILED_VIDEOS = 20;

interface FailedVideoLineListProps {
  videos: FailedVideo[];
}

// Stacked failure lines with a cap so mass-failure runs (e.g. a bot check
// killing the rest of a Channel Download All sweep) cannot flood the UI with
// thousands of rows; the remainder collapses into a single count line.
function FailedVideoLineList({ videos }: FailedVideoLineListProps) {
  const visible = videos.slice(0, MAX_VISIBLE_FAILED_VIDEOS);
  const hiddenCount = videos.length - visible.length;

  return (
    <Box className="flex flex-col gap-0.5">
      {visible.map((video, index) => (
        <FailedVideoLine key={`${video.youtubeId}-${index}`} video={video} />
      ))}
      {hiddenCount > 0 && (
        <Typography variant="caption" color="secondary">
          ...and {hiddenCount} more
        </Typography>
      )}
    </Box>
  );
}

export default FailedVideoLineList;
