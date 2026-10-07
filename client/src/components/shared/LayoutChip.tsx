import React from 'react';
import { Film, Tv } from '../../lib/icons';
import { cn } from '../../lib/cn';
import type { LibraryLayout } from '../../types/tvShows';

export interface LayoutChipProps {
  layout: LibraryLayout;
  className?: string;
}

/** Videos / TV shows chip for a library folder's layout. */
export function LayoutChip({ layout, className }: LayoutChipProps) {
  const tv = layout === 'tv';
  const Icon = tv ? Tv : Film;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-ui border px-1.5 py-0.5 text-xs leading-none',
        tv ? 'border-info/50 text-info' : 'border-border text-muted-foreground',
        className
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {tv ? 'TV shows' : 'Videos'}
    </span>
  );
}

export default LayoutChip;
