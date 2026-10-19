import React from 'react';
import { Chip } from '../../../ui';
import type { ChipFilterMode } from '../types';

export interface ToggleChipFilterProps {
  value: ChipFilterMode;
  onChange: (value: ChipFilterMode) => void;
  icon: React.ReactNode;
  inactiveLabel: string;
  onlyLabel: string;
  excludeLabel: string;
  // The value the chip returns to when cleared (default off). A chip whose
  // resting value is exclude, like "deleted videos hidden", is active when off.
  restingValue?: ChipFilterMode;
  // Label for the off state when it is not the resting value (e.g. "Show: Deleted").
  offLabel?: string;
  size?: 'small' | 'medium';
}

const NEXT_MODE: Record<ChipFilterMode, ChipFilterMode> = {
  off: 'only',
  only: 'exclude',
  exclude: 'off',
};

function ToggleChipFilter({
  value,
  onChange,
  icon,
  inactiveLabel,
  onlyLabel,
  excludeLabel,
  restingValue = 'off',
  offLabel,
  size = 'small',
}: ToggleChipFilterProps) {
  const offIsActive = restingValue !== 'off';
  const label = value === 'only'
    ? onlyLabel
    : value === 'exclude'
      ? excludeLabel
      : (offIsActive && offLabel) || inactiveLabel;
  const isResting = value === restingValue;
  // A chip at rest is not filtering anything the user chose, so it looks
  // neutral even when its resting label reads "Hide: ...".
  const color = isResting ? 'default' : value === 'exclude' ? 'warning' : 'primary';
  const variant = isResting ? 'outlined' : 'filled';
  // Pressed means "moved off the resting value"; the label carries which mode.
  const ariaPressed = !isResting;

  return (
    <Chip
      icon={icon}
      label={label}
      variant={variant}
      color={color}
      size={size}
      onClick={() => onChange(NEXT_MODE[value])}
      onDelete={isResting ? undefined : () => onChange(restingValue)}
      style={{ cursor: 'pointer' }}
      aria-pressed={ariaPressed}
    />
  );
}

export default ToggleChipFilter;
