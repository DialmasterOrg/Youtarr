// What GET /api/arr-bridge/searches returns, and how the Settings page words
// it. The codes are set by the server (modules/arrBridge); a code this file
// does not know is shown as it is.

export type ArrSearchOutcome = 'offered' | 'nothing' | 'not-searched' | 'failed';
export type ArrSearchShape = 'episode' | 'season' | 'daily' | 'movie' | 'rss' | 'empty';

export interface ArrSearchCandidate {
  youtubeId: string;
  title: string | null;
  channelName: string | null;
  /** Seconds. */
  duration: number | null;
  outcome: 'offered' | 'rejected';
  /** Why it was not offered. */
  reason: string | null;
  releaseTitle: string | null;
}

export interface ArrSearchStage {
  matcher: string;
  /** What YouTube was searched for. */
  query: string;
  results: number;
  candidates: ArrSearchCandidate[];
}

export interface ArrSearchAsked {
  text: string | null;
  textSource: 'title' | 'q' | null;
  season: number | null;
  episode: number | null;
  year: number | null;
  month: number | null;
  day: number | null;
  limit: number | null;
}

export interface ArrSearch {
  id: number;
  /** When the request arrived; for a row that stands for several, the latest. */
  at: string;
  firstAt: string;
  /** Above 1 only for the no-query feed, whose requests share one row per kind. */
  count: number;
  kind: 'tv' | 'movie' | null;
  shape: ArrSearchShape;
  asked: ArrSearchAsked;
  outcome: ArrSearchOutcome;
  offered: number;
  /** Why nothing was searched, or why the search failed. */
  note: string | null;
  /** Why an episode was not searched by its title. */
  titleStageSkipped: string | null;
  stages: ArrSearchStage[];
}

export const REJECTION_LABELS: Record<string, string> = {
  'excluded-word': 'An excluded word is in the title',
  'unknown-length': 'Its length is not known',
  'too-short': 'Shorter than the shortest length allowed',
  'outside-runtime': 'Its length does not fit the runtime',
  'name-missing': 'The series or movie name is not in the title',
  'no-episode-marker': 'No season and episode in the title',
  'wrong-episode': 'The title names another episode or season',
  'several-episodes': 'The title names several episodes',
  'another-series': 'The title names another series',
  'episode-title-missing': "The episode's title is not in the title",
  'another-episode-title': "The title also has another episode's title",
  'episode-number-missing': 'A one-word episode title also needs the episode number',
  'wrong-date': 'Not uploaded on the air date',
  'year-missing': "The movie's year is not in the title",
  'failed-recently': 'Its grab failed in the last 7 days',
  'not-closest-channel': 'A channel closer to the series has this episode',
  'no-release-name': 'No release name could be built',
  'duplicate-name': 'Another video already has this release name',
  'over-limit': 'Over the number of results the request asked for',
};

export const SEARCH_NOTE_LABELS: Record<string, string> = {
  'no-query':
    'No search: the app asked for the newest releases (its RSS sync, or the indexer Test). Youtarr answers with one placeholder.',
  'daily-needs-api': 'Not searched: a daily show needs a YouTube API key, and the API is not available right now.',
  'no-search-text': 'Not searched: the name has no letters or numbers to search for.',
  'not-searchable': 'Not searched: Youtarr cannot answer this kind of request.',
  'search-held-too-long':
    'YouTube searches were backed up and this one waited too long. The app was told that Youtarr could not search.',
  'search-failed': 'The YouTube search failed. The app was told that Youtarr could not search.',
  'later-page': 'Not searched: the app asked for a second page, and Youtarr answers with one page.',
  'no-text': 'Not searched: the request had a season or an episode but no series name. Prowlarr sends these.',
  'unknown-kind': 'Not searched: plain text with no TV or movie category.',
  'no-season': 'Not searched: a TV search needs a season. A search by text alone is not answered.',
  'year-season': 'Not searched: a whole season numbered by year. Search its episodes one at a time.',
  'invalid-date': 'Not searched: the air date is not a real date.',
  'movie-without-year': 'Not searched: a movie search needs the year after the title.',
};

export const TITLE_STAGE_SKIPPED_LABELS: Record<string, string> = {
  'no-connection': "Not searched by the episode's title: Sonarr is not connected (step 3).",
  'unknown-series': "Not searched by the episode's title: Sonarr did not answer, or has no series under this name.",
  'no-usable-title': "Not searched by the episode's title: the title Sonarr has for it cannot identify the episode.",
  'no-runtime': "Not searched by the episode's title: Sonarr lists no runtime for it.",
};

export const SEARCH_STAGE_LABELS: Record<string, string> = {
  'episode-title': "By the episode's title",
  'episode-code': 'By season and episode',
  season: 'By season',
  daily: 'By air date',
  movie: 'By title and year',
};

/**
 * @returns The label for a code, or the code when it is not known
 */
export function labelOf(labels: Record<string, string>, code: string): string {
  return labels[code] ?? code;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * What a search asked for, in one line.
 */
export function describeAsked(search: ArrSearch): string {
  const { text, season, episode, year, month, day } = search.asked;
  const name = text ?? 'No name';
  if (search.shape === 'rss') return search.kind === 'movie' ? 'Newest movies' : 'Newest episodes';
  if (search.shape === 'episode' && season !== null && episode !== null) {
    return `${name} S${pad2(season)}E${pad2(episode)}`;
  }
  if (search.shape === 'season' && season !== null) return `${name} season ${season}`;
  if (search.shape === 'daily' && year !== null && month !== null && day !== null) {
    return `${name} ${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (search.shape === 'movie' && year !== null) return `${name} (${year})`;
  return name;
}

type OutcomeTone = 'default' | 'success' | 'warning' | 'error';

/**
 * The chip a search row carries.
 */
export function searchOutcome(search: ArrSearch): { label: string; tone: OutcomeTone } {
  if (search.outcome === 'offered') return { label: `${search.offered} offered`, tone: 'success' };
  if (search.outcome === 'nothing') return { label: 'Nothing offered', tone: 'warning' };
  if (search.outcome === 'failed') return { label: 'Could not search', tone: 'error' };
  return { label: 'Not searched', tone: 'default' };
}

/**
 * @param seconds - A video's length
 * @returns "21:58", "1:19:05", or "length unknown"
 */
export function formatLength(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'length unknown';
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = pad2(whole % 60);
  return hours > 0 ? `${hours}:${pad2(minutes)}:${rest}` : `${minutes}:${rest}`;
}

/**
 * The offered videos first, each group in YouTube's order.
 */
export function offeredFirst(candidates: ArrSearchCandidate[]): ArrSearchCandidate[] {
  return [
    ...candidates.filter((candidate) => candidate.outcome === 'offered'),
    ...candidates.filter((candidate) => candidate.outcome !== 'offered'),
  ];
}
