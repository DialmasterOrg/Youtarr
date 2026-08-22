import React from 'react';
import { Chip, Tooltip } from '../../../../components/ui';
import { Shield as ShieldIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_CHIP_STYLE } from '../../../shared/chipStyles';

interface ProtectedChipProps {
  autoRemovalProtected: boolean | undefined;
  keepRecentCount?: number | null;
}

const ProtectedChip: React.FC<ProtectedChipProps> = ({ autoRemovalProtected, keepRecentCount }) => {
  const hasKeepRecent = typeof keepRecentCount === 'number' && keepRecentCount > 0;

  if (!autoRemovalProtected && !hasKeepRecent) {
    return null;
  }

  // The two settings are mutually exclusive; full protection wins if both
  // somehow arrive set.
  const label = autoRemovalProtected ? 'Protected (All)' : `Protected (${keepRecentCount})`;
  const tooltipText = autoRemovalProtected
    ? 'This channel is protected from auto-removal; its videos are never deleted automatically.'
    : `Auto-removal always keeps this channel's ${keepRecentCount} most recently downloaded videos; older videos may still be removed.`;

  return (
    <Tooltip title={tooltipText}>
      <Chip
        icon={<ShieldIcon size={14} data-testid="ShieldIcon" />}
        label={label}
        size="small"
        variant="outlined"
        color="success"
        aria-label={tooltipText}
        data-testid="protected-chip"
        style={SHARED_CHANNEL_META_CHIP_STYLE}
      />
    </Tooltip>
  );
};

export default ProtectedChip;
