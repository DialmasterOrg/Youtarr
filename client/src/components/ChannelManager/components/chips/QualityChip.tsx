import React from 'react';
import { Chip } from '../../../../components/ui';
import { Settings as SettingsIcon, Video as VideoIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_CHIP_STYLE } from '../../../shared/chipStyles';

interface QualityChipProps {
  videoQuality: string | null | undefined;
  globalPreferredResolution: string;
}

const QualityChip: React.FC<QualityChipProps> = ({ videoQuality, globalPreferredResolution }) => {
  const resolvedQuality = videoQuality || globalPreferredResolution;
  const isOverride = Boolean(videoQuality);
  const icon = isOverride
    ? <SettingsIcon size={14} data-testid="SettingsIcon" />
    : <VideoIcon size={14} data-testid="VideoIcon" />;

  return (
    <Chip
      label={`${resolvedQuality}p`}
      size="small"
      color={isOverride ? 'success' : 'default'}
      icon={icon}
      data-testid="quality-chip"
      data-override={isOverride ? 'true' : 'false'}
      style={SHARED_CHANNEL_META_CHIP_STYLE}
    />
  );
};

export default QualityChip;
