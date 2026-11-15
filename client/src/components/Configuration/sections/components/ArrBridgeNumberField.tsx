import React, { ChangeEvent, useState } from 'react';
import { TextField } from '../../../ui';

interface ArrBridgeNumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  helperText?: string;
  onChange: (value: number) => void;
}

/**
 * A whole-number setting. The text being typed is kept apart from the saved
 * number, so the field can be emptied to retype it: an empty field reports
 * nothing instead of 0, which is out of range for some settings and would
 * block Save. What is reported is always a whole number inside the range.
 */
export const ArrBridgeNumberField: React.FC<ArrBridgeNumberFieldProps> = ({
  label,
  value,
  min,
  max,
  helperText,
  onChange,
}) => {
  const [typed, setTyped] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setTyped(text);
    const number = Number(text);
    if (text.trim() === '' || !Number.isFinite(number)) return;
    onChange(Math.min(Math.max(Math.round(number), min), max));
  };

  return (
    <TextField
      fullWidth
      type="number"
      label={label}
      value={typed ?? value}
      inputProps={{ min, max, step: 1 }}
      onChange={handleChange}
      onBlur={() => setTyped(null)}
      helperText={helperText}
    />
  );
};

export default ArrBridgeNumberField;
