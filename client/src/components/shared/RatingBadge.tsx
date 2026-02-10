import React from 'react';
import { Chip, Tooltip, SxProps, Theme, Box, Typography } from '@mui/material';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
  showNA?: boolean;
  variant?: 'pill' | 'text';
  sx?: SxProps<Theme>;
}

/**
 * Displays a content/parental rating badge
 * Examples: R, PG-13, TV-14, TV-MA, etc.
 */
const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  ratingSource,
  size = 'small',
  showNA = false,
  variant = 'pill',
  sx,
}) => {
  if (!rating && !showNA) {
    return null;
  }

  const displayRating = rating || 'NR';
  const label = displayRating;

  const getRatingColor = (rate: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    const lower = rate.toLowerCase();

    // Kids / G - Green (Success)
    if (lower.includes('tv-y') || lower.includes('tv-g') || lower === 'g') {
      return 'success';
    }

    // Teens / PG - Orange (Warning)
    if (lower.includes('tv-pg') || lower.includes('tv-14') || lower === 'pg' || lower === 'pg-13') {
      return 'warning';
    }

    // Mature / R - Red (Error)
    if (lower.includes('tv-ma') || lower === 'r' || lower === 'nc-17') {
      return 'error';
    }

    return 'default';
  };

  const tooltipText = ratingSource
    ? `Content Rating: ${displayRating} (Source: ${ratingSource})`
    : `Content Rating: ${displayRating}`;

  if (variant === 'text') {
    const color = getRatingColor(displayRating);
    const resolvedColor = color === 'default' ? 'text.secondary' : `${color}.main`;

    return (
      <Tooltip title={tooltipText} placement="top">
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ...sx }}>
          <EighteenUpRatingIcon sx={{ fontSize: size === 'small' ? 16 : 20, color: resolvedColor }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: resolvedColor,
              fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            }}
          >
            {displayRating}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const chipColor = getRatingColor(displayRating);

  return (
    <Tooltip title={tooltipText} placement="top">
      <Chip
        label={displayRating}
        size={size}
        color={chipColor}
        icon={<EighteenUpRatingIcon sx={{ fontSize: size === 'small' ? '0.85rem' : '1rem' }} />}
        sx={{
          fontSize: size === 'small' ? '0.7rem' : '0.875rem',
          '& .MuiChip-icon': { ml: 0.3 },
          ...sx,
        }}
      />
    </Tooltip>
  );
};

export default RatingBadge;
