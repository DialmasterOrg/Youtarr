import type { LibraryFolder, LibraryLayout } from '../../types/tvShows';
import type { LibraryCheckLibrary, LibraryCheckResponse, LibraryCheckServerReport, MediaServerType } from '../../types/libraryCheck';
import {
  CheckStatus, SERVER_NAMES, SERVER_ORDER, ServerRef, ServerStatus, folderState, holdingLibraries, isOverlapIssue, joinNames, reportFor, timeAgo,
} from '../../utils/libraryAttention';
import { countOf, folderLabel, layoutName, SEP, units } from './folderText';
import { LIBRARY_TYPE_NAMES, libraryTypeName } from './libraryTypes';

/** Inspector Media servers copy (UI 5.7.2) and the layout preview's afterwards lines (UI 5.7.3). */

export const NO_SERVERS_INTRO = "No media server is connected, so Youtarr can't check your libraries. Libraries you set up "
  + 'by hand keep working; connecting Plex, Jellyfin or Emby lets Youtarr check them.';
const MAIN_TV_INTRO = 'Everything here is saved as TV shows: one TV library per server, pointed at the downloads folder. '
  + "Youtarr's .plexignore keeps the __subfolders out of a Plex TV library here; Jellyfin and Emby show each __subfolder "
  + 'as an extra show.';
const MAIN_ACTIVE_WITH_TV = 'Channels download straight into the main folder, but you also have TV show folders. A '
  + 'Jellyfin or Emby library on the whole downloads folder keeps your TV libraries empty, and Plex shows the episodes '
  + 'twice. Give these channels a Video folder (Channel Settings > Library folder moves their videos), then point a '
  + 'library at each folder.';
const MAIN_ACTIVE_WITH_SUBFOLDERS = 'Channels download straight into the main folder, and you also use subfolders. That '
  + 'works while every folder uses Videos: one library on the whole downloads folder shows them all. Before you add a TV '
  + 'show folder, give these channels a Video folder.';

export type IntroLink = { kind: 'startTv' } | { kind: 'folder'; folder: string } | { kind: 'channels' };

export interface IntroSpec {
  text: string;
  link?: IntroLink;
  /** Text after a folder link */
  trailing?: string;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** "Plex TV Shows and Jellyfin Shows" */
export function typesList(servers: ServerRef[], layout: LibraryLayout): string {
  return joinNames(servers.map((server) => `${server.name} ${libraryTypeName(server.serverType, layout)}`));
}

/** "a Plex Other Videos and a Jellyfin Movies" */
function typesWithArticles(servers: ServerRef[], layout: LibraryLayout): string {
  return joinNames(servers.map((server) => {
    const text = `${server.name} ${libraryTypeName(server.serverType, layout)}`;
    return `${article(text)} ${text}`;
  }));
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Videos libraries pointed at the downloads folder itself, per server. */
export function wholeFolderLibraries(check: LibraryCheckResponse | null): Array<{ serverName: string; library: LibraryCheckLibrary }> {
  const main = reportFor(check, '');
  if (!main || !check) return [];
  return main.servers.flatMap((report) => report.libraries
    .filter((library) => library.relation === 'exact' && library.type === 'videos')
    .slice(0, 1)
    .map((library) => ({ serverName: check.servers.find((s) => s.serverType === report.serverType)?.name ?? report.serverType, library })));
}

function librariesPhrase(entries: Array<{ serverName: string; library: { name: string } }>): string {
  const names = new Set(entries.map((entry) => entry.library.name));
  if (names.size === 1) return entries[0].library.name;
  return joinNames(entries.map((entry) => `${entry.library.name} (${entry.serverName})`));
}

function firstTvOverlapFolder(folders: LibraryFolder[], check: LibraryCheckResponse | null): string | null {
  const tv = folders.filter((folder) => folder.layout === 'tv' && folder.name);
  const hit = tv.find((folder) => reportFor(check, folder.name)?.servers
    .some((report) => report.issues.some((issue) => isOverlapIssue(issue.code))));
  return hit ? hit.name : null;
}

export function inspectorIntro({ folder, folders, check, servers }: {
  folder: LibraryFolder; folders: LibraryFolder[]; check: LibraryCheckResponse | null; servers: ServerRef[];
}): IntroSpec | null {
  if (servers.length === 0) return { text: NO_SERVERS_INTRO };
  const state = folderState(folder);
  const tvExists = folders.some((entry) => entry.layout === 'tv');
  const label = folderLabel(folder.name, true);
  if (!folder.name) {
    if (folder.layout === 'tv') return { text: MAIN_TV_INTRO };
    const whole = wholeFolderLibraries(check);
    const count = folder.fileCount ?? 0;
    const unit = units(folder.layout);
    const subfolderActive = folders.some((entry) => entry.name && folderState(entry) === 'active');
    if (state === 'active' && !subfolderActive) {
      return { text: `Everything downloads here. ${capitalize(typesWithArticles(servers, 'videos'))} library on the downloads folder shows it.` };
    }
    if (state === 'active' && tvExists) return { text: MAIN_ACTIVE_WITH_TV, link: { kind: 'channels' } };
    if (state === 'active') return { text: MAIN_ACTIVE_WITH_SUBFOLDERS, link: { kind: 'startTv' } };
    if (whole.length > 0 && !tvExists) {
      const held = count > 0 ? ` It also shows the ${countOf(count, unit.one, unit.many)} still in the main folder.` : '';
      return { text: `${librariesPhrase(whole)} shows your whole downloads folder, including every subfolder. That works while every folder uses Videos.${held}` };
    }
    if (whole.length > 0) {
      const target = firstTvOverlapFolder(folders, check);
      const text = `${librariesPhrase(whole)} shows your whole downloads folder. Now that you have TV show folders, point it at your Video folders instead`;
      return target ? { text: `${text}: see the fix on `, link: { kind: 'folder', folder: target }, trailing: '.' } : { text: `${text}.` };
    }
    if (state === 'holdsVideos') {
      return {
        text: `No library shows the ${count > 0 ? countOf(count, unit.one, unit.many) : 'files'} still in the main folder. To watch them, give their `
          + 'channels a Video folder (Channel Settings > Library folder moves their videos), or point a library at the whole '
          + 'downloads folder while every folder uses Videos.',
      };
    }
    return { text: 'Nothing is saved in the main folder itself, so it needs no library of its own while you use subfolders.' };
  }
  if (state === 'unused') {
    return { text: `Nothing downloads here yet. Once something does, ${folder.layout === 'tv' ? 'a TV' : 'a movie-style'} library on each server should show ${label}.` };
  }
  if (folder.layout === 'tv') {
    return { text: `TV show folders need their own ${typesList(servers, 'tv')} library, pointed at ${label} itself. A library on a parent folder doesn't count on Jellyfin and Emby.` };
  }
  const report = reportFor(check, folder.name);
  const holding = (report?.servers ?? []).filter((entry) => entry.status === 'ok' || entry.status === 'warning');
  const throughWhole = holding.length > 0 && holding.every((entry) => {
    const holders = holdingLibraries(entry);
    return holders.length > 0 && holders.every((library) => library.relation === 'covers');
  });
  if (throughWhole) {
    const entries = holding.map((entry) => ({
      serverName: check?.servers.find((s) => s.serverType === entry.serverType)?.name ?? entry.serverType,
      library: holdingLibraries(entry)[0],
    }));
    return { text: `Shown by ${librariesPhrase(entries)}, which is pointed at the whole downloads folder.` };
  }
  return null;
}

export function libraryTypeLabel(serverType: MediaServerType, type: LibraryCheckLibrary['type']): string {
  switch (type) {
    case 'tv': return LIBRARY_TYPE_NAMES[serverType].tv;
    case 'videos': return serverType === 'plex' ? 'Movies or Other Videos' : 'Movies';
    case 'mixed': return 'Mixed';
    case 'music': return 'Music';
    default: return 'Other';
  }
}

/** The card header's library list: the library name, its type and "whole downloads folder", joined with the middle-dot separator. */
export function holdersText(serverType: MediaServerType, report: LibraryCheckServerReport): string {
  return holdingLibraries(report)
    .map((library) => [library.name, libraryTypeLabel(serverType, library.type), library.relation === 'covers' ? 'whole downloads folder' : null]
      .filter(Boolean).join(SEP))
    .join(', ');
}

export function statusDescription(status: ServerStatus): string {
  if (status.display !== 'ok' || !status.report) return `${status.name}: ${status.word}${status.word.endsWith('.') ? '' : '.'}`;
  const holder = holdingLibraries(status.report)[0];
  if (!holder) return `${status.name}: OK.`;
  return holder.relation === 'covers'
    ? `${status.name}: OK, shown by ${holder.name} through the whole downloads folder.`
    : `${status.name}: OK, ${holder.name}.`;
}

export function issueHint(code: string, serverName: string, libraryName: string, layout: LibraryLayout): string | null {
  switch (code) {
    case 'plexSeriesAgent':
    case 'plexLegacyAgent':
      return `In Plex: edit ${libraryName}, then Advanced, then Agent.`;
    case 'nfoSaver':
      return `In ${serverName}: Dashboard, Libraries, ${libraryName}, Metadata savers.`;
    case 'onlineFetchers':
      return `In ${serverName}: Dashboard, Libraries, ${libraryName}, Metadata downloaders and Image fetchers.`;
    case 'overlapTv':
      return layout === 'videos' ? `Point ${libraryName} at your TV show folders only.` : null;
    default:
      return null;
  }
}

export function noLibraryLine(server: ServerRef, folder: LibraryFolder): string {
  return `No ${server.name} ${libraryTypeName(server.serverType, folder.layout)} library holds ${folderLabel(folder.name, true)}.`;
}

export function footerNote(folder: LibraryFolder, servers: ServerRef[]): string {
  const missing = SERVER_ORDER.filter((type) => !servers.some((server) => server.serverType === type)).map((type) => SERVER_NAMES[type]);
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`${joinNames(missing)} ${missing.length === 1 ? "isn't" : "aren't"} connected.`);
  if (!folder.name) parts.push("Kodi isn't checked.");
  else if (folder.layout === 'tv') parts.push(`Kodi isn't checked: add __${folder.name} as a TV shows source set to Local information only.`);
  else parts.push(`Kodi isn't checked: add __${folder.name} as a Movies source.`);
  return parts.join(' ');
}

export function afterwardsLine(server: ServerRef, report: LibraryCheckServerReport | null, { target, label }: { target: LibraryLayout; label: string }): string {
  const type = libraryTypeName(server.serverType, target);
  if (!report || report.status === 'unreachable') return `${server.name}: couldn't be checked. It needs a ${type} library on ${label}.`;
  if (report.status === 'ok') return `${server.name}: ${holdingLibraries(report)[0]?.name ?? 'its library'} already fits.`;
  if (report.status === 'missing') return `${server.name}: needs a ${type} library on ${label}.`;
  return `${server.name}: ${report.issues.map((issue) => issue.message).join(' ')}`;
}

export function afterwardsWithoutServers(target: LibraryLayout): string {
  return `Afterwards its media server libraries must be the ${layoutName(target)} type.`;
}

/** The check status line (UI 4.6); a partial check never reads as full success. */
export function checkStatusText(status: CheckStatus, servers: ServerRef[], now: number, timeZone: string | null): string {
  if (status.kind === 'none' || servers.length === 0) return 'No media server connected.';
  if (status.running) return `Checking ${joinNames(servers.map((server) => server.name))}...`;
  const when = status.lastCheckedAt !== null ? timeAgo(status.lastCheckedAt, now, timeZone) : null;
  switch (status.kind) {
    case 'full':
      return `Checked ${joinNames(status.checked)}${when ? ` ${when}` : ''}`;
    case 'partial':
      return [`Checked ${joinNames(status.checked)}${when ? ` ${when}` : ''}.`,
        ...status.unreachable.map((server) => `${server.name} couldn't be reached.`)].join(' ');
    case 'unreachable':
      return `Not checked: ${joinNames(status.unreachable.map((server) => server.name), 'or')} couldn't be reached.`;
    case 'failed':
      return status.hasEarlierResults && when ? `Last checked ${when}. The latest check failed.` : 'Not checked';
    default:
      return 'Not checked';
  }
}
