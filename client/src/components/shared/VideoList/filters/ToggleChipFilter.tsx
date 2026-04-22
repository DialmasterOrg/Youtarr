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
  size = 'small',
}: ToggleChipFilterProps) {
  const label = value === 'only' ? onlyLabel : value === 'exclude' ? excludeLabel : inactiveLabel;
  const color = value === 'only' ? 'primary' : value === 'exclude' ? 'warning' : 'default';
  const variant = value === 'off' ? 'outlined' : 'filled';

  return (
    <Chip
      icon={icon}
      label={label}
      variant={variant}
      color={color}
      size={size}
      onClick={() => onChange(NEXT_MODE[value])}
      onDelete={value === 'off' ? undefined : () => onChange('off')}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default ToggleChipFilter;
