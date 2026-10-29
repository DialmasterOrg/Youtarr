import React, { useId, useState } from 'react';
import { CheckCircle, Info } from '../../../lib/icons';
import { Popover } from '../../ui';
import { cn } from '../../../lib/cn';
import { useLibraryPage } from '../LibraryFoldersContext';

export interface InfoPopoverProps {
  /** The button's accessible name */
  label: string;
  /** "check" shows a success check instead of the info icon */
  variant?: 'info' | 'check';
  children: React.ReactNode;
}

/**
 * An explanation behind a small button, opened by click or tap (a hover tooltip never opens on touch). The popover
 * renders in place, not in a portal, so never put this inside a <p> or <span>: its blocks there are invalid markup.
 */
export function InfoPopover({ label, variant = 'info', children }: InfoPopoverProps) {
  const { phone } = useLibraryPage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const contentId = useId();
  const Icon = variant === 'check' ? CheckCircle : Info;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? contentId : undefined}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        onKeyDown={(event) => { if (event.key === 'Escape') setAnchor(null); }}
        className={cn(
          'relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full align-middle hover:bg-primary/10 hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'check' ? 'text-success' : 'text-muted-foreground',
          // A 44px tap area that doesn't make the line of text it sits in 44px tall.
          phone && 'before:absolute before:-inset-[11px]'
        )}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} className="max-w-[300px] px-3 py-2.5">
        <div id={contentId} role="note" className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed">{children}</div>
      </Popover>
    </>
  );
}
