import React from 'react';
import { Chip, Tooltip } from '../../ui';

interface AutoDownloadChipProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

const AutoDownloadChip: React.FC<AutoDownloadChipProps> = ({
  enabled,
  onToggle,
  disabled,
}) => {
  const tooltip = enabled
    ? 'Auto-download is on. Click to disable.'
    : 'Auto-download is off. Click to enable.';

  const chip = (
    <Chip
      label="Auto-download"
      color={enabled ? 'success' : 'default'}
      variant={enabled ? 'filled' : 'outlined'}
      onClick={disabled ? undefined : () => onToggle(!enabled)}
      disabled={disabled}
      aria-pressed={enabled}
    />
  );

  return (
    <Tooltip title={tooltip}>
      <span>{chip}</span>
    </Tooltip>
  );
};

export default AutoDownloadChip;
