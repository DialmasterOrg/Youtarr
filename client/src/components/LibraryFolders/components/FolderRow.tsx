import React, { useEffect, useRef } from 'react';
import { ChevronRight, Star } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import type { ServerStatus } from '../../../utils/libraryAttention';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { rowSummary } from '../folderText';
import { StatusCell, StatusLine } from './StatusCell';

/** The selected row: a tint and a bar on its left edge, matching the inspector header's tint. */
export const SELECTED_ROW = 'bg-primary/[0.07] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary';

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
  // In two columns a row selects into the inspector beside it; a chevron would suggest a new screen.
  const chevron = !wide && !twoColumn;
  // ...but the selected row points at the inspector it fills.
  const pointer = twoColumn && selected;
  const pointerIcon = <ChevronRight size={18} aria-hidden="true" data-testid="row-pointer" className="shrink-0 self-center text-primary" />;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(folder.name)}
      aria-current={selected ? 'true' : undefined}
      aria-controls={twoColumn ? 'library-inspector' : undefined}
      className={cn(
        'relative grid w-full items-start border-t border-border text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        wide ? 'grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-[3px] pb-2.5 pl-3.5 pr-3 pt-[9px]'
          : chevron || pointer ? 'grid-cols-[minmax(0,1fr)_18px] gap-x-2.5 gap-y-1 py-2.5 pl-3.5 pr-1'
            : 'grid-cols-[minmax(0,1fr)] gap-y-1 py-2.5 pl-3.5 pr-3',
        phone && 'min-h-[64px]',
        selected ? SELECTED_ROW : 'hover:bg-muted/40'
      )}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={cn('truncate text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>{libraryFolderLabel(folder.name)}</span>
        {folder.isDefault && (
          <span className="inline-flex items-center gap-1 rounded-ui border border-primary px-1.5 text-[11.5px] text-primary">
            <Star size={11} aria-hidden="true" />Default
          </span>
        )}
        {moving && <span className="rounded-ui border border-info px-1.5 text-[11.5px] text-info">Moving</span>}
      </span>
      {wide && (
        <span className="flex gap-1.5">
          {statuses.map((status) => <StatusCell key={status.serverType} status={status} />)}
          {/* Every row keeps the pointer's slot, so the status cells stay under their column labels. */}
          {twoColumn && (pointer ? pointerIcon : <span aria-hidden="true" data-testid="row-pointer-slot" className="w-[18px] shrink-0" />)}
        </span>
      )}
      {!wide && chevron && <ChevronRight size={18} aria-hidden="true" data-testid="row-chevron" className="row-span-3 self-center text-muted-foreground" />}
      {!wide && pointer && <span className="row-span-3 flex self-center">{pointerIcon}</span>}
      <span className={cn('text-[12.5px] text-muted-foreground', wide ? 'col-span-2' : 'col-start-1')}>
        {rowSummary(folder)}
      </span>
      {!wide && statuses.length > 0 && <span className="col-start-1"><StatusLine statuses={statuses} /></span>}
    </button>
  );
}
