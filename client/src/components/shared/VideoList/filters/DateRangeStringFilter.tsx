import React from 'react';
import { FormControl, InputLabel, Typography } from '../../../ui';
import DatePickerButton from './DatePickerButton';

export interface DateRangeStringFilterProps {
  dateFrom: string;
  dateTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  compact?: boolean;
}

function DateRangeStringFilter({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  compact = false,
}: DateRangeStringFilterProps) {
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <DatePickerButton
          value={dateFrom}
          onChange={onFromChange}
          placeholder="From"
          ariaLabel="Published from date"
          clearAriaLabel="Clear published from date"
        />
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
        <DatePickerButton
          value={dateTo}
          onChange={onToChange}
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
          value={dateFrom}
          onChange={onFromChange}
          placeholder="From"
          ariaLabel="Published from date"
          clearAriaLabel="Clear published from date"
          minWidth={160}
        />
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
        <DatePickerButton
          value={dateTo}
          onChange={onToChange}
          placeholder="To"
          ariaLabel="Published to date"
          clearAriaLabel="Clear published to date"
          minWidth={160}
        />
      </div>
    </FormControl>
  );
}

export default DateRangeStringFilter;
