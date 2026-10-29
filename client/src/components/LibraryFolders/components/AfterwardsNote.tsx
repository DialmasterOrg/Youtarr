import React from 'react';
import { cn } from '../../../lib/cn';
import { CircularProgress } from '../../ui';
import type { LibraryFolder, LibraryLayout } from '../../../types/tvShows';
import { useLibraryCheck } from '../../../hooks/useLibraryCheck';
import { isOverlapIssue, joinNames, reportFor } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { folderLabel } from '../folderText';
import { afterwardsLine, afterwardsWithoutServers } from '../mediaServerText';

/** What each server would need after the change: the check run as the target layout (UI 5.7.3). */
export function AfterwardsNote({ folder, target }: { folder: LibraryFolder; target: LibraryLayout }) {
  const page = useLibraryPage();
  const check = useLibraryCheck(page.token, { folders: [folder.name], layout: target, enabled: page.servers.length > 0 });
  const report = reportFor(check.data, folder.name);
  const label = folderLabel(folder.name, true);
  return (
    <div className="mt-2.5 text-[12.5px]">
      <p className="font-semibold">Afterwards on your media servers</p>
      {page.servers.length === 0 && <p>{afterwardsWithoutServers(target)}</p>}
      {page.servers.length > 0 && check.loading && !check.data && (
        <p className="flex items-center gap-1.5">
          <CircularProgress size={12} />Checking what {joinNames(page.servers.map((server) => server.name))} would need...
        </p>
      )}
      {page.servers.length > 0 && (check.data || check.error) && page.servers.map((server) => {
        const entry = check.error ? null : report?.servers.find((item) => item.serverType === server.serverType) ?? null;
        const overlap = Boolean(entry?.issues.some((issue) => isOverlapIssue(issue.code)));
        return (
          <p key={server.serverType}>
            {afterwardsLine(server, entry, { target, label })}
            {overlap && <> <button type="button" onClick={page.openStartTv} className={cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center')}>See all your options</button></>}
          </p>
        );
      })}
    </div>
  );
}
