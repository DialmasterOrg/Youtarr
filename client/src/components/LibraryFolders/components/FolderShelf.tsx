import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, Film, Plus, Tv } from '../../../lib/icons';
import { Button } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder, LibraryLayout } from '../../../types/tvShows';
import { useContainerWidth } from '../../../hooks/useContainerWidth';
import { folderState, serverStatuses } from '../../../utils/libraryAttention';
import { folderKey } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { GENERIC_LIBRARY_TYPES, libraryTypeName } from '../libraryTypes';
import { SEP } from '../folderText';
import { FolderRow } from './FolderRow';
import { InfoPopover } from './InfoPopover';
import { UnusedFolderRow } from './UnusedFolderRow';

const UNUSED_VISIBLE = 3;
const ROW_BASE_WIDTH = 300;
const STATUS_CELL_WIDTH = 120;

const SHELF = {
  tv: {
    title: 'TV show folders', rule: 'Each channel is a show, each upload year a season, each video an episode.',
    add: 'Add TV folder', addLabel: 'Add a TV show folder', aboutLabel: 'About TV show folders', Icon: Tv,
  },
  videos: {
    title: 'Video folders', rule: 'Each video is a movie, filed in its channel\'s folder.',
    add: 'Add video folder', addLabel: 'Add a video folder', aboutLabel: 'About video folders', Icon: Film,
  },
} as const;

const byName = (a: LibraryFolder, b: LibraryFolder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Main folder, default folder, other Active A-Z, Holds videos A-Z; Unused A-Z separately (UI 5.6). */
export function sortShelf(folders: LibraryFolder[]): { rows: LibraryFolder[]; unused: LibraryFolder[] } {
  const main = folders.filter((folder) => !folder.name);
  const rest = folders.filter((folder) => folder.name);
  return {
    rows: [
      ...main,
      ...rest.filter((folder) => folder.isDefault),
      ...rest.filter((folder) => !folder.isDefault && folderState(folder) === 'active').sort(byName),
      ...rest.filter((folder) => folderState(folder) === 'holdsVideos').sort(byName),
    ],
    unused: rest.filter((folder) => folderState(folder) === 'unused').sort(byName),
  };
}

export interface FolderShelfProps {
  layout: LibraryLayout;
  folders: LibraryFolder[];
  selectedName: string | null;
  /** Focus this folder's row once (after Back on narrow layouts) */
  focusName: string | null;
  onFocused: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}

export function FolderShelf({ layout, folders, selectedName, focusName, onFocused, headingRef }: FolderShelfProps) {
  const page = useLibraryPage();
  const titleId = useId();
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const wide = !page.phone && width !== null && width >= ROW_BASE_WIDTH + page.servers.length * STATUS_CELL_WIDTH;
  const { rows, unused } = sortShelf(folders);
  const isSelected = (folder: LibraryFolder) => selectedName !== null && folderKey(folder.name) === folderKey(selectedName);
  const isFocus = (folder: LibraryFolder) => focusName !== null && folderKey(folder.name) === folderKey(focusName);
  const hiddenTarget = unused.slice(UNUSED_VISIBLE).some((folder) => isSelected(folder) || isFocus(folder));
  const [expanded, setExpanded] = useState(hiddenTarget);
  useEffect(() => {
    if (hiddenTarget) setExpanded(true);
  }, [hiddenTarget]);
  const visibleUnused = expanded ? unused : unused.slice(0, UNUSED_VISIBLE);
  const shelf = SHELF[layout];
  const needs = page.servers.map((server) => ({ server: server.name, type: libraryTypeName(server.serverType, layout) }));
  const touch = page.phone ? 'min-h-[44px]' : 'h-[30px]';

  return (
    <section aria-labelledby={titleId}>
      <div ref={measureRef} className="flex flex-col gap-2">
        {/* The heading sits on the page, the card holds only folder rows, so the two never read alike. */}
        <div className="px-0.5">
          <div className="flex items-center gap-2">
            <shelf.Icon size={page.phone ? 18 : 17} aria-hidden="true" className="text-foreground" />
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className={cn('font-display font-bold', page.phone ? 'text-lg' : 'text-[17px]')}>
              {shelf.title}
            </h2>
            <span className="rounded-ui border border-border px-1.5 text-xs text-muted-foreground">{folders.length}</span>
            <span className="flex-1" />
            <Button variant={page.phone ? 'text' : 'outlined'} size="sm" startIcon={<Plus size={14} />} aria-label={page.phone ? shelf.addLabel : undefined}
              onClick={() => page.openAddFolder(layout)} className={touch}>
              {page.phone ? 'Add' : shelf.add}
            </Button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12.5px] text-muted-foreground">
            Library type: {needs.length > 0 ? needs.map((need, index) => (
              <span key={need.server} className="whitespace-nowrap">
                {need.server} <span className="font-medium text-foreground">{need.type}</span>{index < needs.length - 1 ? SEP : ''}
              </span>
            )) : GENERIC_LIBRARY_TYPES[layout]}
            <InfoPopover label={shelf.aboutLabel}>{shelf.rule}</InfoPopover>
          </div>
        </div>
        <div className="overflow-hidden rounded-ui border border-border bg-card [&>*:first-child]:border-t-0">
          {wide && needs.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 border-t border-border bg-background py-1.5 pl-3.5 pr-3">
              <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">Folder and what downloads here</span>
              <span className="flex gap-1.5">
                {needs.map((need) => (
                  <span key={need.server} className="inline-flex h-[22px] w-[120px] items-center truncate px-1.5 text-[11.5px] text-muted-foreground">
                    {need.server}
                  </span>
                ))}
                {page.twoColumn && <span aria-hidden="true" data-testid="column-pointer-slot" className="w-[18px] shrink-0" />}
              </span>
            </div>
          )}
          {rows.map((folder) => (
            <FolderRow
              key={folderKey(folder.name) || '~main'}
              folder={folder}
              statuses={serverStatuses(folder, page.check, page.configuredServers)}
              selected={isSelected(folder)}
              wide={wide}
              moving={page.movingFolders.includes(folderKey(folder.name))}
              autoFocus={isFocus(folder)}
              onFocused={onFocused}
              onSelect={page.selectFolder}
            />
          ))}
          {visibleUnused.map((folder) => (
            <UnusedFolderRow key={folderKey(folder.name)} folder={folder} selected={isSelected(folder)}
              autoFocus={isFocus(folder)} onFocused={onFocused} onSelect={page.selectFolder} />
          ))}
          {unused.length > UNUSED_VISIBLE && (
            <button type="button" onClick={() => setExpanded((open) => !open)}
              className={cn('flex w-full items-center gap-1.5 border-t border-border px-3 text-[13px] text-primary', page.phone ? 'min-h-[44px]' : 'h-9')}>
              {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              {expanded ? 'Show fewer' : `Show ${unused.length - UNUSED_VISIBLE} more unused`}
            </button>
          )}
          {folders.length === 0 && layout === 'videos' && (
            <p className="border-t border-border px-3 py-2.5 text-[13px] text-muted-foreground">
              No video folders. Add one for channels you want filed as movies.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
