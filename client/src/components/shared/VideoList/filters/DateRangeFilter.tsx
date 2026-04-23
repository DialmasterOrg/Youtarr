import React from 'react';
import { FormControl, InputLabel, Typography } from '../../../ui';
import DatePickerButton from './DatePickerButton';

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
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <DatePickerButton
          value={toInputValue(dateFrom)}
          onChange={(v) => onFromChange(fromInputValue(v))}
          placeholder="From"
          ariaLabel="Published from date"
          clearAriaLabel="Clear published from date"
        />
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
        <DatePickerButton
          value={toInputValue(dateTo)}
          onChange={(v) => onToChange(fromInputValue(v))}
          placeholder="To"
          ariaLabel="Published to date"
          clearAriaLabel="Clear published to date"
        />
      </div>
    );
  }
  return (
    <FormControl>
      <InputLabel shrink>Published</InputLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <DatePickerButton
          value={toInputValue(dateFrom)}
          onChange={(v) => onFromChange(fromInputValue(v))}
          placeholder="From"
          ariaLabel="Published from date"
          clearAriaLabel="Clear published from date"
          minWidth={160}
        />
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
        <DatePickerButton
          value={toInputValue(dateTo)}
          onChange={(v) => onToChange(fromInputValue(v))}
          placeholder="To"
          ariaLabel="Published to date"
          clearAriaLabel="Clear published to date"
          minWidth={160}
        />
      </div>
    </FormControl>
  );
}

export default DateRangeFilter;
