import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';

interface RatingChipProps {
  rating: string | null | undefined;
  size?: 'small' | 'medium';
}

const RatingChip: React.FC<RatingChipProps> = ({ rating, size = 'small' }) => {
  const { themeMode } = useThemeEngine();
  const isNeumorphic = themeMode === 'neumorphic';

  if (!rating) return null;

  return (
    <Tooltip title={`Content Rating: ${rating}`}>
      <Chip
        className="sticker"
        icon={<StarIcon sx={{ fontSize: '0.8rem !important' }} />}
        label={rating}
        size={size}
        variant="outlined"
        sx={{
          height: size === 'small' ? 22 : 26,
          fontSize: size === 'small' ? '0.65rem' : '0.75rem',
          fontWeight: 700,
          borderRadius: 'var(--radius-ui)',
          backgroundColor: 'var(--card)',
          border: isNeumorphic
            ? 'var(--border-weight) solid transparent'
            : 'var(--border-weight) solid var(--border-strong)',
          boxShadow: isNeumorphic ? 'var(--shadow-input-rest)' : 'var(--shadow-hard)',
          color: 'var(--foreground)',
          '& .MuiChip-label': {
            px: 0.75,
          },
          '& .MuiChip-icon': {
            ml: 0.5,
            mr: -0.25,
            color: 'primary.main',
          }
        }}
      />
    </Tooltip>
  );
};

export default RatingChip;
