import React from 'react';
import { Chip, Tooltip } from '../../../../components/ui';
import { Warning as WarningIcon } from '../../../../lib/icons';

interface TerminatedChipProps {
  terminatedAt: string | null | undefined;
}

const formatDetectionDate = (terminatedAt: string): string => {
  const parsed = new Date(terminatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'unknown date';
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const TerminatedChip: React.FC<TerminatedChipProps> = ({ terminatedAt }) => {
  if (!terminatedAt) {
    return null;
  }

  const tooltipText = `YouTube terminated this channel; detected on ${formatDetectionDate(terminatedAt)}. Scheduled downloads are disabled. If the channel has been reinstated, load the channel page to update its status automatically.`;

  return (
    <Tooltip title={tooltipText}>
      <Chip
        icon={<WarningIcon size={14} data-testid="WarningIcon" />}
        label="Terminated"
        size="small"
        color="error"
        aria-label={tooltipText}
        data-testid="terminated-chip"
      />
    </Tooltip>
  );
};

export default TerminatedChip;
