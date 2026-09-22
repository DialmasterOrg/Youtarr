import React from 'react';
import { CheckCircle as CheckCircleIcon, CloudOff as CloudOffIcon, Lock as LockIcon, NewReleases as NewReleasesIcon, Schedule as ScheduleIcon, VideoLibrary as VideoLibraryIcon, Block as BlockIcon } from '../lib/icons';
import { ChannelVideo } from '../types/ChannelVideo';

export type VideoStatus = 'never_downloaded' | 'downloaded' | 'missing' | 'members_only' | 'ignored' | 'queued' | 'downloading';

export const getVideoStatus = (video: ChannelVideo): VideoStatus => {
  if (video.activity) return video.activity;
  if (video.ignored) {
    return 'ignored';
  }
  if (video.added && video.removed) {
    return 'missing';
  }
  if (video.added) {
    return 'downloaded';
  }
  if (video.availability === 'subscriber_only') {
    return 'members_only';
  }
  return 'never_downloaded';
};

export const getStatusColor = (status: VideoStatus) => {
  switch (status) {
    case 'queued':
    case 'downloading':
      return 'info';
    case 'downloaded':
      return 'success';
    case 'missing':
      return 'error';
    case 'never_downloaded':
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
    case 'queued':
      return <ScheduleIcon size={16} />;
    case 'downloading':
      return <ScheduleIcon size={16} className="animate-pulse motion-reduce:animate-none" />;
    case 'downloaded':
      return <CheckCircleIcon size={16} data-testid="CheckCircleIcon" />;
    case 'missing':
      return <CloudOffIcon size={16} data-testid="CloudOffIcon" />;
    case 'members_only':
      return <LockIcon size={16} data-testid="LockIcon" />;
    case 'ignored':
      return <BlockIcon size={16} data-testid="BlockIcon" />;
    default:
      return <NewReleasesIcon size={16} data-testid="NewReleasesIcon" />;
  }
};

export const getStatusLabel = (status: VideoStatus) => {
  switch (status) {
    case 'queued':
      return 'Queued…';
    case 'downloading':
      return 'Downloading…';
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

export const getVideoStatusLabel = (video: ChannelVideo, status = getVideoStatus(video)) => {
  if (status !== 'members_only') return getStatusLabel(status);
  switch (video.members_only_access) {
    case 'access_confirmed': return 'Members: Access Confirmed';
    case 'access_unchecked': return 'Members: Will Check Access';
    case 'access_denied': return 'Members: Account Lacks Access';
    default: return 'Members: Cookies Required';
  }
};

export const getStatusChipVariant = (status: VideoStatus): 'filled' | 'outlined' => {
  switch (status) {
    case 'downloaded':
    case 'missing':
      return 'filled';
    default:
      return 'outlined';
  }
};

export const getStatusChipStyle = (status: VideoStatus): React.CSSProperties => {
  switch (status) {
    case 'queued':
    case 'downloading':
      return { backgroundColor: 'transparent', color: 'var(--info)' };
    case 'downloaded':
      return {
        backgroundColor: 'var(--success)',
        color: 'var(--success-foreground)',
      };
    case 'missing':
      return {
        backgroundColor: 'var(--destructive)',
        color: 'var(--destructive-foreground)',
      };
    case 'never_downloaded':
      return {
        backgroundColor: 'transparent',
        color: 'var(--warning)',
      };
    case 'ignored':
      return {
        backgroundColor: 'transparent',
        color: 'var(--muted-foreground)',
      };
    case 'members_only':
    default:
      return {
        backgroundColor: 'transparent',
        color: 'var(--muted-foreground)',
      };
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
