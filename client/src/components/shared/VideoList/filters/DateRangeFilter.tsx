import React from 'react';
import { TextField, Typography } from '../../../ui';

export interface DateRangeFilterProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
  compact?: boolean;
}

function toInputValue(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromInputValue(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
  const [year, month, day] = parts;
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <TextField
        label={compact ? undefined : 'Published From'}
        type="date"
        size="small"
        value={toInputValue(dateFrom)}
        onChange={(e) => onFromChange(fromInputValue(e.target.value))}
        InputLabelProps={compact ? undefined : { shrink: true }}
        inputProps={{ 'aria-label': 'Published from date' }}
        variant="outlined"
        style={{ minWidth: compact ? 0 : 180, flex: compact ? 1 : undefined }}
      />
      {compact && (
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
      )}
      <TextField
        label={compact ? undefined : 'Published To'}
        type="date"
        size="small"
        value={toInputValue(dateTo)}
        onChange={(e) => onToChange(fromInputValue(e.target.value))}
        InputLabelProps={compact ? undefined : { shrink: true }}
        inputProps={{ 'aria-label': 'Published to date' }}
        variant="outlined"
        style={{ minWidth: compact ? 0 : 180, flex: compact ? 1 : undefined }}
      />
    </div>
  );
}

export default DateRangeFilter;
