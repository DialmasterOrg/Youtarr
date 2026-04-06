import { GLOBAL_DEFAULT_SENTINEL } from '../utils/channelHelpers';

export interface ReviewChannel {
  channelId: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  alreadySubscribed: boolean;
}

export interface RowSettings {
  autoDownloadEnabled: boolean;
  videoQuality: string | null;
  downloadType: 'videos' | 'shorts' | 'livestreams';
  subFolder: string | null;
  defaultRating: string | null;
}

export interface RowState {
  selected: boolean;
  settings: RowSettings;
}

export type ImportPhase = 'source' | 'preview-loading' | 'reviewing' | 'importing' | 'complete';
export type ImportSource = 'takeout' | 'cookies';

export interface PreviewResponse {
  source: ImportSource;
  totalFound: number;
  alreadySubscribedCount: number;
  channels: ReviewChannel[];
}

export interface ImportJobSummary {
  jobId: string;
  status: string;
  total: number;
  done: number;
  errors: number;
  startedAt: string;
  completedAt?: string | null;
}

export interface ImportChannelResult {
  channelId: string;
  title: string;
  state: 'success' | 'error' | 'skipped' | 'pending';
  error?: string;
  details?: string;
  reason?: string;
}

export interface ImportJobDetail extends ImportJobSummary {
  results: ImportChannelResult[];
}

export interface ImportStartRequest {
  channels: Array<{
    channelId: string;
    url: string;
    title?: string;
    settings: RowSettings;
  }>;
}

export const DEFAULT_ROW_SETTINGS: RowSettings = {
  autoDownloadEnabled: true,
  videoQuality: null,
  downloadType: 'videos',
  subFolder: GLOBAL_DEFAULT_SENTINEL,
  defaultRating: null,
};
