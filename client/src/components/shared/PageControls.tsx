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

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function buildPageItems(page: number, totalPages: number, compact: boolean): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const siblingCount = compact ? 0 : 1;
  const leftSibling = Math.max(page - siblingCount, 2);
  const rightSibling = Math.min(page + siblingCount, totalPages - 1);
  const items: PageItem[] = [1];

  if (leftSibling > 2) {
    items.push('ellipsis-left');
  }

  for (let current = leftSibling; current <= rightSibling; current += 1) {
    items.push(current);
  }

  if (rightSibling < totalPages - 1) {
    items.push('ellipsis-right');
  }

  items.push(totalPages);
  return items;
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

  const visiblePages = buildPageItems(page, totalPages, compact);

  const navBtnClass = cn(
    'inline-flex items-center justify-center border border-border rounded-[var(--radius-ui)] bg-card text-foreground',
    'transition-all duration-[160ms] hover:bg-muted hover:text-foreground',
    'disabled:opacity-45 disabled:cursor-not-allowed',
    compact ? 'w-[30px] h-[30px]' : 'w-[32px] h-[32px]'
  );

  return (
    <nav role="navigation" aria-label="pagination" className={cn('flex justify-center items-center gap-1.5 flex-wrap', className)}>
      <button aria-label="go to first page" type="button" onClick={() => onPageChange(1)} disabled={page <= 1} className={navBtnClass}>
        <ChevronsLeft size={16} />
      </button>

      <button aria-label="go to previous page" type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={navBtnClass}>
        <ChevronLeft size={16} />
      </button>

      {visiblePages.map((item) => (
        typeof item === 'number' ? (
          <button
            aria-label={`go to page ${item}`}
            type="button"
            key={item}
            onClick={() => onPageChange(item)}
            className={cn(
              'inline-flex items-center justify-center border border-border rounded-[var(--radius-ui)]',
              'transition-all duration-[160ms] font-medium',
              compact ? 'min-w-[30px] h-[30px] px-2' : 'min-w-[32px] h-[32px] px-2',
              item === page
                ? 'bg-primary text-primary-foreground border-primary font-bold hover:opacity-90'
                : 'bg-card text-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item}
          </button>
        ) : (
          <span
            key={item}
            aria-hidden="true"
            className={cn(
              'inline-flex items-center justify-center text-muted-foreground font-medium',
              compact ? 'min-w-[20px] h-[30px]' : 'min-w-[24px] h-[32px]'
            )}
          >
            ...
          </span>
        )
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