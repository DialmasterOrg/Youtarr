import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Warning } from '../../../../lib/icons';
import { CircularProgress } from '../../../ui';
import { cn } from '../../../../lib/cn';
import type { LibraryFolder, LibraryLayout } from '../../../../types/tvShows';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';
import {
  SERVER_NAMES, SERVER_ORDER, ServerRef, ServerStatus, isOverlapIssue, joinNames, plexMappingChoice, reportFor, serverStatuses,
} from '../../../../utils/libraryAttention';
import { folderKey } from '../../../../utils/libraryLayouts';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { folderLabel } from '../../folderText';
import { folderServerPath } from '../../libraryTypes';
import { ServerCard } from '../ServerCard';
import { SetupBox } from '../SetupBox';

export interface AddFolderServersStepProps {
  name: string;
  layout: LibraryLayout;
  existingContent: boolean;
  /** The step's own check, so the footer can show its state */
  check: ReturnType<typeof useLibraryCheck>;
  /** Close the dialog (Open Subscriptions navigates away) */
  onClose: () => void;
}

/** Step 2: what each server needs for the new folder (UI 7.1). */
export function AddFolderServersStep({ name, layout, existingContent, check, onClose }: AddFolderServersStepProps) {
  const page = useLibraryPage();
  const label = folderLabel(name, true);
  const [mappedTo, setMappedTo] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);
  const folder: LibraryFolder = page.folders.find((entry) => folderKey(entry.name) === folderKey(name))
    ?? { name, layout, isDefault: false, hasFiles: existingContent, channels: 0 };
  const statuses = serverStatuses(folder, check, page.configuredServers);
  const report = reportFor(check.data, name);
  const plex = report?.servers.find((entry) => entry.serverType === 'plex');
  const suggestion = plex?.plexMapping?.suggestedLibraryId ?? null;
  const overlap = layout === 'tv'
    ? report?.servers.find((entry) => entry.issues.some((issue) => isOverlapIssue(issue.code))) : undefined;
  const { applyPlexMapping } = check;
  const sections: Array<{ server: ServerRef; status: ServerStatus | null }> = check.data
    ? statuses.map((status) => ({ server: status, status }))
    : page.servers.map((server) => ({ server, status: null }));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstServerRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  // Entering step 2 (UI 10): focus the first server section, or the heading when no server is connected.
  useEffect(() => {
    if (focused.current) return;
    focused.current = true;
    (page.servers.length > 0 ? firstServerRef.current : headingRef.current)?.focus();
  }, [page.servers.length]);

  useEffect(() => {
    if (layout !== 'tv' || !suggestion || plexMappingChoice(plex?.plexMapping) !== 'none') return;
    const key = `${name}:${suggestion}`;
    if (attempted.current === key) return;
    attempted.current = key;
    const libraryName = plex?.libraries.find((library) => library.id === suggestion)?.name ?? null;
    applyPlexMapping(name, suggestion).then(() => setMappedTo(libraryName)).catch(() => undefined);
  }, [layout, suggestion, plex, name, applyPlexMapping]);

  const missing = SERVER_ORDER.filter((type) => !page.servers.some((server) => server.serverType === type)).map((type) => SERVER_NAMES[type]);
  const unconnected = (() => {
    const emby = missing.includes('Emby');
    const connectedNote = missing.length > 0 ? `${joinNames(missing)} ${missing.length > 1 ? "aren't" : "isn't"} connected and ` : '';
    const lead = `${connectedNote}Kodi isn't checked.`;
    if (layout === 'tv') {
      return `${lead}${emby ? ' Emby: a TV shows library, NFO reader on, NFO saver and downloaders off.' : ''} Kodi: a TV shows source set to Local information only.`;
    }
    return `${lead}${emby ? ' Emby: a Movies library.' : ''} Kodi: a Movies source.`;
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-[18px]">
      <h3 ref={headingRef} tabIndex={-1} className="font-display text-base font-semibold focus:outline-none">Set up your media servers</h3>
      {existingContent && <p className="text-[13px]">__{name} already held files on disk.</p>}
      {page.servers.length === 0 ? (
        <>
          <p className="text-[13px] text-muted-foreground">No media server is connected, so Youtarr can&apos;t check. Create one library for {label} on the server you use:</p>
          {(['plex', 'jellyfin', 'emby', 'kodi'] as const).map((server) => (
            <SetupBox key={server} server={server} layout={layout} showCheckAgain={false} path={folderServerPath(name, null, server === 'kodi' ? 'Kodi' : SERVER_NAMES[server])} />
          ))}
        </>
      ) : (
        <>
          <p className="text-[13px] text-muted-foreground">Youtarr doesn&apos;t create libraries. Here is what each server needs for {label}:</p>
          {overlap && (
            <p className="flex items-start gap-1.5 rounded-ui border border-warning p-2 text-[13px]">
              <Warning size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
              <span>
                {SERVER_NAMES[overlap.serverType]} library {overlap.libraries.find((library) => library.relation === 'covers')?.name ?? ''} shows your whole
                downloads folder, so a TV library for {label} {overlap.serverType === 'plex' ? 'would show its episodes a second time.' : 'would stay empty.'}{' '}
                <button type="button" onClick={page.openStartTv}
                  className={cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center')}>See your options</button>
              </span>
            </p>
          )}
          {/* One section per server, kept across the check so focus stays on the first one. */}
          {sections.map(({ server, status }, index) => (
            <div key={server.serverType} data-testid={`add-folder-server-${server.serverType}`}
              ref={index === 0 ? firstServerRef : undefined} tabIndex={index === 0 ? -1 : undefined} className="focus:outline-none">
              {status ? (
                <ServerCard folder={{ ...folder, layout }} status={status} compact
                  downloadsPath={check.data?.servers.find((entry) => entry.serverType === server.serverType)?.downloadsPath ?? null} />
              ) : !check.error && (
                <p className="flex items-center gap-1.5 text-[13px]"><CircularProgress size={14} />Checking {server.name}...</p>
              )}
            </div>
          ))}
          {mappedTo && <p className="text-[13px] text-success">New episodes in {label} now refresh {mappedTo}.</p>}
        </>
      )}
      {page.servers.length > 0 && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground"><Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />{unconnected}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-ui border border-info p-2.5 text-[13px]">
        <span className="min-w-0 flex-1">
          Next: choose channels for {label}. A channel downloads here once you pick {label} as its Library folder in Channel Settings.
        </span>
        <Link to="/subscriptions" onClick={onClose}
          className={cn('rounded-ui border border-primary px-2 text-primary', page.phone ? 'inline-flex min-h-[44px] w-full items-center justify-center' : 'py-0.5')}>
          Open Subscriptions
        </Link>
      </div>
    </div>
  );
}
