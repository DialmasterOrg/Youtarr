import type { LibraryFolder, PlexMappingChoice } from '../types/tvShows';
import type {
  LibraryCheckFolder, LibraryCheckIssue, LibraryCheckLibrary, LibraryCheckResponse, LibraryCheckServerReport,
  MediaServerType, PlexMappingState,
} from '../types/libraryCheck';
import { formatDateTimeInZone } from './formatters';
import { folderKey, libraryFolderLabel } from './libraryLayouts';

/**
 * What the Library folders page and the Core card say about folders and the
 * media server check (UI spec 4.3-4.6): folder states, each server's status
 * per folder, the attention list (library-wide issues counted once), and the
 * check status. Shared so both always show the same count.
 */

export const SERVER_ORDER: MediaServerType[] = ['plex', 'jellyfin', 'emby'];
export const SERVER_NAMES: Record<MediaServerType, string> = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby' };

export type FolderState = 'active' | 'holdsVideos' | 'unused' | 'emptyMain';

export function isActive(folder: LibraryFolder): boolean {
  return folder.isDefault || folder.channels > 0 || (folder.playlists ?? 0) > 0 || (folder.titleShows ?? 0) > 0;
}

export function folderState(folder: LibraryFolder): FolderState {
  if (isActive(folder)) return 'active';
  if (folder.hasFiles || (folder.fileCount ?? 0) > 0) return 'holdsVideos';
  return folder.name ? 'unused' : 'emptyMain';
}

/** Active and Holds videos folders should be in a library on every server. */
export function needsLibrary(state: FolderState): boolean {
  return state === 'active' || state === 'holdsVideos';
}

/** Issues that describe a library rather than a folder, with their short attention text. */
export const LIBRARY_WIDE_SHORT: Record<string, string> = {
  nfoSaver: 'saves NFO files',
  onlineFetchers: 'looks things up online',
  plexSeriesAgent: 'uses the Plex Series agent',
  plexLegacyAgent: 'uses a legacy agent or scanner',
};
/** Issue codes shown as notes (info icon) and left out of counts. None today (UI 4.4). */
export const NOTE_CODES: ReadonlySet<string> = new Set<string>();
const UNLISTED_CODES = new Set(['noLibrary', 'unreachable']);

/** Issue codes that say a library overlaps another library's folder. */
export const OVERLAP_ISSUE_CODES: ReadonlySet<string> = new Set(['nestedLibrary', 'overlap']);

export function isOverlapIssue(code: string): boolean {
  return OVERLAP_ISSUE_CODES.has(code);
}

/** The mapping choice of a Plex TV folder; an older answer without `choice` is read from its mapped library. */
export function plexMappingChoice(mapping: PlexMappingState | null | undefined): PlexMappingChoice {
  return mapping?.choice ?? (mapping?.mappedLibraryId ? 'library' : 'none');
}

export function isLibraryWide(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(LIBRARY_WIDE_SHORT, code);
}

/** The issues a server card lists. */
export function listedIssues(report: LibraryCheckServerReport): LibraryCheckIssue[] {
  return report.issues.filter((issue) => !UNLISTED_CODES.has(issue.code));
}

export function countedIssues(report: LibraryCheckServerReport): LibraryCheckIssue[] {
  return listedIssues(report).filter((issue) => !NOTE_CODES.has(issue.code));
}

/** Libraries that show the folder (a library inside a TV folder is an issue, not a holder). */
export function holdingLibraries(report: LibraryCheckServerReport): LibraryCheckLibrary[] {
  return report.libraries.filter((library) => library.relation !== 'inside');
}

export interface LibraryCheckState {
  data: LibraryCheckResponse | null;
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
}

export interface ServerRef {
  serverType: MediaServerType;
  name: string;
}

/** The check's servers once it answered, else the configured ones. */
export function serversOf(check: LibraryCheckState, configured: MediaServerType[]): ServerRef[] {
  const list = check.data
    ? check.data.servers.map((server) => ({ serverType: server.serverType, name: server.name }))
    : configured.map((serverType) => ({ serverType, name: SERVER_NAMES[serverType] }));
  return [...list].sort((a, b) => SERVER_ORDER.indexOf(a.serverType) - SERVER_ORDER.indexOf(b.serverType));
}

export function reportFor(data: LibraryCheckResponse | null, name: string): LibraryCheckFolder | null {
  return data?.folders.find((entry) => folderKey(entry.name) === folderKey(name)) ?? null;
}

export type ServerDisplay = 'checking' | 'unchecked' | 'ok' | 'issues' | 'noLibrary' | 'fine';

export interface ServerStatus extends ServerRef {
  display: ServerDisplay;
  /** The chip word (UI 4.4) */
  word: string;
  report: LibraryCheckServerReport | null;
}

function okWord(report: LibraryCheckServerReport): string {
  const holders = holdingLibraries(report);
  if (holders.length === 0) return 'OK';
  return holders.length === 1 ? holders[0].name : `${holders[0].name} +${holders.length - 1}`;
}

export function serverStatuses(folder: LibraryFolder, check: LibraryCheckState, configured: MediaServerType[]): ServerStatus[] {
  const folderReport = reportFor(check.data, folder.name);
  const state = folderState(folder);
  return serversOf(check, configured).map((server): ServerStatus => {
    const report = folderReport?.servers.find((entry) => entry.serverType === server.serverType) ?? null;
    if (!report) {
      const checking = check.loading && !check.error;
      return { ...server, report, display: checking ? 'checking' : 'unchecked', word: checking ? 'Checking...' : 'Not checked' };
    }
    if (report.status === 'unreachable') return { ...server, report, display: 'unchecked', word: 'Not checked' };
    if (report.status === 'ok') return { ...server, report, display: 'ok', word: okWord(report) };
    if (report.status === 'warning') {
      const count = countedIssues(report).length;
      return { ...server, report, display: 'issues', word: `${count} ${count === 1 ? 'issue' : 'issues'}` };
    }
    return { ...server, report, display: needsLibrary(state) ? 'noLibrary' : 'fine', word: 'No library' };
  });
}

export interface FolderAttentionServer extends ServerRef {
  display: 'noLibrary' | 'issues';
  issueCount: number;
  /** The first issue that belongs to the folder, for the Core card's one-line message */
  firstMessage: string | null;
}

export type AttentionItem =
  | {
    kind: 'library'; key: string; serverType: MediaServerType; serverName: string; libraryId: string;
    libraryName: string; code: string; short: string; folders: string[]; text: string;
  }
  | {
    kind: 'folder'; key: string; folder: string; label: string; layout: LibraryFolder['layout'];
    servers: FolderAttentionServer[]; text: string;
  };

type LibraryItem = Extract<AttentionItem, { kind: 'library' }>;
type FolderItem = Extract<AttentionItem, { kind: 'folder' }>;

export function buildAttention(folders: LibraryFolder[], check: LibraryCheckState, configured: MediaServerType[]): AttentionItem[] {
  if (!check.data) return [];
  const groups = new Map<string, LibraryItem>();
  const folderItems: FolderItem[] = [];
  for (const folder of folders) {
    const counted: FolderAttentionServer[] = [];
    for (const status of serverStatuses(folder, check, configured)) {
      const { report } = status;
      if (!report || status.display === 'unchecked' || status.display === 'checking') continue;
      for (const issue of report.issues) {
        if (!isLibraryWide(issue.code) || !issue.libraryId) continue;
        const key = `${status.serverType}:${issue.libraryId}:${issue.code}`;
        const libraryName = report.libraries.find((library) => library.id === issue.libraryId)?.name ?? `library ${issue.libraryId}`;
        const group = groups.get(key) ?? {
          kind: 'library', key, serverType: status.serverType, serverName: status.name, libraryId: issue.libraryId,
          libraryName, code: issue.code, short: LIBRARY_WIDE_SHORT[issue.code], folders: [], text: '',
        };
        if (!group.folders.some((name) => folderKey(name) === folderKey(folder.name))) group.folders.push(folder.name);
        groups.set(key, group);
      }
      const own = countedIssues(report).filter((issue) => !isLibraryWide(issue.code));
      if (status.display === 'noLibrary') {
        counted.push({ serverType: status.serverType, name: status.name, display: 'noLibrary', issueCount: 0, firstMessage: null });
      } else if (status.display === 'issues' && own.length > 0) {
        counted.push({
          serverType: status.serverType, name: status.name, display: 'issues',
          issueCount: countedIssues(report).length, firstMessage: own[0].message,
        });
      }
    }
    if (counted.length > 0) {
      const label = libraryFolderLabel(folder.name);
      folderItems.push({
        kind: 'folder', key: `folder:${folderKey(folder.name)}`, folder: folder.name, label, layout: folder.layout,
        servers: counted, text: `${label} (${counted.map((server) => server.name).join(', ')})`,
      });
    }
  }
  const libraryItems = [...groups.values()]
    .map((group) => ({
      ...group,
      text: `${group.serverName} library ${group.libraryName} ${group.short}`
        + `${group.folders.length > 1 ? ` (affects ${group.folders.length} folders)` : ''}`,
    }))
    .sort((a, b) => b.folders.length - a.folders.length || a.text.localeCompare(b.text));
  folderItems.sort((a, b) => b.servers.length - a.servers.length || a.label.localeCompare(b.label));
  return [...libraryItems, ...folderItems];
}

export type CheckStatusKind = 'none' | 'checking' | 'unchecked' | 'full' | 'partial' | 'unreachable' | 'failed';

export interface CheckStatus {
  kind: CheckStatusKind;
  /** A check is running (a re-check keeps the earlier results) */
  running: boolean;
  checked: string[];
  unreachable: Array<{ name: string; error: string | null }>;
  lastCheckedAt: number | null;
  hasEarlierResults: boolean;
  error: string | null;
}

export function checkStatus(check: LibraryCheckState, configured: MediaServerType[]): CheckStatus {
  const servers = check.data?.servers ?? [];
  const base = {
    running: check.loading,
    checked: servers.filter((server) => server.reachable).map((server) => server.name),
    unreachable: servers.filter((server) => !server.reachable).map((server) => ({ name: server.name, error: server.error })),
    lastCheckedAt: check.lastCheckedAt,
    hasEarlierResults: Boolean(check.data),
    error: check.error,
  };
  if (check.data ? servers.length === 0 : configured.length === 0 && !check.loading) return { ...base, kind: 'none' };
  if (check.error) return { ...base, kind: 'failed' };
  if (!check.data) return { ...base, kind: check.loading ? 'checking' : 'unchecked' };
  if (base.checked.length === 0) return { ...base, kind: 'unreachable' };
  return { ...base, kind: base.unreachable.length > 0 ? 'partial' : 'full' };
}

/** "Plex", "Plex and Jellyfin", "Plex, Jellyfin and Emby". */
export function joinNames(names: string[], conjunction: 'and' | 'or' = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${conjunction} ${names[names.length - 1]}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "just now", "5 min ago", "3 h ago", else the date and time in the server's zone. */
export function timeAgo(at: number, now: number, timeZone: string | null | undefined): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  const iso = new Date(at).toISOString();
  return formatDateTimeInZone(iso, timeZone) ?? iso;
}
