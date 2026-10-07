import React from 'react';
import { Loader2, Server } from '../../../lib/icons';
import type { LibraryFolder } from '../../../types/tvShows';
import { ServerStatus, folderState } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';

/** The single-line server states: fine, not checked, checking (UI 5.7.2.3). */
export function ServerLine({ folder, status }: { folder: LibraryFolder; status: ServerStatus }) {
  const page = useLibraryPage();
  let text: string;
  let action: string | null = null;
  if (status.display === 'checking') {
    text = ': checking...';
  } else if (status.display === 'fine') {
    text = folderState(folder) === 'emptyMain'
      ? ": not in a library, and doesn't need one while you use subfolders."
      : ': not in a library. Fine while nothing downloads here.';
  } else if (status.report?.status === 'unreachable') {
    text = ": couldn't be reached, so this folder wasn't checked.";
    action = 'Check again';
  } else if (page.check.error) {
    text = ': not checked. The library check failed.';
    action = 'Try again';
  } else {
    text = ': not checked yet.';
    action = 'Check again';
  }
  return (
    <div className="flex flex-wrap items-center gap-x-1 rounded-ui border border-border px-3 py-2.5 text-[13px]">
      <Server size={15} aria-hidden="true" className="text-muted-foreground" />
      <span className="font-semibold">{status.name}</span>
      <span className="text-muted-foreground">{text}</span>
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
