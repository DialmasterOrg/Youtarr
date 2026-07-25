import { FailedVideo, DownloadDiagnosis } from '../../types/Job';

// Shapes of the downloadProgress WebSocket payloads and the
// GET /api/jobs/current-activity REST snapshot. The server-side source of
// truth is DownloadProgressMonitor.buildPayload() and the downloadJobFinalizer
// final payload; keep these in sync with those emitters.

export interface ParsedProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
}

export interface VideoInfo {
  channel: string;
  title: string;
  displayTitle: string;
}

export interface VideoCount {
  current: number;
  total: number;
  completed: number;
  skipped: number;
  skippedThisChannel: number;
}

export interface StructuredProgress {
  jobId: string;
  progress: ParsedProgress;
  stalled: boolean;
  state?: string;
  videoInfo?: VideoInfo;
  downloadType?: string;
  currentChannelName?: string;
  videoCount?: VideoCount;
}

export interface TerminatedChannelSummary {
  channelId: string;
  uploader?: string | null;
  url?: string | null;
  terminatedAt?: string | null;
}

export interface FinalSummary {
  totalDownloaded: number;
  totalSkipped: number;
  totalFailed?: number;
  totalAutoRetried?: number;
  totalMembersOnly?: number;
  totalTerminatedChannels?: number;
  totalTerminationFailures?: number;
  failedVideos?: FailedVideo[];
  diagnoses?: DownloadDiagnosis[];
  terminatedChannels?: TerminatedChannelSummary[];
  terminationFailures?: string[];
  jobType: string;
  completedAt?: string;
}

// One downloadProgress message payload (live broadcast or REST replay)
export interface DownloadProgressPayload {
  dateTimeStamp?: number;
  clearPreviousSummary?: boolean;
  warning?: boolean;
  terminationReason?: string;
  error?: boolean;
  errorCode?: string;
  text?: string;
  progress?: StructuredProgress;
  finalSummary?: FinalSummary;
}
