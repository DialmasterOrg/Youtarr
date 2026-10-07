import React from 'react';
import { Server, XCircle } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { ServerStatus, listedIssues } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { folderServerPath } from '../libraryTypes';
import { holdersText, libraryTypeLabel, noLibraryLine } from '../mediaServerText';
import { PlexRefreshControl } from './PlexRefreshControl';
import { ServerIssue } from './ServerIssue';
import { ServerLine } from './ServerLine';
import { SetupBox } from './SetupBox';
import { rendersAsLine, showsPlexControl } from './serverCardRules';
import { STATUS_TONE } from './StatusCell';

export interface ServerCardProps {
  folder: LibraryFolder;
  status: ServerStatus;
  downloadsPath: string | null;
  /** Add folder step 2: "Already shown by ..." for ok, no Plex refresh control */
  compact?: boolean;
}

/** One server's report for a folder (UI 5.7.2.1). */
export function ServerCard({ folder, status, downloadsPath, compact = false }: ServerCardProps) {
  const page = useLibraryPage();
  const { report } = status;
  if (!report || rendersAsLine(status)) {
    return <ServerLine folder={folder} status={status} />;
  }
  const tone = STATUS_TONE[status.display];
  const holders = holdersText(status.serverType, report);
  const tvExists = page.folders.some((entry) => entry.layout === 'tv');
  const setupHere = status.display === 'noLibrary' && !(folder.name === '' && tvExists);
  const showPlex = !compact && status.serverType === 'plex' && showsPlexControl(folder);
  const firstHolder = report.libraries.find((library) => library.relation !== 'inside');
  const issues = listedIssues(report);
  const hasBody = Boolean(holders && page.phone && !compact) || (compact && status.display === 'ok' && Boolean(firstHolder))
    || issues.length > 0 || status.display === 'noLibrary' || showPlex;

  return (
    <section id={compact ? undefined : `server-card-${status.serverType}`} aria-label={`${status.name}`}
      className={cn('rounded-ui border bg-background', status.display === 'ok' ? 'border-border' : tone.border)}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Server size={15} aria-hidden="true" className="text-muted-foreground" />
        <span className="font-semibold">{status.name}</span>
        <span className={cn('inline-flex h-[22px] items-center rounded-ui border px-1.5 text-xs', tone.text, tone.border)}>{status.display === 'ok' ? 'OK' : status.word}</span>
        {holders && !page.phone && !compact && <span className="ml-auto truncate text-[12.5px] text-muted-foreground">{holders}</span>}
      </div>
      {hasBody && <div className="flex flex-col gap-2.5 px-3 pb-3">
        {holders && page.phone && !compact && <p className="text-[12.5px] text-muted-foreground">Library: {holders}</p>}
        {compact && status.display === 'ok' && firstHolder && (
          <p className="text-[13px]">
            Already shown by {firstHolder.name} ({libraryTypeLabel(status.serverType, firstHolder.type)})
            {firstHolder.relation === 'covers' ? ' through the whole downloads folder' : ''}
          </p>
        )}
        {issues.map((issue) => (
          <ServerIssue key={`${issue.code}:${issue.libraryId ?? ''}`} folder={folder} issue={issue} status={status} downloadsPath={downloadsPath} />
        ))}
        {status.display === 'noLibrary' && <p className="flex items-start gap-2 text-[13px]">
          <XCircle size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />{noLibraryLine(status, folder)}
        </p>}
        {setupHere && <SetupBox server={status.serverType} layout={folder.layout} path={folderServerPath(folder.name, downloadsPath, status.name)} />}
        {showPlex && <PlexRefreshControl folder={folder} report={report} />}
      </div>}
    </section>
  );
}
