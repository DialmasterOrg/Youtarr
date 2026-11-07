import React from 'react';
import { CheckCircle as CheckCircleIcon, CloudOff as CloudOffIcon, Lock as LockIcon, NewReleases as NewReleasesIcon, Schedule as ScheduleIcon, VideoLibrary as VideoLibraryIcon, Block as BlockIcon, Trash2 as Trash2Icon } from '../lib/icons';
import { ChannelVideo, MembersAccessState } from '../types/ChannelVideo';
import { getRemovalState } from './videoRemoval';

export type VideoStatus = 'never_downloaded' | 'downloaded' | 'missing' | 'deleted' | 'members_only' | 'ignored' | 'queued' | 'downloading';

interface MembersOnlyFields {
  availability?: string | null;
  members_access?: MembersAccessState | null;
}

export const isMembersOnlyVideo = (video: MembersOnlyFields): boolean =>
  video.availability === 'subscriber_only' || Boolean(video.members_access);

// The one rule for whether a members-only video can be selected for download.
// A members-only video without a state (an older server, or a failed lookup)
// stays blocked, as it was before access was tracked.
export const isMembersOnlyBlocked = (video: MembersOnlyFields): boolean => {
  if (!isMembersOnlyVideo(video)) return false;
  return video.members_access !== 'unchecked' && video.members_access !== 'confirmed';
};

export const getVideoStatus = (video: ChannelVideo): VideoStatus => {
  if (video.activity) return video.activity;
  if (video.ignored) {
    return 'ignored';
  }
  // A local file, or its removal, says more than YouTube's access rules.
  if (video.added) {
    const removalState = getRemovalState(video.removed, video.removed_reason);
    return removalState === 'present' ? 'downloaded' : removalState;
  }
  if (isMembersOnlyBlocked(video)) {
    return 'members_only';
  }
  return 'never_downloaded';
};

export interface MembersAccessInfo {
  label: string;
  description: string;
  // Same tokens on every page that shows the chip.
  color: string;
}

export const getMembersAccessInfo = (access: MembersAccessState | null | undefined): MembersAccessInfo => {
  switch (access) {
    case 'confirmed':
      return {
        label: 'Members: access',
        description: 'Members-only. The configured cookies can open this video, so it downloads like any other.',
        color: 'var(--success)',
      };
    case 'unchecked':
      return {
        label: 'Members: not checked',
        description: 'Members-only. Access has not been checked in the last 24 hours. It is checked on the next download, or open the video and choose Check access.',
        color: 'var(--warning)',
      };
    case 'denied':
      return {
        label: 'Members: no access',
        description: 'Members-only. The account in the configured cookies is not a member of this channel. Downloads skip it for 24 hours; check again after joining.',
        color: 'var(--destructive)',
      };
    case 'no_cookies':
    default:
      return {
        label: 'Members only',
        description: 'Members-only. Add cookies from an account that is a member of this channel in Settings to download it.',
        color: 'var(--muted-foreground)',
      };
  }
};

// Previously downloaded, but the file is gone: deleted by Youtarr (or marked
// as deleted), or missing from disk.
export const isRemovedStatus = (status: VideoStatus): status is 'missing' | 'deleted' =>
  status === 'missing' || status === 'deleted';

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
    case 'deleted':
    case 'members_only':
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
    case 'deleted':
      return <Trash2Icon size={16} data-testid="Trash2Icon" />;
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
    case 'deleted':
      return 'Deleted';
    case 'members_only':
      return 'Members Only';
    case 'ignored':
      return 'Ignored';
    default:
      return 'Not Downloaded';
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
    // Deleted is a neutral state, not a warning: Youtarr removed the file on purpose.
    case 'deleted':
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
