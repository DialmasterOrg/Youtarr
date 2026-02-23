import React from 'react';
import { CheckCircle as CheckCircleIcon, CloudOff as CloudOffIcon, Lock as LockIcon, NewReleases as NewReleasesIcon, Schedule as ScheduleIcon, VideoLibrary as VideoLibraryIcon, Block as BlockIcon } from '../lib/icons';
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
      return <CheckCircleIcon size={16} />;
    case 'missing':
      return <CloudOffIcon size={16} />;
    case 'members_only':
      return <LockIcon size={16} />;
    case 'ignored':
      return <BlockIcon size={16} />;
    default:
      return <NewReleasesIcon size={16} />;
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
        icon: <ScheduleIcon size={16} />,
      };
    case 'livestream':
      return {
        label: 'Live',
        color: 'error' as const,
        icon: <VideoLibraryIcon size={16} />,
      };
    default:
      return null;
  }
};
