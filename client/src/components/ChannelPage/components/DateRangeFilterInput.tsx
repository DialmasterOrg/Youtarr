import React from 'react';
import { Typography } from '../../ui';

interface DateRangeFilterInputProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
  compact?: boolean;
}

function DateRangeFilterInput({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  compact = false,
}: DateRangeFilterInputProps) {
  const toInputValue = (date: Date | null) => {
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const fromInputValue = (val: string): Date | null => {
    if (!val) return null;
    const [month, day, year] = val.split('/').map((part) => Number(part));
    if (!month || !day || !year) return null;
    const parsed = new Date(year, month - 1, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!compact && (
        <Typography variant="body2" color="text.secondary" style={{ minWidth: 40 }}>
          Date:
        </Typography>
      )}
      {compact && (
        <label htmlFor="filter-from-date" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          From
        </label>
      )}
      <input
        id="filter-from-date"
        type="text"
        role="textbox"
        value={toInputValue(dateFrom)}
        onChange={(e) => onFromChange(fromInputValue(e.target.value))}
        aria-label="Filter from date"
        placeholder="From"
        style={{ width: compact ? 140 : 150, fontSize: '0.875rem', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      />
      <Typography variant="body2" color="text.secondary">
        to
      </Typography>
      {compact && (
        <label htmlFor="filter-to-date" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          To
        </label>
      )}
      <input
        id="filter-to-date"
        type="text"
        role="textbox"
        value={toInputValue(dateTo)}
        onChange={(e) => onToChange(fromInputValue(e.target.value))}
        aria-label="Filter to date"
        placeholder="To"
        style={{ width: compact ? 140 : 150, fontSize: '0.875rem', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      />
    </div>
  );
}

export default DateRangeFilterInput;
