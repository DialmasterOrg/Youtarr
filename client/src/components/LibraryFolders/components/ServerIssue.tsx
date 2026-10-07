import React, { useState } from 'react';
import { Info, Warning } from '../../../lib/icons';
import { Button, CircularProgress } from '../../ui';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckIssue } from '../../../types/libraryCheck';
import { NOTE_CODES, ServerStatus, isLibraryWide, isOverlapIssue } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { PLEX_MAPPING_SAVE_ERROR, usePlexRefreshMapping } from '../hooks/usePlexRefreshMapping';
import { issueHint } from '../mediaServerText';
import { OverlapFixBlock } from './OverlapFixBlock';

/** One issue on a server card: the server's message, a hint, and its fix (UI 5.7.2.1). */
export function ServerIssue({ folder, issue, status, downloadsPath }: {
  folder: LibraryFolder; issue: LibraryCheckIssue; status: ServerStatus; downloadsPath: string | null;
}) {
  const page = useLibraryPage();
  const { setMapping } = usePlexRefreshMapping(page.token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = status.report;
  const libraryName = report?.libraries.find((library) => library.id === issue.libraryId)?.name ?? `library ${issue.libraryId ?? ''}`.trim();
  const hint = issueHint(issue.code, status.name, libraryName, folder.layout);
  const fix = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : PLEX_MAPPING_SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  };
  const fullWidth = page.phone ? 'mt-1 min-h-[44px] w-full' : 'mt-1 h-[30px]';
  const Icon = NOTE_CODES.has(issue.code) ? Info : Warning;

  return (
    <div className="flex items-start gap-2 text-[13px]">
      <Icon size={15} aria-hidden="true" className={NOTE_CODES.has(issue.code) ? 'mt-0.5 text-info' : 'mt-0.5 text-warning'} />
      <div className="min-w-0 flex-1">
        <p>
          {issue.message}
          {isLibraryWide(issue.code) && <span className="ml-1.5 rounded-ui border border-border px-1.5 text-[11px] text-muted-foreground">Library setting</span>}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {issue.code === 'plexMappingMissing' && issue.libraryId && (
          <Button variant="outlined" size="sm" disabled={busy} className={fullWidth}
            startIcon={busy ? <CircularProgress size={14} /> : undefined}
            onClick={() => { void fix(() => page.check.applyPlexMapping(folder.name, issue.libraryId as string)); }}>
            Refresh this library
          </Button>
        )}
        {issue.code === 'plexMappingMismatch' && issue.libraryId && (
          <Button variant="outlined" size="sm" disabled={busy} className={fullWidth}
            onClick={() => { void fix(() => setMapping(folder.name, issue.libraryId as string)); }}>
            Refresh {libraryName} instead
          </Button>
        )}
        {isOverlapIssue(issue.code) && report && (
          <div className="mt-1.5">
            <OverlapFixBlock issue={issue} server={status} report={report} downloadsPath={downloadsPath} />
          </div>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
