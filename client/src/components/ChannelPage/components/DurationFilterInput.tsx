import React from 'react';
import { TextField, Typography } from '../../ui';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!compact && (
        <Typography variant="body2" color="text.secondary" style={{ minWidth: 60 }}>
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
        style={{ width: compact ? 70 : 80 }}
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
        style={{ width: compact ? 70 : 80 }}
      />
      <Typography variant="body2" color="text.secondary">
        min
      </Typography>
    </div>
  );
}

export default DurationFilterInput;
