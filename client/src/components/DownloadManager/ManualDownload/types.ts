import type { MembersAccessState } from '../../../types/ChannelVideo';

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
  media_type?: string;
  isBulkImport?: boolean;
}

export interface DownloadSettings {
  resolution?: string;
  videoCount?: number;
  allowRedownload?: boolean;
  subfolder?: string | null;
  audioFormat?: string | null;
  rating?: string | null;
  skipVideoFolder?: boolean;
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
