import React from 'react';
import { Box, Tooltip, Typography, SxProps, Theme } from '@mui/material';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
  showNA?: boolean;
  variant?: 'pill' | 'text';
  sx?: SxProps<Theme>;
}

const getRatingColor = (rate: string): string => {
  const lower = rate.toLowerCase();

  if (lower.includes('tv-y')) return 'info.main';
  if (lower.includes('tv-pg')) return 'primary.main';
  if (lower.includes('tv-14')) return 'warning.main';
  if (lower.includes('tv-ma')) return 'error.main';

  if (lower === 'g') return 'info.main';
  if (lower === 'pg') return 'primary.main';
  if (lower === 'pg-13') return 'warning.main';
  if (lower === 'r') return 'error.main';
  if (lower === 'nc-17') return 'error.main';

  return 'text.secondary';
};

const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  ratingSource,
  size = 'small',
  showNA = false,
  variant = 'pill',
  sx,
}) => {
  const { themeMode } = useThemeEngine();

  const getStyleSx = () => {
    if (themeMode === 'neumorphic') {
      return {
        border: 'var(--border-weight) solid transparent',
        boxShadow: 'var(--shadow-input-rest)',
        '&:hover': {
          boxShadow: 'var(--shadow-input-rest)',
          transform: 'translate(0, 0)',
        },
      };
    } else if (themeMode === 'flat' || themeMode === 'linear') {
      return {
        border: 'var(--border-weight) solid var(--border)',
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
          transform: 'translate(0, 0)',
        },
      };
    }
    // playful and default
    return {
      border: 'var(--border-weight) solid var(--foreground)',
      boxShadow: 'var(--shadow-hard)',
      '&:hover': {
        boxShadow: 'var(--shadow-hard-hover)',
        transform: 'translate(-2px, -2px)',
      },
    };
  };

  const styleSx = getStyleSx();

  if (!rating && !showNA) {
    return null;
  }

  const displayRating = rating || 'NR';
  const color = getRatingColor(displayRating);

  const tooltipText = ratingSource
    ? `Content Rating: ${displayRating} (Source: ${ratingSource})`
    : `Content Rating: ${displayRating}`;

  if (variant === 'text') {
    return (
      <Tooltip title={tooltipText} placement="top">
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ...sx }}>
          <EighteenUpRatingIcon sx={{ fontSize: size === 'small' ? 16 : 20, color }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color,
              fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            }}
          >
            {displayRating}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText} placement="top">
      <Box
        className="sticker"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: size === 'small' ? 1 : 1.25,
          py: size === 'small' ? 0.35 : 0.5,
          borderRadius: 'var(--radius-ui)',
          bgcolor: 'var(--card)',
          color: 'var(--foreground)',
          transition: 'all 200ms var(--transition-bouncy)',
          transform: 'translate(0, 0)',
          ...styleSx,
          ...sx,
        }}
      >
        <EighteenUpRatingIcon sx={{ fontSize: size === 'small' ? 14 : 18, color }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            fontSize: size === 'small' ? '0.65rem' : '0.75rem',
            lineHeight: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {displayRating}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default RatingBadge;
