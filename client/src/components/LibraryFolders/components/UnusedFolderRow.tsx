import React, { useEffect, useId, useRef } from 'react';
import { Film, Trash2, Tv } from '../../../lib/icons';
import { Button, IconButton } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { deleteReasons, layoutName, SEP } from '../folderText';

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
  const Icon = folder.layout === 'tv' ? Tv : Film;
  return (
    <div className={cn('flex items-center border-t border-border', selected && 'bg-muted/40 ring-1 ring-inset ring-primary')}>
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(folder.name)}
        aria-current={selected ? 'true' : undefined}
        aria-controls={twoColumn ? 'library-inspector' : undefined}
        className={cn(
          'grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 gap-y-[3px] px-3 pb-2.5 pt-[9px] text-left text-muted-foreground hover:bg-muted/40',
          phone && 'min-h-[52px]'
        )}
      >
        <Icon size={16} aria-hidden="true" data-testid="unused-folder-icon" className={cn('mt-0.5', selected && 'text-primary')} />
        <span className="truncate text-sm font-semibold">{label}</span>
        <span className="col-start-2 text-[12.5px]">
          {phone ? `${layoutName(folder.layout)}${SEP}Empty` : `Unused${SEP}Empty`}
          {!phone && reason ? <>{SEP}<span id={reasonId}>{reason}</span></> : null}
        </span>
        {phone && reason ? <span id={reasonId} className="col-start-2 text-[12.5px]">{reason}</span> : null}
      </button>
      <span className="shrink-0 pr-3">
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
      </span>
    </div>
  );
}
