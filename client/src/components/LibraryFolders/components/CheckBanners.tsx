import React from 'react';
import { Link } from 'react-router-dom';
import { Warning, XCircle } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import { useLibraryPage } from '../LibraryFoldersContext';

const SETTINGS_PATH = { plex: '/settings/plex', jellyfin: '/settings/jellyfin', emby: '/settings/emby' } as const;

/** Unreachable servers, a failed check, and an unknown folder URL (UI 5.3). */
export function CheckBanners({ missingName, onDismissMissing }: { missingName: string | null; onDismissMissing: () => void }) {
  const page = useLibraryPage();
  const unreachable = page.check.data?.servers.filter((server) => !server.reachable) ?? [];
  const button = cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center');
  const box = 'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ui border border-warning bg-card px-3 py-2 text-[13px]';
  return (
    <>
      {unreachable.map((server) => (
        <div key={server.serverType} role="status" className={box}>
          <Warning size={15} aria-hidden="true" className="text-warning" />
          <span className="min-w-0 flex-1">{`${server.name} couldn't be reached, so its libraries weren't checked: `}{server.error}</span>
          <button type="button" onClick={() => { void page.check.refetch(); }} className={button}>Check again</button>
          <Link to={SETTINGS_PATH[server.serverType]} className={button}>{server.name} settings</Link>
        </div>
      ))}
      {page.check.error && (
        <div role="status" className={box}>
          <Warning size={15} aria-hidden="true" className="text-warning" />
          <span className="min-w-0 flex-1">Couldn&apos;t check the media server libraries: {page.check.error}</span>
          <button type="button" onClick={() => { void page.check.refetch(); }} className={button}>Try again</button>
        </div>
      )}
      {missingName !== null && (
        <div role="status" className="flex items-center gap-2 rounded-ui border border-border bg-card px-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1">{`Library folder __${missingName} wasn't found. It may have been deleted.`}</span>
          <button type="button" aria-label="Dismiss" onClick={onDismissMissing} className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground">
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
