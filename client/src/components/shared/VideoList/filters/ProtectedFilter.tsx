import React from 'react';
import { Chip } from '../../../ui';
import { Shield as ShieldIcon } from '../../../../lib/icons';

export interface ProtectedFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: 'small' | 'medium';
}

function ProtectedFilter({ value, onChange, size = 'small' }: ProtectedFilterProps) {
  return (
    <Chip
      icon={<ShieldIcon size={16} />}
      label={value ? 'Protected Only' : 'Protected'}
      variant={value ? 'filled' : 'outlined'}
      color={value ? 'primary' : 'default'}
      size={size}
      onClick={() => onChange(!value)}
      onDelete={value ? () => onChange(false) : undefined}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default ProtectedFilter;
