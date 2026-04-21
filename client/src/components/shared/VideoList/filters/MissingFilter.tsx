import React from 'react';
import { Chip } from '../../../ui';
import { CloudOff as CloudOffIcon } from '../../../../lib/icons';

export interface MissingFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
  size?: 'small' | 'medium';
}

function MissingFilter({ value, onChange, size = 'small' }: MissingFilterProps) {
  return (
    <Chip
      icon={<CloudOffIcon size={16} />}
      label={value ? 'Missing Only' : 'Missing'}
      variant={value ? 'filled' : 'outlined'}
      color={value ? 'primary' : 'default'}
      size={size}
      onClick={() => onChange(!value)}
      onDelete={value ? () => onChange(false) : undefined}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default MissingFilter;
