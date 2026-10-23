import React, { Fragment } from 'react';
import { RefreshCw } from '../../../lib/icons';
import { Button, CircularProgress } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryLayout } from '../../../types/tvShows';
import { useLibraryPage } from '../LibraryFoldersContext';
import { SETUP_SERVER_NAMES, ServerPath, SetupServer, setupRows } from '../libraryTypes';
import { CopyButton } from './CopyButton';

export interface SetupBoxProps {
  server: SetupServer;
  layout: LibraryLayout;
  path: ServerPath;
  /** "I added it, check again" (not for the no-server and panel variants) */
  showCheckAgain?: boolean;
}

/** "Create it in {Server}": the new library's settings (UI 5.7.2.4). */
export function SetupBox({ server, layout, path, showCheckAgain = true }: SetupBoxProps) {
  const { phone, check } = useLibraryPage();
  const name = SETUP_SERVER_NAMES[server];
  return (
    <div className="rounded-ui border border-border bg-card">
      <p className="px-2.5 py-2 text-[13px] font-semibold">Create it in {name}</p>
      <dl className={cn('grid gap-x-2.5 gap-y-1.5 px-2.5 pb-2 text-[12.5px] max-[340px]:grid-cols-1', phone ? 'grid-cols-[112px_1fr]' : 'grid-cols-[150px_1fr]')}>
        {setupRows(server, layout, path).map((row) => (
          <Fragment key={row.key}>
            <dt className="text-muted-foreground">{row.key}</dt>
            <dd className={cn('flex items-start gap-1 font-medium', row.path && 'font-mono text-xs [overflow-wrap:anywhere]')}>
              <span>{row.value}</span>
              {row.path?.copyable && <CopyButton text={row.path.text} />}
            </dd>
          </Fragment>
        ))}
      </dl>
      {showCheckAgain && (
        <div className="px-2.5 pb-2.5">
          <Button variant="outlined" size="sm" disabled={check.loading} onClick={() => { void check.refetch(); }}
            startIcon={check.loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />}
            className={phone ? 'min-h-[44px] w-full' : 'h-[30px]'}>
            I added it, check again
          </Button>
        </div>
      )}
    </div>
  );
}
