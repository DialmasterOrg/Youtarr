import React from 'react';
import { Loader2 } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import type { ServerStatus } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { holdersText, serverLineText } from '../mediaServerText';
import { PlexRefreshControl } from './PlexRefreshControl';
import { showsPlexControl } from './serverCardRules';
import { STATUS_TONE } from './StatusCell';

/** A server with nothing to fix: one line in the inspector's server box, with Plex's refresh setting under it (UI 5.7.2). */
export function ServerRow({ folder, status }: { folder: LibraryFolder; status: ServerStatus }) {
  const page = useLibraryPage();
  const ok = status.display === 'ok' && status.report !== null;
  const line = ok && status.report
    ? { text: holdersText(status.serverType, status.report), action: null }
    : serverLineText(status, folder, Boolean(page.check.error));
  const plexControl = status.serverType === 'plex' && showsPlexControl(folder);
  return (
    <section id={`server-card-${status.serverType}`} aria-label={status.name} className="px-3 py-2 text-[13px]">
      {/* Phones put the library text on its own line; beside the name it would wrap a word at a time. */}
      <div className={cn('grid items-center gap-x-2', page.phone ? 'grid-cols-[8px_minmax(0,1fr)_auto] gap-y-0.5' : 'grid-cols-[8px_68px_minmax(0,1fr)_auto]')}>
        <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', STATUS_TONE[status.display].dot)} />
        <span className="font-semibold">{status.name}</span>
        <span title={ok ? line.text : undefined}
          className={cn('text-[12.5px] text-muted-foreground', page.phone ? 'col-span-2 col-start-2 row-start-2' : ok && 'truncate')}>
          {line.text}
        </span>
        {ok && <span className="text-xs font-medium text-success">OK</span>}
        {status.display === 'checking' && <Loader2 size={14} aria-hidden="true" className="animate-spin text-muted-foreground" />}
        {line.action && (
          <button type="button" onClick={() => { void page.check.refetch(); }}
            className={cn('text-[12.5px] text-primary underline', page.phone && 'min-h-[44px]')}>
            {line.action}
          </button>
        )}
      </div>
      {plexControl && (
        <div className={cn('mt-1.5', !page.phone && 'pl-[92px]')}>
          <PlexRefreshControl folder={folder} report={status.report} />
        </div>
      )}
    </section>
  );
}
