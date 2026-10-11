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
    <section aria-labelledby="no-tv-folders-title" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5">
        <Tv size={phone ? 18 : 17} aria-hidden="true" className="text-foreground" />
        <h2 id="no-tv-folders-title" className={cn('font-display font-bold', phone ? 'text-lg' : 'text-[17px]')}>TV show folders</h2>
      </div>
      <div className="rounded-ui border border-border bg-card p-3">
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
    </section>
  );
}
