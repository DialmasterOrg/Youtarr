import React, { useEffect, useRef } from 'react';
import { ChevronRight, Film, Star, Tv } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import type { ServerStatus } from '../../../utils/libraryAttention';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { rowSummary } from '../folderText';
import { StatusCell, StatusLine } from './StatusCell';

export interface FolderRowProps {
  folder: LibraryFolder;
  statuses: ServerStatus[];
  selected: boolean;
  /** Status cells in a right-hand column; else the status line under the name */
  wide: boolean;
  moving: boolean;
  autoFocus?: boolean;
  onFocused?: () => void;
  onSelect: (name: string) => void;
}

/** An Active or Holds-videos folder (and the main folder) on its shelf (UI 5.6, 6.2). */
export function FolderRow({ folder, statuses, selected, wide, moving, autoFocus = false, onFocused, onSelect }: FolderRowProps) {
  const { phone, twoColumn } = useLibraryPage();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
    onFocused?.();
  }, [autoFocus, onFocused]);
  const Icon = folder.layout === 'tv' ? Tv : Film;
  // In two columns a row selects into the inspector beside it; a chevron would suggest a new screen.
  const chevron = !wide && !twoColumn;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(folder.name)}
      aria-current={selected ? 'true' : undefined}
      aria-controls={twoColumn ? 'library-inspector' : undefined}
      className={cn(
        'grid w-full items-start border-t border-border text-left transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        wide ? 'grid-cols-[16px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-[3px] px-3 pb-2.5 pt-[9px]'
          : chevron ? 'grid-cols-[18px_minmax(0,1fr)_18px] gap-x-2.5 gap-y-1 py-2.5 pl-3 pr-1'
            : 'grid-cols-[18px_minmax(0,1fr)] gap-x-2.5 gap-y-1 px-3 py-2.5',
        phone && 'min-h-[64px]',
        selected && 'bg-muted/40 ring-1 ring-inset ring-primary'
      )}
    >
      <Icon size={wide ? 16 : 18} aria-hidden="true" className={cn('mt-0.5', selected ? 'text-primary' : 'text-muted-foreground')} />
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-foreground">{libraryFolderLabel(folder.name)}</span>
        {folder.isDefault && (
          <span className="inline-flex items-center gap-1 rounded-ui border border-primary px-1.5 text-[11.5px] text-primary">
            <Star size={11} aria-hidden="true" />Default
          </span>
        )}
        {moving && <span className="rounded-ui border border-info px-1.5 text-[11.5px] text-info">Moving</span>}
      </span>
      {wide && <span className="flex gap-1.5">{statuses.map((status) => <StatusCell key={status.serverType} status={status} />)}</span>}
      {chevron && <ChevronRight size={18} aria-hidden="true" data-testid="row-chevron" className="row-span-3 self-center text-muted-foreground" />}
      <span className={cn('text-[12.5px] text-muted-foreground', wide ? 'col-span-2 col-start-2' : 'col-start-2')}>
        {rowSummary(folder)}
      </span>
      {!wide && statuses.length > 0 && <span className="col-start-2"><StatusLine statuses={statuses} /></span>}
    </button>
  );
}
