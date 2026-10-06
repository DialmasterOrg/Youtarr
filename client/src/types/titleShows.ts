/** Title shows: shows defined on a channel by title patterns. */

export type PatternKind = 'simple' | 'regex';
export type SeasonSource = 'title' | 'fixed' | 'year';
export type EpisodeSource = 'title' | 'date' | 'order';

/** One title pattern of a show, as the user writes it. */
export interface TitlePatternDraft {
  text: string;
  kind: PatternKind;
  seasonSource: SeasonSource;
  seasonFixed?: number | null;
  episodeSource: EpisodeSource;
}

/** A show as the editor sends it (an existing show carries its id). */
export interface TitleShowDraft {
  id?: number;
  name: string;
  folderName?: string;
  /** '' = main folder; omitted for the default TV folder */
  libraryFolder?: string;
  excludeTerms?: string[];
  /** Season names by season number */
  seasonNames?: Record<string, string>;
  patterns: TitlePatternDraft[];
}

export interface TitleShowCounts {
  episodes: number;
  downloaded: number;
  duplicates: number;
  unsupported: number;
}

/** A stored title show from GET /api/channels/:channelId/tv/shows */
export interface TitleShow {
  id: number;
  name: string;
  folderName: string;
  libraryFolder: string;
  position: number;
  retired: boolean;
  excludeTerms: string[];
  seasonNames: Record<string, string>;
  patterns: Array<TitlePatternDraft & { compiledRegex: string }>;
  counts: TitleShowCounts | null;
}

export interface TitleShowConflict {
  youtubeId: string;
  kind: 'duplicate' | 'classification_error';
  showId: number | null;
  duplicateOf: string | null;
  season: number | null;
  episode: number | null;
  message: string | null;
  /** Youtarr ignored the video and suppressed it in the download archive */
  suppressed: boolean;
  title: string | null;
  downloaded: boolean;
  /** The videos row, for a downloaded copy */
  videoId: number | null;
  duplicateOfTitle: string | null;
}

/** GET /api/channels/:channelId/tv/shows */
export interface ChannelTitleShows {
  shows: TitleShow[];
  conflicts: TitleShowConflict[];
  showOnlyDownloads: boolean;
  tvFolders: string[];
  /** Where a new show goes when none is chosen; null when one must be chosen */
  defaultLibraryFolder: string | null;
}

export type EpisodeDownloadState = 'downloaded' | 'queued' | 'not_downloaded';

export interface PreviewEpisode {
  youtubeId: string;
  title: string;
  season: number | null;
  episode: number | null;
  code: string | null;
  status: 'assigned' | 'pending_number';
  episodeTitle: string | null;
  patternIndex: number;
  downloadState: EpisodeDownloadState;
}

export interface PreviewShow {
  key: string;
  id: number | null;
  name: string;
  folderName: string;
  libraryFolder: string;
  counts: { episodes: number; downloaded: number; pending: number; duplicates: number; unsupported: number };
  episodes: PreviewEpisode[];
  truncated: boolean;
}

export interface PreviewDuplicate {
  youtubeId: string;
  title: string | null;
  showKey: string;
  showName: string | null;
  season: number;
  episode: number;
  code: string | null;
  duplicateOf: string;
  duplicateOfTitle: string | null;
  downloaded: boolean;
}

export interface PreviewGap {
  showKey: string;
  season: number;
  have: number;
  highest: number;
  missing: number[];
  truncated: boolean;
}

export type UnsupportedReason = 'compilation' | 'part' | 'number-out-of-range' | 'missing-number';

export interface PreviewUnsupported {
  youtubeId: string;
  title: string | null;
  showKey: string;
  showName: string | null;
  reason: UnsupportedReason;
  season: number | null;
  episode: number | null;
  episodeEnd: number | null;
  part: number | null;
}

export interface PreviewEpisodeRef {
  showKey: string;
  showName: string | null;
  code: string | null;
  status: string;
}

export interface PreviewChange {
  youtubeId: string;
  title: string;
  downloaded: boolean;
  from: PreviewEpisodeRef | null;
  to: PreviewEpisodeRef | null;
}

/** POST /api/channels/:channelId/tv/preview */
export interface TitleShowPreview {
  knownVideos: number;
  shows: PreviewShow[];
  duplicates: PreviewDuplicate[];
  gaps: PreviewGap[];
  unsupported: PreviewUnsupported[];
  unmatched: { count: number; videos: Array<{ youtubeId: string; title: string; downloaded: boolean }> };
  changes: PreviewChange[];
  changeCount: number;
  /** Downloads outside the downloads folder: their files stay where they are */
  staysOutside: number;
  filesToMove: number;
  retired: Array<{ key: string; name: string | null }>;
  relocated: Array<{ key: string; name: string | null }>;
  /** Each draft's patterns compiled to Python regexes, for regex mode */
  compiled: Array<{ key: string; patterns: string[] }>;
}

/** A manual episode assignment, "Not an episode", or back to automatic. */
export type EpisodeAssignment =
  | { showId: number; season: number; episode: number }
  | { notAnEpisode: true }
  | { automatic: true };

/** GET /api/videos/:youtubeId/episode */
export interface VideoEpisode {
  channelId: string | null;
  assignable: boolean;
  classification: {
    showId: number;
    showName: string | null;
    kind: 'channel' | 'title' | null;
    status: string;
    season: number | null;
    episode: number | null;
    code: string | null;
    source: string | null;
    notAnEpisode: boolean;
  } | null;
  shows: Array<{ id: number; name: string; seasonNames: Record<string, string> }>;
}

export interface MissingSeason {
  season: number;
  name: string | null;
  episodes: number;
  downloaded: number;
  notDownloaded: Array<{ youtubeId: string; title: string | null; episode: number; code: string }>;
  gaps: number[];
  gapsTruncated: boolean;
}

/** GET /api/channels/:channelId/tv/shows/:showId/missing */
export interface MissingEpisodes {
  showId: number;
  name: string;
  seasons: MissingSeason[];
}

/** The planned episode of a listing video not downloaded yet */
export interface PlannedEpisode {
  showName: string;
  season: number;
  episode: number;
  code: string;
}
