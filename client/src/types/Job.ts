import { VideoData } from './VideoData';

export interface FailedVideo {
  youtubeId: string;
  title?: string;
  channel?: string;
  error: string;
  url?: string | null;
  autoRetryQueued?: boolean;
  diagnosisKey?: string;
}

export interface DownloadDiagnosis {
  key: string;
  title: string;
  message: string;
  count: number;
}

export interface Job {
  jobType: string;
  status: string;
  output: string;
  timeCreated: number;
  timeInitiated: number;
  id: string;
  data: {
    videos: VideoData[];
    failedVideos?: FailedVideo[];
    diagnoses?: DownloadDiagnosis[];
  };
}
