import React from 'react';
import { Chip } from '../../../ui';
import { Block as BlockIcon } from '../../../../lib/icons';

export interface IgnoredFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: 'small' | 'medium';
}

function IgnoredFilter({ value, onChange, size = 'small' }: IgnoredFilterProps) {
  return (
    <Chip
      icon={<BlockIcon size={16} />}
      label={value ? 'Ignored Only' : 'Ignored'}
      variant={value ? 'filled' : 'outlined'}
      color={value ? 'primary' : 'default'}
      size={size}
      onClick={() => onChange(!value)}
      onDelete={value ? () => onChange(false) : undefined}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default IgnoredFilter;
