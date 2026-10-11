import React from 'react';
import { Loader2, Server } from '../../../lib/icons';
import type { LibraryFolder } from '../../../types/tvShows';
import type { ServerStatus } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { serverLineText } from '../mediaServerText';

/** The single-line server states: fine, not checked, checking (UI 5.7.2.3). */
export function ServerLine({ folder, status }: { folder: LibraryFolder; status: ServerStatus }) {
  const page = useLibraryPage();
  const { text, action } = serverLineText(status, folder, Boolean(page.check.error));
  return (
    <div className="flex flex-wrap items-center gap-x-1 rounded-ui border border-border px-3 py-2.5 text-[13px]">
      <Server size={15} aria-hidden="true" className="text-muted-foreground" />
      <span className="font-semibold">{status.name}</span>
      <span className="text-muted-foreground">: {text.charAt(0).toLowerCase()}{text.slice(1)}</span>
      {status.display === 'checking' && <Loader2 size={14} aria-hidden="true" className="animate-spin text-muted-foreground" />}
      {action && (
        <button type="button" onClick={() => { void page.check.refetch(); }}
          className={page.phone ? 'min-h-[44px] text-primary underline' : 'text-primary underline'}>
          {action}
        </button>
      )}
    </div>
  );
}
