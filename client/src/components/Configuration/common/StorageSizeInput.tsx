import React, { useEffect, useId, useState } from 'react';
import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from '../../ui';

// MB matches what the server accepts, so hand-edited values like "500MB" display.
const SIZE_UNITS = ['MB', 'GB', 'TB'] as const;
type SizeUnit = (typeof SIZE_UNITS)[number];
const DEFAULT_UNIT: SizeUnit = 'GB';
// Matches the medium Select height so the two controls line up.
const FIELD_MIN_HEIGHT_PX = 48;

const parseSize = (value: string): { amount: string; unit: SizeUnit | null } => {
  const match = /^(\d+)(MB|GB|TB)$/.exec(value || '');
  return match ? { amount: match[1], unit: match[2] as SizeUnit } : { amount: '', unit: null };
};

interface StorageSizeInputProps {
  label: string;
  /** Config value such as "500GB" or "2TB"; '' means off. */
  value: string;
  onChange: (value: string) => void;
  helperText?: React.ReactNode;
  testId?: string;
}

/**
 * Number + unit picker for size limits stored as "<n>MB" / "<n>GB" / "<n>TB" strings.
 * A blank or zero amount turns the limit off ('').
 */
export const StorageSizeInput: React.FC<StorageSizeInputProps> = ({ label, value, onChange, helperText, testId }) => {
  const amountInputId = useId();
  const unitLabelId = useId();
  const parsed = parseSize(value);
  // The unit is remembered locally so choosing TB before typing a number works.
  const [unit, setUnit] = useState<SizeUnit>(parsed.unit ?? DEFAULT_UNIT);

  useEffect(() => {
    if (parsed.unit) {
      setUnit(parsed.unit);
    }
  }, [parsed.unit]);

  const handleAmountChange = (raw: string) => {
    const amount = parseInt(raw, 10);
    onChange(Number.isNaN(amount) || amount <= 0 ? '' : `${amount}${unit}`);
  };

  const handleUnitChange = (nextUnit: SizeUnit) => {
    setUnit(nextUnit);
    if (parsed.amount) {
      onChange(`${parsed.amount}${nextUnit}`);
    }
  };

  // Same shape as the Select fields on these pages: small label above a
  // 48px control. The number field takes the remaining width beside the unit.
  return (
    <FormControl className="flex-1 min-w-0">
      <InputLabel htmlFor={amountInputId}>{label}</InputLabel>
      <Box className="flex items-stretch gap-2">
        <TextField
          id={amountInputId}
          fullWidth
          type="number"
          value={parsed.amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAmountChange(e.target.value)}
          inputProps={{
            min: 0,
            style: { backgroundColor: 'var(--input)', minHeight: FIELD_MIN_HEIGHT_PX },
            'data-testid': testId ? `${testId}-amount` : undefined,
          }}
        />
        <span id={unitLabelId} className="sr-only">Unit</span>
        <Box className="w-28 shrink-0">
          <Select
            labelId={unitLabelId}
            fullWidth
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as SizeUnit)}
            inputProps={{ 'data-testid': testId ? `${testId}-unit` : undefined }}
          >
            {SIZE_UNITS.map((sizeUnit) => (
              <MenuItem key={sizeUnit} value={sizeUnit}>
                {sizeUnit}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export default StorageSizeInput;
