import React, { useId } from 'react';
import { FormControl, FormHelperText, InputLabel, Select, MenuItem } from '../ui';

export interface OptionSelectItem {
  value: string;
  label: React.ReactNode;
}

export interface OptionSelectProps {
  /** Current value. null/'' selects the empty option (when one is rendered). */
  value: string | null;
  /** Called with the selected value, or null when the empty option is chosen. */
  onChange: (value: string | null) => void;
  options: OptionSelectItem[];
  label: string;
  /** When provided, a leading italicized empty option is rendered with this label. */
  emptyLabel?: string;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  labelId?: string;
}

/**
 * Shared base for the "optional override" dropdowns (resolution, audio format,
 * rating). Owns the FormControl + InputLabel + Select wiring and the label
 * association (via labelId) that tests rely on.
 */
export function OptionSelect({
  value,
  onChange,
  options,
  label,
  emptyLabel,
  helperText,
  disabled,
  className,
  labelId,
}: OptionSelectProps) {
  const generatedId = useId();
  const resolvedLabelId = labelId ?? generatedId;

  return (
    <FormControl fullWidth className={className}>
      <InputLabel id={resolvedLabelId} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={resolvedLabelId}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange((e.target.value as string) || null)}
      >
        {emptyLabel !== undefined && (
          <MenuItem value="">
            <em>{emptyLabel}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export default OptionSelect;
