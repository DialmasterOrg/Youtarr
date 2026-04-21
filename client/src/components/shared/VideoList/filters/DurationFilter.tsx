import React from 'react';
import { TextField, Typography } from '../../../ui';

export interface DurationFilterProps {
  minDuration: number | null;
  maxDuration: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  compact?: boolean;
}

function parseMinutes(raw: string): number | null {
  if (raw === '') return null;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function DurationFilter({
  minDuration,
  maxDuration,
  onMinChange,
  onMaxChange,
  compact = false,
}: DurationFilterProps) {
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
        onChange={(e) => onMinChange(parseMinutes(e.target.value))}
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
        onChange={(e) => onMaxChange(parseMinutes(e.target.value))}
        inputProps={{ min: 0, 'aria-label': 'Maximum duration in minutes' }}
        style={{ width: compact ? 70 : 80 }}
      />
      <Typography variant="body2" color="text.secondary">
        min
      </Typography>
    </div>
  );
}

export default DurationFilter;
