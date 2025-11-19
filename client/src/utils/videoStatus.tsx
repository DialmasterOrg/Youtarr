import React from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import LockIcon from '@mui/icons-material/Lock';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import BlockIcon from '@mui/icons-material/Block';
import { ChannelVideo } from '../types/ChannelVideo';

export type VideoStatus = 'never_downloaded' | 'downloaded' | 'missing' | 'members_only' | 'ignored';

export const getVideoStatus = (video: ChannelVideo): VideoStatus => {
  if (video.ignored) {
    return 'ignored';
  }
  if (video.availability === 'subscriber_only') {
    return 'members_only';
  }
  if (!video.added) {
    return 'never_downloaded';
  }
  if (video.removed) {
    return 'missing';
  }
  return 'downloaded';
};

export const getStatusColor = (status: VideoStatus) => {
  switch (status) {
    case 'downloaded':
      return 'success';
    case 'missing':
      return 'warning';
    case 'members_only':
      return 'default';
    case 'ignored':
      return 'default';
    default:
      return 'info';
  }
};

export const getStatusIcon = (status: VideoStatus) => {
  switch (status) {
    case 'downloaded':
      return <CheckCircleIcon fontSize="small" />;
    case 'missing':
      return <CloudOffIcon fontSize="small" />;
    case 'members_only':
      return <LockIcon fontSize="small" />;
    case 'ignored':
      return <BlockIcon fontSize="small" />;
    default:
      return <NewReleasesIcon fontSize="small" />;
  }
};

export const getStatusLabel = (status: VideoStatus) => {
  switch (status) {
    case 'downloaded':
      return 'Downloaded';
    case 'missing':
      return 'Missing';
    case 'members_only':
      return 'Members Only';
    case 'ignored':
      return 'Ignored';
    default:
      return 'Not Downloaded';
  }
};

export const getMediaTypeInfo = (mediaType?: string | null) => {
  switch (mediaType) {
    case 'short':
      return {
        label: 'Short',
        color: 'secondary' as const,
        icon: <ScheduleIcon fontSize="small" />,
      };
    case 'livestream':
      return {
        label: 'Live',
        color: 'error' as const,
        icon: <VideoLibraryIcon fontSize="small" />,
      };
    default:
      return null;
  }
};
