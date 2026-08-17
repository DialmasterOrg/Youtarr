import React from 'react';
import { Typography } from '../ui';
import { FailedVideo } from '../../types/Job';

// Job records persisted before v1.79 stored the literal string 'Unknown'
// for missing metadata, and videoMetadataProcessor still writes
// 'Unknown Channel' when info.json has no uploader; treat both as absent.
const LEGACY_UNKNOWN = 'Unknown';
const UNKNOWN_CHANNEL_PLACEHOLDER = 'Unknown Channel';

const normalize = (value?: string): string | undefined =>
  value && value !== LEGACY_UNKNOWN && value !== UNKNOWN_CHANNEL_PLACEHOLDER
    ? value
    : undefined;

interface FailedVideoLineProps {
  video: FailedVideo;
}

// One line of a failed-downloads list: "• Title by Channel (idlink)" when the
// title is known, otherwise the linked YouTube ID (plus the channel when known)
// so the user can always identify the video.
function FailedVideoLine({ video }: FailedVideoLineProps) {
  const title = normalize(video.title);
  const channel = normalize(video.channel);
  const idLink = (
    <a
      href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      {video.youtubeId}
    </a>
  );

  return (
    <Typography variant="caption" color="secondary">
      {'• '}
      {title ? (
        <>
          {title}
          {channel ? ` by ${channel}` : ''}
          {' ('}
          {idLink}
          {')'}
        </>
      ) : (
        <>
          {idLink}
          {channel ? ` by ${channel}` : ''}
        </>
      )}
    </Typography>
  );
}

export default FailedVideoLine;
