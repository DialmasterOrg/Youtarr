import React, { useEffect, useId, useRef } from 'react';
import { ChevronRight, Trash2 } from '../../../lib/icons';
import { Button, IconButton } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { deleteReasons, layoutName, SEP } from '../folderText';
import { SELECTED_ROW } from './FolderRow';

export interface UnusedFolderRowProps {
  folder: LibraryFolder;
  selected: boolean;
  autoFocus?: boolean;
  onFocused?: () => void;
  onSelect: (name: string) => void;
}

/** An empty folder nothing downloads to: muted, last in its shelf, with Delete (UI 5.6.2). */
export function UnusedFolderRow({ folder, selected, autoFocus = false, onFocused, onSelect }: UnusedFolderRowProps) {
  const { phone, twoColumn, openDelete } = useLibraryPage();
  const ref = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
    onFocused?.();
  }, [autoFocus, onFocused]);
  const label = libraryFolderLabel(folder.name);
  const reason = folder.deletable ? null : deleteReasons(folder)[0] ?? null;
  return (
    <div className={cn('relative flex items-center border-t border-border', selected && SELECTED_ROW)}>
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(folder.name)}
        aria-current={selected ? 'true' : undefined}
        aria-controls={twoColumn ? 'library-inspector' : undefined}
        className={cn(
          'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-y-[3px] pb-2.5 pl-3.5 pr-3 pt-[9px] text-left text-muted-foreground',
          !selected && 'hover:bg-muted/40',
          phone && 'min-h-[52px]'
        )}
      >
        <span className={cn('truncate text-sm font-semibold', selected && 'text-primary')}>{label}</span>
        <span className="text-[12.5px]">
          {phone ? `${layoutName(folder.layout)}${SEP}Empty` : `Unused${SEP}Empty`}
          {!phone && reason ? <>{SEP}<span id={reasonId}>{reason}</span></> : null}
        </span>
        {phone && reason ? <span id={reasonId} className="text-[12.5px]">{reason}</span> : null}
      </button>
      <span className="flex shrink-0 items-center gap-1 pr-3">
        {phone ? (
          <IconButton
            color={folder.deletable ? 'error' : 'inherit'}
            aria-label={`Delete ${label}`}
            aria-describedby={reason ? reasonId : undefined}
            disabled={!folder.deletable}
            onClick={() => openDelete(folder)}
            className="h-11 w-11 border border-border p-0 [&>svg]:!h-[18px] [&>svg]:!w-[18px]"
          >
            <Trash2 size={18} aria-hidden="true" data-testid="delete-icon" className="!h-[18px] !w-[18px]" />
          </IconButton>
        ) : (
          <Button
            variant="outlined"
            color={folder.deletable ? 'error' : 'inherit'}
            size="sm"
            aria-label={`Delete ${label}`}
            aria-describedby={reason ? reasonId : undefined}
            disabled={!folder.deletable}
            onClick={() => openDelete(folder)}
            startIcon={<Trash2 size={14} aria-hidden="true" />}
            className="h-[30px]"
          >
            Delete
          </Button>
        )}
        {twoColumn && selected && <ChevronRight size={18} aria-hidden="true" data-testid="row-pointer" className="-mr-2 text-primary" />}
      </span>
    </div>
  );
}
