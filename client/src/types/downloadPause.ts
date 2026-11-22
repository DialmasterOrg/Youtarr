/** usage and freeSpace: a storage limit; library: the downloads folder looks unavailable. */
export type DownloadPauseReasonType = 'usage' | 'freeSpace' | 'library';

export interface DownloadPauseReason {
  type: DownloadPauseReasonType;
  /** Storage reasons only. */
  currentBytes?: number;
  /** Storage reasons only. */
  limitBytes?: number;
  /** Library reasons only: which downloads folder check failed (empty, missing, unreadable, not-found). */
  libraryReason?: string;
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
