import React from 'react';
import { TextField, Typography } from '../../../ui';

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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <TextField
        label={compact ? undefined : 'From Date'}
        type="date"
        size="small"
        value={dateFrom}
        onChange={(e) => onFromChange(e.target.value)}
        InputLabelProps={compact ? undefined : { shrink: true }}
        inputProps={{ 'aria-label': 'From date' }}
        variant="outlined"
        style={{ minWidth: compact ? 0 : 180, flex: compact ? 1 : undefined }}
      />
      {compact && (
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
      )}
      <TextField
        label={compact ? undefined : 'To Date'}
        type="date"
        size="small"
        value={dateTo}
        onChange={(e) => onToChange(e.target.value)}
        InputLabelProps={compact ? undefined : { shrink: true }}
        inputProps={{ 'aria-label': 'To date' }}
        variant="outlined"
        style={{ minWidth: compact ? 0 : 180, flex: compact ? 1 : undefined }}
      />
    </div>
  );
}

export default DateRangeStringFilter;
