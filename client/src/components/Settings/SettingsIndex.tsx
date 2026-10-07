import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LIBRARY_FOLDERS_PATH } from '../../utils/libraryLayouts';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ChevronRight, Download, Film, Folder, Library, RefreshCw, Server, Settings as SettingsIcon, Tv } from '../../lib/icons';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { useLibraryFolders } from '../../hooks/useLibraryFolders';
import { LayoutChip } from '../shared/LayoutChip';

export type SettingsGroupKey = 'downloads' | 'servers' | 'automation' | 'system';

export interface SettingsPage {
  /** Route segment under /settings */
  key: string;
  /** Index row title and page title */
  title: string;
  description: string;
  group: SettingsGroupKey;
  /** Shorter label for the tab strip and sidebar sub-items */
  navLabel?: string;
}

export const SETTINGS_GROUPS: Array<{ key: SettingsGroupKey; title: string; description: string; Icon: LucideIcon }> = [
  { key: 'downloads', title: 'Downloads & library', description: 'What Youtarr downloads and where the files go.', Icon: Download },
  { key: 'servers', title: 'Media servers', description: 'Connections for library checks, refreshes, playlists and watch status.', Icon: Server },
  { key: 'automation', title: 'Automation & storage', description: 'Schedules, cleanup and disk space.', Icon: RefreshCw },
  { key: 'system', title: 'System', description: 'Notifications, access and troubleshooting.', Icon: SettingsIcon },
];

/** Nav order (tab strip, sidebar): today's order with library after core. The index groups by `group`. */
export const SETTINGS_PAGES: SettingsPage[] = [
  { key: 'scheduling', title: 'Scheduling', group: 'automation', description: 'Choose when automatic downloads and maintenance tasks run.' },
  { key: 'core', title: 'Core', group: 'downloads', description: 'Automatic downloads, quality, subtitles, metadata and naming.' },
  { key: 'library', title: 'Library folders', navLabel: 'Library', group: 'downloads', description: 'Folders, their Videos or TV shows layout, and the media server library for each.' },
  { key: 'downloading', title: 'YT-DLP', group: 'downloads', description: 'yt-dlp backend settings for downloads and reliability.' },
  { key: 'api-keys', title: 'API Keys', group: 'system', description: 'API key settings and rate limits.' },
  { key: 'appearance', title: 'Appearance', group: 'system', description: 'Theme, animations, and visual preferences.' },
  { key: 'autoremove', title: 'Auto Removal', group: 'automation', description: 'Automated cleanup and retention policies.' },
  { key: 'storage-limits', title: 'Storage Limits', group: 'automation', description: 'Pause downloads when storage is full or over a size limit.' },
  { key: 'cookies', title: 'Cookies', group: 'downloads', description: 'Cookie configuration and login helpers.' },
  { key: 'maintenance', title: 'Maintenance & Rescan', group: 'automation', description: 'Rescan files on disk and other maintenance actions.' },
  { key: 'logging', title: 'Logging', group: 'system', description: 'Log level and log files for troubleshooting.' },
  { key: 'notifications', title: 'Notifications', group: 'system', description: 'Toast notifications and alert behavior.' },
  { key: 'plex', title: 'Plex', group: 'servers', description: 'Plex connection, default library and playlist visibility.' },
  { key: 'jellyfin', title: 'Jellyfin', group: 'servers', description: 'Jellyfin connection for native playlist sync.' },
  { key: 'emby', title: 'Emby', group: 'servers', description: 'Emby connection for native playlist sync.' },
  { key: 'watch-status', title: 'Watch Status', group: 'servers', description: 'Sync watched state from your media servers into Youtarr.' },
  { key: 'security', title: 'Account Security', group: 'system', description: 'Authentication and password management.' },
  { key: 'sponsorblock', title: 'SponsorBlock', group: 'downloads', description: 'Skip segments and SponsorBlock settings.' },
  { key: 'youtube-api', title: 'YouTube API', group: 'downloads', description: 'Optional YouTube Data API v3 key for faster metadata fetches.' },
];

const TWO_COLUMN_MIN_WIDTH = 720;
const LEFT: SettingsGroupKey[] = ['downloads', 'automation'];
const RIGHT: SettingsGroupKey[] = ['servers', 'system'];
const STACKED: SettingsGroupKey[] = ['downloads', 'servers', 'automation', 'system'];
const HELP_STEPS = [
  'Keep different kinds of content in their own library folders, like __Kids or __TV Shows.',
  'Set each folder to Videos or TV shows, and show it in a library of the matching type. One library on the whole downloads folder works while every folder uses Videos.',
  'Choose a folder for each channel, or let it use the default folder.',
];

function LibraryRowStatus({ token }: { token: string | null }) {
  const { folders, loading, loaded, error } = useLibraryFolders(token);
  if (error) return null;
  if (!loaded || (loading && folders.length === 0)) return <span className="mt-2 block h-5 w-40 animate-pulse rounded bg-muted" />;
  if (folders.length === 1) return <span className="mt-2 flex items-center gap-1.5 text-xs">Main folder only <LayoutChip layout={folders[0].layout} /></span>;
  const videos = folders.filter((folder) => folder.layout === 'videos').length;
  const tv = folders.length - videos;
  return (
    <span className="mt-2 flex flex-wrap gap-x-3 text-xs leading-5">
      <span className="inline-flex items-center gap-1"><Folder size={12} aria-hidden="true" />{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</span>
      <span className="inline-flex items-center gap-1"><Film size={12} aria-hidden="true" />{videos} Videos {videos === 1 ? 'folder' : 'folders'}</span>
      <span className="inline-flex items-center gap-1 text-info"><Tv size={12} aria-hidden="true" />{tv} TV {tv === 1 ? 'folder' : 'folders'}</span>
    </span>
  );
}

function Group({ groupKey, token }: { groupKey: SettingsGroupKey; token: string | null }) {
  const group = SETTINGS_GROUPS.find((entry) => entry.key === groupKey)!;
  const titleId = `settings-group-${groupKey}`;
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="flex items-center gap-2 font-display text-base font-semibold leading-[22px]">
        <group.Icon size={16} aria-hidden="true" className="text-muted-foreground" />{group.title}
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{group.description}</p>
      <ul className="mt-2.5 divide-y divide-border/60 rounded-ui border border-border bg-card">
        {SETTINGS_PAGES.filter((page) => page.group === groupKey).map((page) => (
          <li key={page.key}>
            <RouterLink to={`/settings/${page.key}`} className="group flex min-h-[56px] items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-5">{page.title}</span>
                <span className="mt-0.5 block text-[13px] leading-[19.5px] text-muted-foreground">{page.description}</span>
                {page.key === 'library' && <LibraryRowStatus token={token} />}
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-foreground" />
            </RouterLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HelpCard() {
  return (
    <section aria-labelledby="settings-help-title" className="rounded-ui border border-border bg-card p-4">
      <h2 id="settings-help-title" className="flex items-center gap-2 font-display text-[15px] font-semibold">
        <Library size={16} aria-hidden="true" className="text-primary" />Setting up your library
      </h2>
      <ol className="mt-2 flex flex-col gap-2">
        {HELP_STEPS.map((step, index) => (
          <li key={step} className="flex gap-2 text-[13px] text-muted-foreground">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-ui border border-border text-xs">{index + 1}</span>{step}
          </li>
        ))}
      </ol>
      <RouterLink to={LIBRARY_FOLDERS_PATH} className="mt-3 inline-flex items-center gap-1 text-[13px] text-primary underline max-md:min-h-[44px]">
        Open Library folders<ArrowRight size={14} aria-hidden="true" />
      </RouterLink>
    </section>
  );
}

/** /settings: pages grouped as list cards (Core spec 7). */
export function SettingsIndex({ token }: { token: string | null }) {
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const columns = width !== null && width >= TWO_COLUMN_MIN_WIDTH;
  return (
    <div ref={measureRef}>
      {columns ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <div className="flex flex-col gap-8">{LEFT.map((key) => <Group key={key} groupKey={key} token={token} />)}</div>
          <div className="flex flex-col gap-8">{RIGHT.map((key) => <Group key={key} groupKey={key} token={token} />)}<HelpCard /></div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {STACKED.map((key) => <Group key={key} groupKey={key} token={token} />)}
          <HelpCard />
        </div>
      )}
    </div>
  );
}
