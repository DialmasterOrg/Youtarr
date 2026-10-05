import type { EpisodeAssignment, TitleShowDraft } from './titleShows';

/** An episode assignment within a title show change */
export type EpisodeOverride = { youtubeId: string } & EpisodeAssignment;

/** A settings change that moves downloaded files (POST /api/tv/reorganize[/preview]). */
export type ReorganizeChange =
  | { type: 'channelLayout'; channelId: string; layout: 'videos' | 'tv'; folder?: string }
  | { type: 'channel'; channelId: string; subFolder: string | null; previousSubFolder?: string | null }
  | { type: 'folderLayout'; folder: string; layout: 'videos' | 'tv'; previousLayout?: 'videos' | 'tv' }
  | { type: 'defaultSubfolder'; value: string; previousValue?: string }
  | { type: 'titleShows'; channelId: string; shows: TitleShowDraft[]; overrides?: EpisodeOverride[] };

export type ReorganizeFlag = 'override-placed' | 'adopted' | 'upload-date-only' | 'download-time' | 'movie-tags';

export type ReorganizeProblemKind = 'missing' | 'collision' | 'no-name' | 'no-date' | 'unsafe-name' | 'episode-taken';

export interface ReorganizePreviewItem {
  youtubeId: string;
  title: string | null;
  /** Paths relative to the downloads folder */
  from: string | null;
  to: string | null;
  /** e.g. "S2024E03151200" for a video that becomes an episode */
  episode: string | null;
  flags: ReorganizeFlag[];
}

export interface ReorganizeProblem {
  videoId: number;
  youtubeId: string;
  title: string | null;
  problem: ReorganizeProblemKind;
  /** The path in the way, for a collision */
  detail: string | null;
}

export interface ReorganizePreviewShow {
  name: string;
  libraryFolder: string;
  folderName: string;
  action: 'create' | 'move' | 'keep';
  /** A channel's show, or a title show */
  kind?: 'channel' | 'title';
}

export interface ReorganizeTotals {
  videos: number;
  toTv: number;
  toVideos: number;
  betweenFolders: number;
  unchanged: number;
  missing: number;
  collisions: number;
  noName: number;
  noDate: number;
  unsafeName: number;
  /** Title episodes waiting for their upload year whose number another video holds */
  episodeTaken?: number;
  overridePlaced: number;
  adopted: number;
  uploadDateOnly: number;
  downloadTime: number;
  movieTags: number;
}

export interface ReorganizeWatchState {
  serverType: 'plex' | 'jellyfin' | 'emby';
  videos: number;
  users: number;
}

export interface ReorganizeBlocker {
  /** 'problems' when nothing can move because no video could be planned */
  reason: string;
  message: string;
}

/** POST /api/tv/reorganize/preview */
export interface ReorganizePreview {
  revision: string;
  needed: boolean;
  change: ReorganizeChange & { label: string };
  totals: ReorganizeTotals;
  shows: ReorganizePreviewShow[];
  /** The TV library folders videos move into ('' = main folder) */
  tvFolders?: string[];
  /** The first 200 moves */
  items: ReorganizePreviewItem[];
  /** The first 200 videos that can't move or need attention */
  problems: ReorganizeProblem[];
  watchState: ReorganizeWatchState[];
  blocked: ReorganizeBlocker | null;
}

/** POST /api/tv/reorganize */
export interface ReorganizeStartResult {
  operationId: number | null;
  applied: boolean;
}

export type ReorganizeOperationStatus = 'starting' | 'running' | 'completed' | 'partial' | 'failed';

export interface ReorganizeFailedItem {
  id: number;
  youtubeId: string;
  title: string | null;
  channelId: string | null;
  error: string | null;
  /** Its files reached their destination, but finishing failed */
  filesMoved?: boolean;
}

/** GET /api/tv/operations/:id */
export interface ReorganizeOperation {
  id: number | null;
  label: string;
  status: ReorganizeOperationStatus;
  changeType?: ReorganizeChange['type'];
  change?: ReorganizeChange;
  total?: number;
  done?: number;
  failed?: number;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  failedItems?: ReorganizeFailedItem[];
}

/** tvReorganizeProgress WebSocket payload */
export interface ReorganizeProgressMessage {
  operationId: number;
  status: ReorganizeOperationStatus;
  total: number;
  done: number;
  failed: number;
  label: string;
}

/** A channel's reorganize state on GET /api/channels/:channelId/tv */
export interface ChannelReorganizeState {
  running: boolean;
  unmoved: { operationId: number; failed: number; status: ReorganizeOperationStatus } | null;
}

export type WatchHoldState = 'pending' | 'restored' | 'failed' | 'dismissed';

/** A watch-state restore from GET /api/tv/holds */
export interface WatchHold {
  id: number;
  state: WatchHoldState;
  serverType: 'plex' | 'jellyfin' | 'emby';
  serverUserId: string;
  serverUserName: string | null;
  youtubeId: string | null;
  title: string | null;
  channelName: string | null;
  played: boolean;
  positionMs: number | null;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  expiresAt: string;
}

export interface WatchHoldsResponse {
  holds: WatchHold[];
  counts: { pending: number; failed: number };
}
