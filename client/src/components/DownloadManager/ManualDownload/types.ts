export interface VideoInfo {
  youtubeId: string;
  url: string;
  channelName: string;
  videoTitle: string;
  duration: number;
  publishedAt: number;
  availability?: string;
  isAlreadyDownloaded: boolean;
  isMembersOnly: boolean;
  media_type?: string;
}

export interface DownloadSettings {
  resolution: string;
  videoCount: number;
  allowRedownload?: boolean;
  subfolder?: string | null;
}

export interface ValidationResponse {
  isValidUrl: boolean;
  isAlreadyDownloaded: boolean;
  isMembersOnly: boolean;
  metadata?: {
    youtubeId: string;
    url: string;
    channelName: string;
    videoTitle: string;
    duration: number;
    publishedAt: number;
    availability?: string;
    media_type?: string;
  };
  error?: string;
}
