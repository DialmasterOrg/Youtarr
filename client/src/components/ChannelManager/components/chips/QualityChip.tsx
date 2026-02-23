import React from 'react';
import { Chip } from '../../../../components/ui';
import { Settings as SettingsIcon } from '../../../../lib/icons';

interface QualityChipProps {
  videoQuality: string | null | undefined;
  globalPreferredResolution: string;
}

const QualityChip: React.FC<QualityChipProps> = ({ videoQuality, globalPreferredResolution }) => {
  const resolvedQuality = videoQuality || globalPreferredResolution;
  const isOverride = Boolean(videoQuality);

  return (
    <Chip
      label={`${resolvedQuality}p`}
      size="small"
      color={isOverride ? 'success' : 'default'}
      icon={isOverride ? <SettingsIcon size={14} /> : undefined}
      data-testid="quality-chip"
      data-override={isOverride ? 'true' : 'false'}
      style={{ fontSize: '0.7rem' }}
    />
  );
};

export default QualityChip;
