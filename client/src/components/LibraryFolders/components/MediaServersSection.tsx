import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { Loader2, RefreshCw } from '../../../lib/icons';
import type { LibraryFolder } from '../../../types/tvShows';
import { useNow } from '../../Configuration/hooks/useNow';
import { ServerStatus, serverStatuses, timeAgo } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { SETUP_SERVER_NAMES, folderServerPath } from '../libraryTypes';
import { footerNote, inspectorIntro } from '../mediaServerText';
import { MOVE_MAIN_FOLDER_LABEL } from '../tvSetupPaths';
import { folderLabel } from '../folderText';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { InfoPopover } from './InfoPopover';
import { SectionHeading } from './SectionHeading';
import { ServerCard } from './ServerCard';
import { ServerRow } from './ServerRow';
import { rendersAsRow } from './serverCardRules';
import { SetupBox } from './SetupBox';

const SETTINGS_LINKS = [
  { to: '/settings/plex', label: 'Plex settings' },
  { to: '/settings/jellyfin', label: 'Jellyfin settings' },
  { to: '/settings/emby', label: 'Emby settings' },
];
const ALL_SERVERS = ['plex', 'jellyfin', 'emby', 'kodi'] as const;

/** Servers with nothing to fix share one box, a line each; a server with a problem gets its card. */
function groupStatuses(statuses: ServerStatus[]): Array<ServerStatus[] | ServerStatus> {
  const groups: Array<ServerStatus[] | ServerStatus> = [];
  statuses.forEach((status) => {
    const last = groups[groups.length - 1];
    if (!rendersAsRow(status)) groups.push(status);
    else if (Array.isArray(last)) last.push(status);
    else groups.push([status]);
  });
  return groups;
}

/** The inspector's first section (UI 5.7.2). */
export function MediaServersSection({ folder }: { folder: LibraryFolder }) {
  const page = useLibraryPage();
  const headingId = useId();
  const now = useNow();
  const statuses = serverStatuses(folder, page.check, page.configuredServers);
  const intro = inspectorIntro({ folder, folders: page.folders, check: page.check.data, servers: page.servers });
  const downloadsPathOf = (serverType: string) => page.check.data?.servers.find((server) => server.serverType === serverType)?.downloadsPath ?? null;
  const checked = page.check.loading ? 'Checking...'
    : page.check.lastCheckedAt !== null ? `Checked ${timeAgo(page.check.lastCheckedAt, now, page.timeZone)}` : 'Not checked';
  const introLink = cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center');
  // An intro with a next step stays in view; one that only explains joins the info button.
  const introShown = Boolean(intro && (intro.link || page.servers.length === 0));
  const checking = page.check.loading;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 px-4 pb-4 pt-3.5">
      <div className="flex items-center gap-1">
        <SectionHeading id={headingId}>Media servers</SectionHeading>
        {page.serversKnown && (
          <InfoPopover label={`About media servers for ${folderLabel(folder.name, true)}`}>
            {intro && !introShown && <p>{intro.text}</p>}
            <p>{footerNote(folder, page.servers)}</p>
          </InfoPopover>
        )}
        <span className="flex-1" />
        {page.servers.length > 0 && (
          <button type="button" title={checked} disabled={checking} onClick={() => { void page.check.refetch(); }}
            aria-label={checking ? 'Checking media servers...' : 'Check media servers again'}
            className={cn('inline-flex shrink-0 items-center justify-center rounded-ui border border-border text-muted-foreground',
              'hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-60', page.phone ? 'h-11 w-11' : 'h-7 w-7')}>
            {checking ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <RefreshCw size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
      {/* The page header says when the servers were checked; a detail screen has no page header. */}
      {!page.twoColumn && <p className="-mt-1 text-xs text-muted-foreground">{checked}</p>}
      {page.serversKnown && introShown && intro && (
        <div className="text-[13px] text-muted-foreground">
          {intro.text}
          {intro.link?.kind === 'startTv' && <> <button type="button" onClick={page.openStartTv} className={introLink}>Start using TV shows</button></>}
          {intro.link?.kind === 'folder' && (
            <><button type="button" onClick={() => page.selectFolder((intro.link as { folder: string }).folder)} className={introLink}>
              {libraryFolderLabel((intro.link as { folder: string }).folder)}
            </button>{intro.trailing}</>
          )}
          {intro.link?.kind === 'moveMain' && (
            <> <button type="button" onClick={() => page.reviewChange({ type: 'mainFolderMove' }, { kind: 'default', folder: '' })} className={introLink}>
              {MOVE_MAIN_FOLDER_LABEL}
            </button></>
          )}
        </div>
      )}
      {!page.serversKnown ? null : page.servers.length === 0 ? (
        <>
          <p className="flex flex-wrap gap-x-3 text-[13px]">
            {SETTINGS_LINKS.map((link) => <Link key={link.to} to={link.to} className={cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center')}>{link.label}</Link>)}
          </p>
          {ALL_SERVERS.map((server) => (
            <SetupBox key={server} server={server} layout={folder.layout} showCheckAgain={false}
              path={folderServerPath(folder.name, null, SETUP_SERVER_NAMES[server])} />
          ))}
        </>
      ) : (
        groupStatuses(statuses).map((group) => (Array.isArray(group) ? (
          <div key={group.map((status) => status.serverType).join()} className="divide-y divide-border rounded-ui border border-border bg-background">
            {group.map((status) => <ServerRow key={status.serverType} folder={folder} status={status} />)}
          </div>
        ) : (
          <ServerCard key={group.serverType} folder={folder} status={group} downloadsPath={downloadsPathOf(group.serverType)} />
        )))
      )}
    </section>
  );
}
