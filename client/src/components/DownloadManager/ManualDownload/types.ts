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
}

export interface DownloadSettings {
  resolution: string;
  videoCount: number;
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
  };
  error?: string;
}