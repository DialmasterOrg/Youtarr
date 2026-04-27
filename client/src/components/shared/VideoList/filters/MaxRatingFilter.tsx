import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '../../../ui';
import { RATING_OPTIONS } from '../../../../utils/ratings';

export interface MaxRatingFilterProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}

function MaxRatingFilter({ value, onChange, label = 'Max Rating', compact = false }: MaxRatingFilterProps) {
  return (
    <FormControl
      style={compact ? { width: '100%' } : { minWidth: 110 }}
    >
      {!compact && <InputLabel shrink>{label}</InputLabel>}
      <Select
        size="small"
        label={compact ? undefined : label}
        value={value}
        displayEmpty
        onChange={(event) => onChange(event.target.value as string)}
      >
        {RATING_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.shortLabel}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default MaxRatingFilter;
