import React from 'react';
import { Chip } from '../../../ui';

export interface ToggleChipFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
  inactiveLabel: string;
  activeLabel: string;
  size?: 'small' | 'medium';
}

function ToggleChipFilter({
  value,
  onChange,
  icon,
  inactiveLabel,
  activeLabel,
  size = 'small',
}: ToggleChipFilterProps) {
  return (
    <Chip
      icon={icon}
      label={value ? activeLabel : inactiveLabel}
      variant={value ? 'filled' : 'outlined'}
      color={value ? 'primary' : 'default'}
      size={size}
      onClick={() => onChange(!value)}
      onDelete={value ? () => onChange(false) : undefined}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default ToggleChipFilter;
