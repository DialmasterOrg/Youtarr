import React from 'react';
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

  const navButtonStyle: React.CSSProperties = {
    width: compact ? 30 : 34,
    height: compact ? 30 : 34,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-ui)',
    background: 'var(--card)',
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 160ms ease',
  };

  return (
    <nav role="navigation" aria-label="pagination" className={className} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        aria-label="go to first page"
        type="button"
        onClick={() => onPageChange(1)}
        disabled={page <= 1}
        style={{ ...navButtonStyle, opacity: page <= 1 ? 0.45 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
      >
        <ChevronsLeft size={16} />
      </button>

      <button
        aria-label="go to previous page"
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        style={{ ...navButtonStyle, opacity: page <= 1 ? 0.45 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
      >
        <ChevronLeft size={16} />
      </button>

      {visiblePages.map((p) => (
        <button
          aria-label={`go to page ${p}`}
          type="button"
          key={p}
          onClick={() => onPageChange(p)}
          style={{
            minWidth: compact ? 30 : 34,
            height: compact ? 30 : 34,
            padding: compact ? '0 8px' : '0 10px',
            cursor: 'pointer',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-ui)',
            background: p === page ? 'var(--primary)' : 'var(--card)',
            color: p === page ? 'var(--primary-foreground)' : 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: p === page ? 700 : 500,
            transition: 'all 160ms ease',
          }}
        >
          {p}
        </button>
      ))}

      <button
        aria-label="go to next page"
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        style={{ ...navButtonStyle, opacity: page >= totalPages ? 0.45 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
      >
        <ChevronRight size={16} />
      </button>

      <button
        aria-label="go to last page"
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={page >= totalPages}
        style={{ ...navButtonStyle, opacity: page >= totalPages ? 0.45 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
      >
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}

export default PageControls;