import type { LibraryFolder, LibraryLayout } from '../../types/tvShows';
import type { LibraryCheckLibrary, LibraryCheckResponse, MediaServerType } from '../../types/libraryCheck';
import { SERVER_NAMES, SERVER_ORDER, ServerRef, folderState, reportFor } from '../../utils/libraryAttention';
import { folderKey } from '../../utils/libraryLayouts';
import { countOf, folderLabel } from './folderText';
import { LIBRARY_TYPE_NAMES, ServerPath, SetupServer, folderServerPath, libraryTypeName } from './libraryTypes';

/**
 * The Start using TV shows panel (UI 7.6): the setup detected from folder
 * usage and the library check, the migration paths that apply (A: add a TV
 * folder, B: the whole downloads folder as TV, C: turn a Video folder into a
 * TV folder), and each path's steps in Youtarr and on each server.
 */

export const WATCH_STATE_FIRST = 'Videos Youtarr moves get their played state and resume position back once the new '
  + 'library has scanned them (every Jellyfin and Emby user, the Plex owner).';
/** Second sentence, from the Phase 2 verification (Task 2.0 decision rules, REBUILD_NOTE). */
export const WATCH_STATE_REBUILD = "A library you remove and create again starts over: played state and resume positions in it aren't restored.";
export const FULL_GUIDE_URL = 'https://dialmasterorg.github.io/Youtarr/docs/usage-guide/#move-an-existing-setup-to-tv-shows';

export type SetupKind = 'whole' | 'perFolder' | 'none' | 'unchecked';

export interface ServerSetup extends ServerRef {
  kind: SetupKind;
  whole: LibraryCheckLibrary | null;
  libraries: string[];
  downloadsPath: string | null;
  /** folderKey -> the library pointed at that folder itself on this server */
  folderLibraries: Record<string, string>;
}

export interface DetectedSetup {
  main: LibraryFolder | null;
  /** Videos subfolders that are Active or hold videos */
  videoFolders: LibraryFolder[];
  /** Every Videos subfolder, active and holding first (path C's select) */
  videoSubfolders: LibraryFolder[];
  tvFolders: LibraryFolder[];
  mainChannels: number;
  hasVideosContent: boolean;
  servers: ServerSetup[];
}

const inUse = (folder: LibraryFolder): boolean => ['active', 'holdsVideos'].includes(folderState(folder));
const byLabel = (a: LibraryFolder, b: LibraryFolder): number => a.name.localeCompare(b.name);

export function detectSetup(folders: LibraryFolder[], check: LibraryCheckResponse | null, servers: ServerRef[]): DetectedSetup {
  const main = folders.find((folder) => !folder.name) ?? null;
  const videoSubfolders = folders.filter((folder) => folder.name && folder.layout === 'videos');
  const mainReport = reportFor(check, '');
  return {
    main,
    videoFolders: videoSubfolders.filter(inUse).sort(byLabel),
    videoSubfolders: [...videoSubfolders.filter(inUse).sort(byLabel), ...videoSubfolders.filter((f) => !inUse(f)).sort(byLabel)],
    tvFolders: folders.filter((folder) => folder.layout === 'tv').sort(byLabel),
    mainChannels: main && main.layout === 'videos' ? main.channels : 0,
    hasVideosContent: folders.some((folder) => folder.layout === 'videos' && inUse(folder)),
    servers: servers.map((server): ServerSetup => {
      const checkServer = check?.servers.find((entry) => entry.serverType === server.serverType);
      const folderLibraries: Record<string, string> = {};
      for (const report of check?.folders ?? []) {
        const exact = report.servers.find((entry) => entry.serverType === server.serverType)
          ?.libraries.find((library) => library.relation === 'exact');
        if (exact) folderLibraries[folderKey(report.name)] = exact.name;
      }
      const base = { ...server, downloadsPath: checkServer?.downloadsPath ?? null, folderLibraries };
      const mainEntry = mainReport?.servers.find((entry) => entry.serverType === server.serverType);
      if (!checkServer || !checkServer.reachable || !mainEntry) return { ...base, kind: 'unchecked', whole: null, libraries: [] };
      const whole = mainEntry.libraries.find((library) => library.relation === 'exact' && library.type === 'videos') ?? null;
      if (whole) return { ...base, kind: 'whole', whole, libraries: [whole.name] };
      const libraries = [...new Set(Object.values(folderLibraries))];
      return { ...base, kind: libraries.length > 0 ? 'perFolder' : 'none', whole: null, libraries };
    }),
  };
}

export function setupLines(setup: DetectedSetup): string[] {
  const lines: string[] = [];
  if (setup.videoFolders.length === 0 && setup.main && folderState(setup.main) === 'active') {
    lines.push('Everything downloads into the main folder.');
  } else if (setup.videoFolders.length > 0) {
    lines.push(`${countOf(setup.videoFolders.length, 'Video folder', 'Video folders')} in use: ${setup.videoFolders.map((f) => folderLabel(f.name)).join(', ')}.`);
  }
  if (setup.tvFolders.length > 0) {
    lines.push(`${countOf(setup.tvFolders.length, 'TV show folder', 'TV show folders')}: ${setup.tvFolders.map((f) => folderLabel(f.name)).join(', ')}.`);
  }
  if (setup.mainChannels > 0) {
    lines.push(`${countOf(setup.mainChannels, 'channel downloads', 'channels download')} straight into the main folder.`);
  }
  if (setup.servers.length === 0) {
    lines.push("No media server is connected, so Youtarr can't see your libraries. The steps cover each kind of setup.");
  }
  for (const server of setup.servers) {
    if (server.kind === 'whole' && server.whole) {
      lines.push(`${server.name}: ${server.whole.name} (${libraryTypeName(server.serverType, 'videos')}) shows your whole downloads folder.`);
    } else if (server.kind === 'perFolder') {
      lines.push(`${server.name}: a library per folder (${server.libraries.join(', ')}).`);
    } else if (server.kind === 'none') {
      lines.push(`${server.name}: no library found for your folders.`);
    } else {
      lines.push(`${server.name}: not checked.`);
    }
  }
  return lines;
}

export type PathKey = 'A' | 'B' | 'C';

export interface PathOption {
  key: PathKey;
  title: string;
  description: string;
  recommended: boolean;
  disabledReason: string | null;
  note: string | null;
}

export function pathOptions(setup: DetectedSetup, servers: ServerRef[]): PathOption[] {
  const options: PathOption[] = [{
    key: 'A',
    title: 'Add a TV show folder next to your Video folders',
    description: 'Your Video folders stay as they are. The new folder gets its own TV library.',
    recommended: setup.hasVideosContent,
    disabledReason: null,
    note: null,
  }];
  if (!setup.main || setup.main.layout === 'videos') {
    const onlyPlex = servers.length === 1 && servers[0].serverType === 'plex';
    const blocked = setup.videoFolders.length > 0 && !onlyPlex;
    options.push({
      key: 'B',
      title: 'Make the whole downloads folder TV shows',
      description: 'Every channel becomes a show; one TV library shows the downloads folder.',
      recommended: false,
      disabledReason: blocked
        ? `You use Video folders (${setup.videoFolders.map((f) => folderLabel(f.name)).join(', ')}): Jellyfin and Emby would show each one as an extra show.`
        : null,
      note: setup.videoFolders.length > 0 && onlyPlex ? "Plex skips the __subfolders; Jellyfin and Emby wouldn't." : null,
    });
  }
  if (setup.videoSubfolders.length > 0) {
    options.push({
      key: 'C',
      title: 'Turn a Video folder into a TV show folder',
      description: 'Its channels become shows and their videos move; you review every move first.',
      recommended: false,
      disabledReason: null,
      note: null,
    });
  }
  return options;
}

export type YoutarrAction = { kind: 'addTvFolder' } | { kind: 'mainFolderTv' } | { kind: 'openFolder'; folder: string };

export interface YoutarrStep {
  text: string;
  action?: YoutarrAction;
  actionLabel?: string;
  /** List the channels saved in the main folder under this step */
  channelLinks?: boolean;
}

export interface ServerStep {
  text: string;
  paths?: ServerPath[];
  after?: string;
  /** Show the new library's settings (behind a disclosure) */
  setup?: { layout: LibraryLayout; path: ServerPath };
}

export interface ServerStepGroup {
  serverType: SetupServer;
  name: string;
  steps: ServerStep[];
}

export interface PathSteps {
  youtarr: YoutarrStep[];
  servers: ServerStepGroup[];
}

function groupsFor(setup: DetectedSetup): ServerSetup[] {
  if (setup.servers.length > 0) return setup.servers;
  return SERVER_ORDER.map((serverType: MediaServerType) => ({
    serverType, name: SERVER_NAMES[serverType], kind: 'unchecked' as const, whole: null, libraries: [], downloadsPath: null,
    folderLibraries: {},
  }));
}

const newTvFolderPath = (server: ServerSetup): ServerPath => ({ text: `the new TV show folder, as ${server.name} sees it`, copyable: false });

export function pathSteps(key: PathKey, setup: DetectedSetup, { folder }: { folder?: string }): PathSteps {
  const tvType = (server: ServerSetup): string => LIBRARY_TYPE_NAMES[server.serverType].tv;
  const movieType = (server: ServerSetup): string => LIBRARY_TYPE_NAMES[server.serverType].videos;
  const anyWhole = setup.servers.some((server) => server.kind === 'whole');
  if (key === 'A') {
    const youtarr: YoutarrStep[] = [];
    if (setup.mainChannels > 0 && anyWhole) {
      youtarr.push({
        text: `Give the ${countOf(setup.mainChannels, 'channel', 'channels')} in the main folder a Video folder (Channel Settings > Library folder moves their videos).`,
        channelLinks: true,
      });
    }
    youtarr.push({ text: 'Add a TV show folder.', action: { kind: 'addTvFolder' }, actionLabel: 'Add TV folder' });
    youtarr.push({
      text: 'Switch the channels you want as shows to it: Channel Settings > Library folder, or TV Show > Show this channel as TV show. Each switch shows its moves first.',
    });
    return {
      youtarr,
      servers: groupsFor(setup).map((server) => {
        const addTv: ServerStep = {
          text: `Add a ${tvType(server)} library pointed at the new TV show folder only.`,
          setup: { layout: 'tv', path: newTvFolderPath(server) },
        };
        if (server.kind === 'whole' && server.whole) {
          const paths = setup.videoFolders.map((videoFolder) => folderServerPath(videoFolder.name, server.downloadsPath, server.name));
          return {
            serverType: server.serverType, name: server.name, steps: [
              paths.length > 0
                ? { text: `Edit ${server.whole.name}: remove ${server.whole.location} and add your Video folders:`, paths, after: 'It keeps its type.' }
                : { text: `Edit ${server.whole.name}: remove ${server.whole.location} and add your Video folders instead. It keeps its type.` },
              addTv,
            ],
          };
        }
        const steps = [addTv];
        if (server.kind === 'none') steps.push({ text: `Your Video folders need a ${movieType(server)} library too.` });
        return { serverType: server.serverType, name: server.name, steps };
      }),
    };
  }
  if (key === 'B') {
    return {
      youtarr: [{
        text: 'Use the main folder for TV shows. You confirm, then review every move.',
        action: { kind: 'mainFolderTv' }, actionLabel: 'Use the main folder for TV shows',
      }],
      servers: groupsFor(setup).map((server) => {
        const path = folderServerPath('', server.downloadsPath, server.name);
        return {
          serverType: server.serverType, name: server.name, steps: [server.kind === 'whole' && server.whole
            ? {
              text: `${server.name} can't change a library's type: remove ${server.whole.name} and create a ${tvType(server)} library pointed at ${server.whole.location}.`,
              setup: { layout: 'tv', path: { text: server.whole.location, copyable: true } },
            }
            : { text: `Create a ${tvType(server)} library pointed at the downloads folder.`, setup: { layout: 'tv', path } }],
        };
      }),
    };
  }
  const chosen = folder ?? setup.videoSubfolders[0]?.name ?? '';
  return {
    youtarr: [{
      text: `Open ${folderLabel(chosen)} and choose Move to TV shows. You review every move first.`,
      action: { kind: 'openFolder', folder: chosen }, actionLabel: `Open ${folderLabel(chosen)}`,
    }],
    servers: groupsFor(setup).map((server) => {
      const folderPath = folderServerPath(chosen, server.downloadsPath, server.name);
      const own = server.folderLibraries[folderKey(chosen)] ?? null;
      if (server.kind === 'whole' && server.whole) {
        const others = setup.videoFolders.filter((entry) => folderKey(entry.name) !== folderKey(chosen))
          .map((entry) => folderServerPath(entry.name, server.downloadsPath, server.name));
        const addTv = `Then add a ${tvType(server)} library pointed at ${folderPath.text} only.`;
        return {
          serverType: server.serverType, name: server.name, steps: [others.length > 0
            ? {
              text: `Edit ${server.whole.name}: remove ${server.whole.location} and add your other Video folders:`,
              paths: others,
              after: addTv,
              setup: { layout: 'tv', path: folderPath },
            }
            : {
              text: `Remove ${server.whole.name}: no other Video folder is in use.`,
              after: addTv,
              setup: { layout: 'tv', path: folderPath },
            }],
        };
      }
      if (own) {
        return {
          serverType: server.serverType, name: server.name, steps: [{
            text: `${server.name} can't change a library's type: remove ${own} and create a ${tvType(server)} library pointed at ${folderPath.text}.`,
            setup: { layout: 'tv', path: folderPath },
          }],
        };
      }
      return {
        serverType: server.serverType, name: server.name,
        steps: [{ text: `Create a ${tvType(server)} library pointed at ${folderPath.text}.`, setup: { layout: 'tv', path: folderPath } }],
      };
    }),
  };
}
