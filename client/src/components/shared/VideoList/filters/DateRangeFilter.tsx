import React from 'react';
import { Typography } from '../../../ui';

export interface DateRangeFilterProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
  compact?: boolean;
}

function toDisplay(date: Date | null): string {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function fromDisplay(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('/').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((v) => !v)) return null;
  const [month, day, year] = parts;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function DateRangeFilter({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  compact = false,
}: DateRangeFilterProps) {
  const inputStyle: React.CSSProperties = {
    width: compact ? 140 : 150,
    fontSize: '0.875rem',
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-input)',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!compact && (
        <Typography variant="body2" color="text.secondary" style={{ minWidth: 40 }}>
          Date:
        </Typography>
      )}
      {compact && (
        <label htmlFor="videolist-filter-from-date" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          From
        </label>
      )}
      <input
        id="videolist-filter-from-date"
        type="text"
        role="textbox"
        value={toDisplay(dateFrom)}
        onChange={(e) => onFromChange(fromDisplay(e.target.value))}
        aria-label="Filter from date"
        placeholder="From"
        style={inputStyle}
      />
      <Typography variant="body2" color="text.secondary">
        to
      </Typography>
      {compact && (
        <label htmlFor="videolist-filter-to-date" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          To
        </label>
      )}
      <input
        id="videolist-filter-to-date"
        type="text"
        role="textbox"
        value={toDisplay(dateTo)}
        onChange={(e) => onToChange(fromDisplay(e.target.value))}
        aria-label="Filter to date"
        placeholder="To"
        style={inputStyle}
      />
    </div>
  );
}

export default DateRangeFilter;
