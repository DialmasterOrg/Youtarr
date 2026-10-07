import React, { useId } from 'react';
import { Trash2 } from '../../../lib/icons';
import { Button } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { useLibraryPage } from '../LibraryFoldersContext';
import { deleteReasonText } from '../folderText';

export function DeleteSection({ folder }: { folder: LibraryFolder }) {
  const { phone, openDelete } = useLibraryPage();
  const reasonId = useId();
  const deletable = Boolean(folder.name) && Boolean(folder.deletable);
  return (
    <section aria-label="Delete" className={cn('flex gap-3 px-4 pb-4 pt-3', phone ? 'flex-col' : 'items-center')}>
      <Button variant="outlined" color={deletable ? 'error' : 'inherit'} disabled={!deletable} aria-describedby={reasonId}
        startIcon={<Trash2 size={14} aria-hidden="true" />} onClick={() => openDelete(folder)}
        className={phone ? 'min-h-[44px] w-full' : 'h-[30px] shrink-0'}>
        Delete folder
      </Button>
      <p id={reasonId} className={cn('text-muted-foreground', phone ? 'text-[13px]' : 'text-[12.5px]')}>{deleteReasonText(folder)}</p>
    </section>
  );
}
