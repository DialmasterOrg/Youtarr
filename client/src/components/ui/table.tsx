import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// Simple HTML table shims replacing MUI Table components

export const TableContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`w-full overflow-x-auto ${className}`} {...props}>{children}</div>
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, className = '', ...props }) => (
  <table className={`w-full text-sm border-collapse ${className}`} {...props}>{children}</table>
);

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...props }) => (
  <thead className={`bg-muted/50 ${className}`} {...props}>{children}</thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...props }) => (
  <tbody className={`divide-y divide-border ${className}`} {...props}>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = '', ...props }) => (
  <tr className={`hover:bg-muted/30 transition-colors ${className}`} {...props}>{children}</tr>
);

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  component?: 'th' | 'td';
  align?: 'left' | 'center' | 'right' | 'inherit' | 'justify';
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', component, align, ...props }) => {
  const Tag = component === 'th' ? 'th' : 'td';
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <Tag className={`px-3 py-2 align-middle text-foreground/80 ${alignClass} ${className}`} {...props as any}>
      {children}
    </Tag>
  );
};

/* ─── TableSortLabel ──────────────────────────────────────────
   Clickable sort header label with directional chevron icon
───────────────────────────────────────────────────────────── */
export interface TableSortLabelProps {
  active?: boolean;
  direction?: 'asc' | 'desc';
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const TableSortLabel: React.FC<TableSortLabelProps> = ({
  active = false,
  direction = 'asc',
  onClick,
  children,
  className = '',
}) => {
  const Icon = active
    ? direction === 'asc'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-medium text-left hover:text-foreground transition-colors focus-visible:outline-none ${active ? 'text-foreground' : 'text-muted-foreground'} ${className}`}
    >
      {children}
      <Icon size={14} />
    </button>
  );
};
