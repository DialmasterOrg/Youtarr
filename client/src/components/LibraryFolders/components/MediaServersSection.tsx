import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { Info } from '../../../lib/icons';
import type { LibraryFolder } from '../../../types/tvShows';
import { useNow } from '../../Configuration/hooks/useNow';
import { serverStatuses, timeAgo } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { followersLine } from '../folderText';
import { SETUP_SERVER_NAMES, folderServerPath } from '../libraryTypes';
import { footerNote, inspectorIntro } from '../mediaServerText';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { ChannelLinks } from './ChannelLinks';
import { PlexRefreshControl } from './PlexRefreshControl';
import { SectionHeading } from './SectionHeading';
import { ServerCard } from './ServerCard';
import { rendersAsLine, showsPlexControl } from './serverCardRules';
import { SetupBox } from './SetupBox';

const SETTINGS_LINKS = [
  { to: '/settings/plex', label: 'Plex settings' },
  { to: '/settings/jellyfin', label: 'Jellyfin settings' },
  { to: '/settings/emby', label: 'Emby settings' },
];
const ALL_SERVERS = ['plex', 'jellyfin', 'emby', 'kodi'] as const;

/** The inspector's first section (UI 5.7.2). */
export function MediaServersSection({ folder }: { folder: LibraryFolder }) {
  const page = useLibraryPage();
  const { mainDetail } = page;
  const headingId = useId();
  const now = useNow();
  const statuses = serverStatuses(folder, page.check, page.configuredServers);
  const intro = inspectorIntro({ folder, folders: page.folders, check: page.check.data, servers: page.servers });
  const followers = mainDetail ? followersLine(mainDetail.followers, mainDetail.channels.length > 0) : null;
  const downloadsPathOf = (serverType: string) => page.check.data?.servers.find((server) => server.serverType === serverType)?.downloadsPath ?? null;
  const checked = page.check.loading ? 'Checking...'
    : page.check.lastCheckedAt !== null ? `Checked ${timeAgo(page.check.lastCheckedAt, now, page.timeZone)}` : 'Not checked';
  const plexStatus = statuses.find((status) => status.serverType === 'plex');
  const plexControl = Boolean(plexStatus && rendersAsLine(plexStatus) && showsPlexControl(folder));
  const introLink = cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center');

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 px-4 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionHeading id={headingId}>Media servers</SectionHeading>
        <span className="text-xs text-muted-foreground">{checked}</span>
      </div>
      {page.serversKnown && intro && (
        <div className="text-[13px] text-muted-foreground">
          {intro.text}
          {intro.link?.kind === 'startTv' && <> <button type="button" onClick={page.openStartTv} className={introLink}>Start using TV shows</button></>}
          {intro.link?.kind === 'folder' && (
            <><button type="button" onClick={() => page.selectFolder((intro.link as { folder: string }).folder)} className={introLink}>
              {libraryFolderLabel((intro.link as { folder: string }).folder)}
            </button>{intro.trailing}</>
          )}
          {intro.link?.kind === 'channels' && mainDetail && (
            <>
              {' '}<ChannelLinks channels={mainDetail.channels} />
              {followers && <span className="mt-0.5 block">{followers}</span>}
            </>
          )}
        </div>
      )}
      {plexControl && <PlexRefreshControl folder={folder} report={plexStatus?.report ?? null} />}
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
        statuses.map((status) => (
          <ServerCard key={status.serverType} folder={folder} status={status} downloadsPath={downloadsPathOf(status.serverType)} />
        ))
      )}
      {page.serversKnown && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />{footerNote(folder, page.servers)}
        </p>
      )}
    </section>
  );
}
