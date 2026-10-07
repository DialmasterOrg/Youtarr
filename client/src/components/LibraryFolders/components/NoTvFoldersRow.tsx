import React from 'react';
import { Plus, Tv } from '../../../lib/icons';
import { Button } from '../../ui';
import { cn } from '../../../lib/cn';
import { useLibraryPage } from '../LibraryFoldersContext';

/** Stands in for the TV show folders shelf until one exists (UI 5.6). */
export function NoTvFoldersRow() {
  const { phone, openStartTv, openAddFolder } = useLibraryPage();
  const full = phone ? 'min-h-[44px] w-full' : undefined;
  return (
    <section aria-labelledby="no-tv-folders-title" className="rounded-ui border border-border bg-card p-3">
      <div className="flex items-start gap-2.5">
        <Tv size={16} aria-hidden="true" className="mt-1 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 id="no-tv-folders-title" className="font-display text-[15px] font-semibold">TV show folders</h2>
          <p className="text-[13px] text-muted-foreground">
            None yet. Save channels as TV shows: each channel a show, each upload year a season.
          </p>
          <div className={cn('mt-2 flex gap-2', phone && 'flex-col')}>
            <Button variant="outlined" onClick={openStartTv} className={full}>Start using TV shows</Button>
            <Button variant="text" startIcon={<Plus size={14} />} onClick={() => openAddFolder('tv')} className={full}>
              Add TV folder
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
