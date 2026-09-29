export type DownloadPauseReasonType = 'usage' | 'freeSpace';

export interface DownloadPauseReason {
  type: DownloadPauseReasonType;
  currentBytes: number;
  limitBytes: number;
  /** Server-written description, e.g. "downloaded videos use 512.0 GB, over the 500 GB limit" */
  text: string;
}

/** Shape of GET /api/jobs/download-pause and the downloadPauseChanged broadcast. */
export interface DownloadPauseStatus {
  paused: boolean;
  pausedSince: string | null;
  reasons: DownloadPauseReason[];
  usage: {
    limit: string | null;
    limitBytes: number | null;
    downloadedBytes: number | null;
  };
  freeSpace: {
    limit: string | null;
    limitBytes: number | null;
    availableBytes: number | null;
  };
  checkedAt: string | null;
}
