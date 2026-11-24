import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Download, Link as IntegrationsIcon, RefreshCw, Server, Settings as SettingsIcon } from '../../lib/icons';
import { useContainerWidth } from '../../hooks/useContainerWidth';

export type SettingsGroupKey = 'downloads' | 'servers' | 'automation' | 'integrations' | 'system';

export interface SettingsPage {
  /** Route segment under /settings */
  key: string;
  /** Index row title and page title */
  title: string;
  description: string;
  group: SettingsGroupKey;
}

export const SETTINGS_GROUPS: Array<{ key: SettingsGroupKey; title: string; description: string; Icon: LucideIcon }> = [
  { key: 'downloads', title: 'Downloads & library', description: 'What Youtarr downloads and where the files go.', Icon: Download },
  { key: 'servers', title: 'Media servers', description: 'Connections for library refreshes, playlists and watch status.', Icon: Server },
  { key: 'automation', title: 'Automation & storage', description: 'Schedules, cleanup and disk space.', Icon: RefreshCw },
  { key: 'integrations', title: 'Integrations', description: 'Other apps and services that work with Youtarr.', Icon: IntegrationsIcon },
  { key: 'system', title: 'System', description: 'Appearance, access and troubleshooting.', Icon: SettingsIcon },
];

/**
 * Order of the index rows and of the nav menus (sidebar, top-nav dropdown).
 * Keep each group's pages together, in SETTINGS_GROUPS order: the nav menus
 * print a group heading wherever the group changes.
 */
export const SETTINGS_PAGES: SettingsPage[] = [
  { key: 'core', title: 'Core', group: 'downloads', description: 'Downloads folder, quality, defaults, and core behavior.' },
  { key: 'downloading', title: 'YT-DLP', group: 'downloads', description: 'yt-dlp backend settings for downloads and reliability.' },
  { key: 'cookies', title: 'Cookies', group: 'downloads', description: 'Cookie configuration and login helpers.' },
  { key: 'sponsorblock', title: 'SponsorBlock', group: 'downloads', description: 'Skip segments and SponsorBlock settings.' },
  { key: 'youtube-api', title: 'YouTube API', group: 'downloads', description: 'Optional YouTube Data API v3 key for faster metadata fetches.' },
  { key: 'plex', title: 'Plex', group: 'servers', description: 'Plex integration and library configuration.' },
  { key: 'jellyfin', title: 'Jellyfin', group: 'servers', description: 'Jellyfin connection for library refreshes, native playlists and watch status.' },
  { key: 'emby', title: 'Emby', group: 'servers', description: 'Emby connection for library refreshes, native playlists and watch status.' },
  { key: 'watch-status', title: 'Watch Status', group: 'servers', description: 'Sync watched state from your media servers into Youtarr.' },
  { key: 'scheduling', title: 'Scheduling', group: 'automation', description: 'Choose when automatic downloads and maintenance tasks run.' },
  { key: 'autoremove', title: 'Auto Removal', group: 'automation', description: 'Automated cleanup and retention policies.' },
  { key: 'storage-limits', title: 'Storage Limits', group: 'automation', description: 'Pause downloads when storage is full or over a size limit.' },
  { key: 'maintenance', title: 'Maintenance & Rescan', group: 'automation', description: 'Rescan files on disk and other maintenance actions.' },
  { key: 'api-keys', title: 'API Keys & Bookmarklet', group: 'integrations', description: 'One-click "Send to Youtarr" bookmarklet, phone shortcuts, and keys for dashboards and external apps.' },
  { key: 'notifications', title: 'Notifications', group: 'integrations', description: 'Toast notifications and alert behavior.' },
  { key: 'rss-feeds', title: 'RSS Feeds', group: 'integrations', description: 'A private RSS feed of your downloaded videos.' },
  { key: 'sonarr-radarr', title: 'Sonarr / Radarr', group: 'integrations', description: 'Let Sonarr and Radarr search and grab YouTube videos through Youtarr.' },
  { key: 'appearance', title: 'Appearance', group: 'system', description: 'Theme, animations, and visual preferences.' },
  { key: 'logging', title: 'Logging', group: 'system', description: 'Log level and log files for troubleshooting.' },
  { key: 'security', title: 'Account Security', group: 'system', description: 'Authentication and password management.' },
  { key: 'about', title: 'About', group: 'system', description: 'Version, project background, and ways to support Youtarr.' },
];

const TWO_COLUMN_MIN_WIDTH = 720;
const LEFT: SettingsGroupKey[] = ['downloads', 'automation'];
const RIGHT: SettingsGroupKey[] = ['servers', 'integrations', 'system'];
const STACKED: SettingsGroupKey[] = ['downloads', 'servers', 'automation', 'integrations', 'system'];

function Group({ groupKey }: { groupKey: SettingsGroupKey }) {
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
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-foreground" />
            </RouterLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** /settings: pages grouped as list cards. */
export function SettingsIndex() {
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const columns = width !== null && width >= TWO_COLUMN_MIN_WIDTH;
  return (
    <div ref={measureRef}>
      {columns ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <div className="flex flex-col gap-8">{LEFT.map((key) => <Group key={key} groupKey={key} />)}</div>
          <div className="flex flex-col gap-8">{RIGHT.map((key) => <Group key={key} groupKey={key} />)}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {STACKED.map((key) => <Group key={key} groupKey={key} />)}
        </div>
      )}
    </div>
  );
}
