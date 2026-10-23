import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, ChevronRight, Film, Info, Library, Loader2, Tv, Warning, XCircle } from '../../../../lib/icons';
import { Button } from '../../../ui';
import { cn } from '../../../../lib/cn';
import type { LibraryFolder } from '../../../../types/tvShows';
import type { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../../types';
import { useLibraryFolders } from '../../../../hooks/useLibraryFolders';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';
import { useMediaServerStatus } from '../../../../hooks/useMediaServerStatus';
import { useContainerWidth } from '../../../../hooks/useContainerWidth';
import { useNow } from '../../hooks/useNow';
import { LayoutChip } from '../../../shared/LayoutChip';
import { InfoTooltip } from '../../common/InfoTooltip';
import { PHONE_HIT_AREA } from '../../common/SettingRow';
import { AttentionItem, SERVER_NAMES, SERVER_ORDER, buildAttention, checkStatus, serversOf } from '../../../../utils/libraryAttention';
import { LIBRARY_FOLDERS_PATH, libraryFolderLabel, libraryFolderUrl } from '../../../../utils/libraryLayouts';
import { noLibraryLine } from '../../../LibraryFolders/mediaServerText';
import { NO_SERVERS_LEAD, NO_SERVERS_TAIL, checkCell } from './libraryCardText';

const WIDE = 900;
const MEDIUM = 520;
const MAX_ROWS = 3;
const INCLUDE: Array<'usage'> = ['usage'];
const CELL_ICONS = { spinner: Loader2, info: Info, check: CheckCircle, alert: Warning, x: XCircle };
const CELL_TONES = {
  muted: 'text-muted-foreground', success: 'text-success', warning: 'text-warning font-semibold',
  destructive: 'text-destructive', foreground: 'text-foreground',
};
/** 44px targets for inline text buttons and links on phones */
const PHONE_TARGET = 'max-md:inline-flex max-md:min-h-[44px] max-md:items-center';
const DOWNLOADS_SUB = {
  elfhosted: 'This path is configured by your platform deployment and cannot be changed here.',
  dataPath: 'Set by the DATA_PATH environment variable.',
  docker: 'Docker volume, set by YOUTUBE_OUTPUT_DIR. Edit .env and restart to change it.',
};

type CardSize = 'wide' | 'medium' | 'narrow';
type FolderItem = Extract<AttentionItem, { kind: 'folder' }>;

export interface LibraryFoldersCardProps {
  token: string | null;
  config: ConfigState;
  isPlatformManaged: PlatformManagedState;
  deploymentEnvironment: DeploymentEnvironment;
  onMobileTooltipClick?: (text: string) => void;
}

interface Fact {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** The narrow card keeps this sub line (the others drop theirs) */
  keepSubWhenNarrow?: boolean;
}

/** Core's summary of the library folders, linking into the Library folders page (Core 3). */
export function LibraryFoldersCard({ token, config, isPlatformManaged, deploymentEnvironment, onMobileTooltipClick }: LibraryFoldersCardProps) {
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const size: CardSize = width === null || width >= WIDE ? 'wide' : width >= MEDIUM ? 'medium' : 'narrow';
  const narrow = size === 'narrow';
  const now = useNow();
  const library = useLibraryFolders(token, { include: INCLUDE });
  const check = useLibraryCheck(token);
  const { status: serverStatus, loading: serverStatusLoading } = useMediaServerStatus(token);
  const configured = SERVER_ORDER.filter((type) => serverStatus[type]);
  const checkState = { data: check.data, loading: check.loading, error: check.error, lastCheckedAt: check.lastCheckedAt };
  const attention = buildAttention(library.folders, checkState, configured);
  const status = checkStatus(checkState, configured);
  // Servers the check reported, else the configured ones: "not set up" names only servers neither knows.
  const known = serversOf(checkState, configured).map((server) => server.serverType);
  const cell = checkCell({
    status, attentionCount: attention.length, configured: known, now, timeZone: deploymentEnvironment.timezone ?? null,
    serversKnown: !serverStatusLoading || check.data !== null,
  });
  const CellIcon = CELL_ICONS[cell.icon];
  const loadingFolders = !library.loaded || (library.loading && library.folders.length === 0);
  const defaultFolder = library.folders.find((folder) => folder.isDefault) ?? null;
  const onlyMain = !loadingFolders && library.folders.length === 1;
  const videoCount = library.folders.filter((folder) => folder.layout === 'videos').length;
  const tvCount = library.folders.length - videoCount;
  const downloadsSub = deploymentEnvironment.platform?.toLowerCase() === 'elfhosted' ? DOWNLOADS_SUB.elfhosted
    : isPlatformManaged.youtubeOutputDirectory ? DOWNLOADS_SUB.dataPath : DOWNLOADS_SUB.docker;
  const tvDefault = defaultFolder?.layout === 'tv';
  const retryCheck = cell.retry && (
    <button type="button" onClick={() => { void check.refetch(); }} className={cn('text-primary underline', PHONE_TARGET)}>Try again</button>
  );
  const serverLinks = SERVER_ORDER.map((type, index) => (
    <React.Fragment key={type}>
      {index > 0 ? (index === SERVER_ORDER.length - 1 ? ' or ' : ', ') : ''}
      <Link to={`/settings/${type}`} className={cn('text-primary underline', PHONE_TARGET)}>{SERVER_NAMES[type]}</Link>
    </React.Fragment>
  ));
  const checkSub = cell.linksServers ? <>{NO_SERVERS_LEAD}{serverLinks}{NO_SERVERS_TAIL}</>
    : cell.sub || cell.retry ? <>{cell.sub}{cell.sub && cell.retry ? ' ' : ''}{retryCheck}</> : undefined;

  const facts: Fact[] = [
    {
      label: 'Downloads folder',
      value: <span className="font-mono text-[13px]">{config.youtubeOutputDirectory || 'Not set'}</span>,
      sub: downloadsSub,
    },
    {
      label: 'Default folder',
      value: loadingFolders ? <span className="block h-4 w-24 animate-pulse rounded bg-muted" /> : (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">
          <span>{libraryFolderLabel(defaultFolder?.name ?? '')}</span>
          <LayoutChip layout={defaultFolder?.layout ?? 'videos'} />
          {!onlyMain && !narrow && defaultFolder && (
            <Link to={libraryFolderUrl(defaultFolder.name)} className={cn('text-[13px] font-normal text-primary underline', PHONE_TARGET)}>Change</Link>
          )}
        </span>
      ),
      sub: loadingFolders ? undefined : 'Where channels set to the default folder go, and the fallback for downloads with no more specific folder.'
        + `${tvDefault ? " Each channel you don't subscribe to becomes its own show." : ''}`,
    },
    {
      label: 'Folders',
      value: loadingFolders ? <span className="block h-4 w-16 animate-pulse rounded bg-muted" />
        : onlyMain ? 'Main folder only'
          : <span><span className="font-display text-[22px]">{library.folders.length}</span> library {library.folders.length === 1 ? 'folder' : 'folders'}</span>,
      sub: loadingFolders ? undefined : onlyMain
        ? 'Add a folder for each kind of content you want to keep apart, like __Kids or __TV Shows.'
        : (
          <span className="flex flex-wrap gap-x-3">
            <span className="inline-flex items-center gap-1"><Film size={12} aria-hidden="true" />{videoCount} Videos {videoCount === 1 ? 'folder' : 'folders'}</span>
            <span className="inline-flex items-center gap-1 text-info"><Tv size={12} aria-hidden="true" />{tvCount} TV {tvCount === 1 ? 'folder' : 'folders'}</span>
          </span>
        ),
    },
    {
      label: 'Media server check',
      value: (
        <span className={cn('inline-flex items-center gap-1.5', CELL_TONES[cell.tone])}>
          <CellIcon size={14} aria-hidden="true" className={cell.icon === 'spinner' ? 'animate-spin' : undefined} />{cell.value}
        </span>
      ),
      sub: checkSub,
      keepSubWhenNarrow: true,
    },
  ];

  const attentionShown = check.data && attention.length > 0 && !library.error;
  const iconBox = (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-ui border border-primary/40 text-primary', narrow ? 'h-9 w-9' : 'h-10 w-10')}>
      <Library size={18} aria-hidden="true" />
    </span>
  );
  const heading = <h2 id="library-folders-title" className="font-display text-lg font-semibold leading-6">Library folders</h2>;
  const lead = (
    <p className={cn('max-w-[640px] text-sm text-muted-foreground', narrow ? 'mt-2.5' : 'mt-1')}>
      Library folders decide where downloads are saved. Each folder&apos;s layout, <span className="text-foreground">Videos</span>{' '}
      (Youtarr&apos;s existing movie-style layout) or <span className="text-foreground">TV shows</span>, decides how its files are
      named and which library type Plex, Jellyfin, Emby and Kodi need to show it.
    </p>
  );
  const manageLink = (
    <Link to={LIBRARY_FOLDERS_PATH}
      className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-ui bg-primary px-3 text-sm font-medium text-primary-foreground',
        narrow ? 'mt-3.5 min-h-[44px] w-full' : 'h-9')}>
      Manage library folders<ArrowRight size={14} aria-hidden="true" />
    </Link>
  );

  return (
    <section id="library-folders" aria-labelledby="library-folders-title" aria-busy={loadingFolders || undefined}
      className="scroll-mt-24 rounded-ui border border-border bg-card">
      <div ref={measureRef}>
        {narrow ? (
          <div className="p-4">
            <div className="flex items-center gap-3">{iconBox}{heading}</div>
            {lead}
            {manageLink}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-6 px-6 pb-5 pt-6">
            <div className="flex min-w-0 gap-3">
              {iconBox}
              <div className="min-w-0">{heading}{lead}</div>
            </div>
            {manageLink}
          </div>
        )}
        {library.error ? (
          <p className={cn('flex items-center gap-2 border-t border-border/60 py-4 text-[13px]', narrow ? 'px-4' : 'px-6')}>
            <Warning size={15} aria-hidden="true" className="text-warning" />
            <span className="flex-1">Couldn&apos;t load library folders: {library.error}.</span>
            <Button variant="text" onClick={() => { void library.refetch(); }} className="max-md:min-h-[44px]">Try again</Button>
          </p>
        ) : narrow ? (
          <dl className="mx-4 mb-4 divide-y divide-border rounded-ui border border-border">
            {facts.map((fact) => (
              <div key={fact.label} className="grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 px-3 py-2.5">
                <dt className="flex items-center text-[13px] text-muted-foreground">
                  {fact.label}
                  {fact.label === 'Downloads folder' && (
                    <span className={cn('inline-flex', PHONE_HIT_AREA)}>
                      <InfoTooltip text={downloadsSub} onMobileClick={onMobileTooltipClick} />
                    </span>
                  )}
                </dt>
                <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{fact.value}</dd>
                {fact.keepSubWhenNarrow && fact.sub && <dd className="col-span-2 text-xs text-muted-foreground">{fact.sub}</dd>}
              </div>
            ))}
          </dl>
        ) : (
          <dl className={cn('grid border-t border-border/60', size === 'wide' ? 'grid-cols-[1.25fr_1.3fr_1fr_1.15fr] divide-x divide-border/60' : 'grid-cols-2')}>
            {facts.map((fact) => (
              <div key={fact.label} className="px-6 py-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">{fact.label}</dt>
                <dd className="mt-1.5 [overflow-wrap:anywhere]">{fact.value}</dd>
                {fact.sub && <dd className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{fact.sub}</dd>}
              </div>
            ))}
          </dl>
        )}
        {attentionShown && (
          <div className={cn('border-t border-border/60', narrow ? 'px-4 pb-4 pt-3' : 'px-6 py-4')}>
            <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">Needs attention</p>
            <ul className="mt-2 flex flex-col gap-2">
              {attention.slice(0, MAX_ROWS).map((item) => (
                <li key={item.key}><AttentionRow item={item} size={size} folders={library.folders} /></li>
              ))}
            </ul>
            {attention.length > MAX_ROWS && (
              <Link to={LIBRARY_FOLDERS_PATH} className={cn('mt-2 inline-block text-[13px] text-primary underline', PHONE_TARGET)}>
                And {attention.length - MAX_ROWS} more on Library folders
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const ROW_COLUMNS: Record<CardSize, string> = {
  wide: 'grid-cols-[16px_240px_minmax(0,1fr)_auto]',
  medium: 'grid-cols-[16px_minmax(0,1fr)_auto]',
  narrow: 'grid-cols-[16px_minmax(0,1fr)_16px]',
};
const ROW_CHIP = 'inline-flex h-[22px] items-center rounded-ui border px-1.5 text-xs';

/** One Needs attention row: line 1 names the folder or library, line 2 its server chips or reach (Core 3.3, 3.5). */
function AttentionRow({ item, size, folders }: { item: AttentionItem; size: CardSize; folders: LibraryFolder[] }) {
  const target = item.kind === 'library' ? item.folders[0] : item.folder;
  const narrow = size === 'narrow';
  const message = size === 'wide' && item.kind === 'folder' ? folderMessage(item, folders) : null;
  return (
    <Link to={libraryFolderUrl(target)}
      className={cn('grid min-h-[44px] items-center gap-3 rounded-ui border border-border px-3 py-2 hover:bg-muted/40', ROW_COLUMNS[size])}>
      <Warning size={16} aria-hidden="true" className="text-warning" />
      <span className={cn('flex min-w-0 gap-1.5', narrow ? 'flex-col' : 'flex-wrap items-center')}>
        {item.kind === 'library' ? (
          <>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{item.serverName} library {item.libraryName}</span>
              <span className={cn(ROW_CHIP, 'border-warning text-warning')}>{item.short}</span>
            </span>
            <span className="text-[13px] text-muted-foreground">affects {item.folders.length} {item.folders.length === 1 ? 'folder' : 'folders'}</span>
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{item.label}</span>
              <LayoutChip layout={item.layout} />
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {item.servers.map((server) => (
                <span key={server.serverType} className={cn(ROW_CHIP,
                  server.display === 'noLibrary' ? 'border-destructive text-destructive' : 'border-warning text-warning')}>
                  {server.name}: {server.display === 'noLibrary' ? 'No library' : `${server.issueCount} ${server.issueCount === 1 ? 'issue' : 'issues'}`}
                </span>
              ))}
            </span>
          </>
        )}
      </span>
      {size === 'wide' && <span title={message ?? undefined} className="truncate text-[13px] text-muted-foreground">{message}</span>}
      <span className="inline-flex items-center gap-1 text-[13px] text-primary">
        {narrow ? null : 'Review'}<ChevronRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** The first issue of the first server with issues, else the first server's missing library. */
function folderMessage(item: FolderItem, folders: LibraryFolder[]): string {
  const issue = item.servers.find((server) => server.display === 'issues')?.firstMessage;
  if (issue) return issue;
  const folder = folders.find((entry) => entry.name === item.folder);
  return folder ? noLibraryLine(item.servers[0], folder) : item.text;
}

export default LibraryFoldersCard;
