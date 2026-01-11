import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

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
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!compact && (
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
            Date:
          </Typography>
        )}
        <DatePicker
          label={compact ? 'From' : undefined}
          value={dateFrom}
          onChange={onFromChange}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="From"
              sx={{ width: compact ? 140 : 150 }}
              inputProps={{ ...params.inputProps, 'aria-label': 'Filter from date' }}
            />
          )}
        />
        <Typography variant="body2" color="text.secondary">
          to
        </Typography>
        <DatePicker
          label={compact ? 'To' : undefined}
          value={dateTo}
          onChange={onToChange}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="To"
              sx={{ width: compact ? 140 : 150 }}
              inputProps={{ ...params.inputProps, 'aria-label': 'Filter to date' }}
            />
          )}
        />
      </Box>
    </LocalizationProvider>
  );
}

export default DateRangeFilterInput;
