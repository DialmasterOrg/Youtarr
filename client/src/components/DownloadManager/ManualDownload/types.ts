import type { MembersAccessState } from '../../../types/ChannelVideo';
import type { DownloadOverrideSettings } from '../../../types/downloadOverrideSettings';

export interface VideoInfo {
  youtubeId: string;
  url: string;
  channelName: string;
  channelId?: string | null;
  videoTitle: string;
  duration: number;
  publishedAt: number;
  availability?: string;
  isAlreadyDownloaded: boolean;
  isMembersOnly: boolean;
  // Set for a members-only video the configured cookies can open (or have not
  // been checked against), which stays in the list with a members chip.
  membersAccess?: MembersAccessState | null;
  media_type?: string;
  isBulkImport?: boolean;
}

export interface DownloadSettings extends DownloadOverrideSettings {
  videoCount?: number;
}

export interface ValidationResponse {
  isValidUrl: boolean;
  isAlreadyDownloaded: boolean;
  isMembersOnly: boolean;
  // Set for a members-only video: whether the configured cookies can open it.
  membersAccess?: MembersAccessState | null;
  metadata?: {
    youtubeId: string;
    url: string;
    channelName: string;
    channelId?: string | null;
    videoTitle: string;
    duration: number;
    publishedAt: number;
    availability?: string;
    media_type?: string;
  };
  error?: string;
  errorCode?: string;
}
