import React from 'react';
import { Chip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

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
      icon={isOverride ? <SettingsIcon sx={{ fontSize: '0.85rem' }} /> : undefined}
      data-testid="quality-chip"
      data-override={isOverride ? 'true' : 'false'}
      sx={{
        fontSize: '0.7rem',
        '& .MuiChip-icon': {
          ml: 0.3,
        },
      }}
    />
  );
};

export default QualityChip;
