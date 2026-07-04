import React from 'react';
import { Box, Typography } from '../ui';
import { FailedVideo, DownloadDiagnosis } from '../../types/Job';
import { groupFailuresByDiagnosis } from './failureGrouping';

interface FailedDownloadsDetailProps {
  failedVideos: FailedVideo[];
  diagnoses?: DownloadDiagnosis[];
}

// Compact failure listing for an expanded Download History row: heading and
// advice message once per group, followed by the affected video titles.
function FailedDownloadsDetail({ failedVideos, diagnoses = [] }: FailedDownloadsDetailProps) {
  if (failedVideos.length === 0) {
    return null;
  }

  const groups = groupFailuresByDiagnosis(failedVideos, diagnoses);

  return (
    <Box className="mt-2 flex flex-col gap-2">
      <Typography
        variant="caption"
        className="font-semibold"
        style={{ color: 'var(--destructive)' }}
      >
        Failed downloads
      </Typography>
      {[...groups.entries()].map(([groupKey, group]) => (
        <Box key={groupKey} className="flex flex-col gap-0.5">
          <Typography variant="caption" className="font-medium">
            {group.heading ?? group.videos[0].error}
          </Typography>
          {group.message && (
            <Typography variant="caption" color="secondary">
              {group.message}
            </Typography>
          )}
          {group.videos
            .filter((video) => video.title)
            .map((video) => (
              <Typography key={video.youtubeId} variant="caption" color="secondary">
                • {video.title}
                {video.channel ? ` by ${video.channel}` : ''}
              </Typography>
            ))}
        </Box>
      ))}
    </Box>
  );
}

export default FailedDownloadsDetail;
