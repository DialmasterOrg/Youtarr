import React from 'react';
import { cn } from '../../lib/cn';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '../../lib/icons';

interface PageControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
  className?: string;
}

function PageControls({
  page,
  totalPages,
  onPageChange,
  compact = false,
  className,
}: PageControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const start = Math.max(1, Math.min(page - 3, totalPages - 6));
  const visiblePages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => start + i).filter((p) => p <= totalPages);

  const navBtnClass = cn(
    'inline-flex items-center justify-center border border-border rounded-[var(--radius-ui)] bg-card text-foreground',
    'transition-all duration-[160ms] hover:bg-muted hover:text-foreground',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    compact ? 'w-[30px] h-[30px]' : 'w-[34px] h-[34px]'
  );

  return (
    <nav role="navigation" aria-label="pagination" className={cn('flex justify-center items-center gap-2 flex-wrap', className)}>
      <button aria-label="go to first page" type="button" onClick={() => onPageChange(1)} disabled={page <= 1} className={navBtnClass}>
        <ChevronsLeft size={16} />
      </button>

      <button aria-label="go to previous page" type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={navBtnClass}>
        <ChevronLeft size={16} />
      </button>

      {visiblePages.map((p) => (
        <button
          aria-label={`go to page ${p}`}
          type="button"
          key={p}
          onClick={() => onPageChange(p)}
          className={cn(
            'inline-flex items-center justify-center border border-border rounded-[var(--radius-ui)]',
            'transition-all duration-[160ms] font-medium',
            compact ? 'min-w-[30px] h-[30px] px-2' : 'min-w-[34px] h-[34px] px-2.5',
            p === page
              ? 'bg-primary text-primary-foreground border-primary font-bold hover:opacity-90'
              : 'bg-card text-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {p}
        </button>
      ))}

      <button aria-label="go to next page" type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={navBtnClass}>
        <ChevronRight size={16} />
      </button>

      <button aria-label="go to last page" type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className={navBtnClass}>
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}

export default PageControls;