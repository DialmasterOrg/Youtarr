import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface DurationFilterInputProps {
  minDuration: number | null;
  maxDuration: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  compact?: boolean;
}

function DurationFilterInput({
  minDuration,
  maxDuration,
  onMinChange,
  onMaxChange,
  compact = false,
}: DurationFilterInputProps) {
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onMinChange(null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        onMinChange(numValue);
      }
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onMaxChange(null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        onMaxChange(numValue);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {!compact && (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
          Duration:
        </Typography>
      )}
      <TextField
        size="small"
        type="number"
        placeholder="Min"
        value={minDuration ?? ''}
        onChange={handleMinChange}
        inputProps={{ min: 0, 'aria-label': 'Minimum duration in minutes' }}
        sx={{ width: compact ? 70 : 80 }}
      />
      <Typography variant="body2" color="text.secondary">
        to
      </Typography>
      <TextField
        size="small"
        type="number"
        placeholder="Max"
        value={maxDuration ?? ''}
        onChange={handleMaxChange}
        inputProps={{ min: 0, 'aria-label': 'Maximum duration in minutes' }}
        sx={{ width: compact ? 70 : 80 }}
      />
      <Typography variant="body2" color="text.secondary">
        min
      </Typography>
    </Box>
  );
}

export default DurationFilterInput;
