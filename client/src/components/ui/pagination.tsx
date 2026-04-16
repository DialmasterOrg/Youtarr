import React from 'react';
import { cn } from '../../lib/cn';
import { ChevronLeft, ChevronRight } from '../../lib/icons';

/* ─── Pagination ──────────────────────────────────────────── */
export interface PaginationProps {
  count: number;
  page: number;
  onChange?: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'standard';
  shape?: 'circular' | 'rounded';
  className?: string;
}
const Pagination: React.FC<PaginationProps> = ({ count, page, onChange, size = 'medium', className }) => {
  const pages = Array.from({ length: count }, (_, i) => i + 1);
  const btnSize = size === 'small' ? 'h-7 w-7 text-xs' : size === 'large' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-sm';
  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="pagination" role="navigation">
      <button
        onClick={(e) => onChange?.(e, Math.max(1, page - 1))}
        disabled={page === 1}
        className={cn(btnSize, 'rounded-[var(--radius-ui)] border border-border disabled:opacity-40 hover:bg-muted transition-colors inline-flex items-center justify-center')}
        aria-label="go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={(e) => onChange?.(e, p)}
          className={cn(
            btnSize,
            'rounded-[var(--radius-ui)] border transition-colors inline-flex items-center justify-center',
            p === page
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted'
          )}
          aria-label={`go to page ${p}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        onClick={(e) => onChange?.(e, Math.min(count, page + 1))}
        disabled={page === count}
        className={cn(btnSize, 'rounded-[var(--radius-ui)] border border-border disabled:opacity-40 hover:bg-muted transition-colors inline-flex items-center justify-center')}
        aria-label="go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};

export { Pagination };
