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
 * When rating is null and showNA is true, shows a subtle "Unrated" indicator.
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

  // No rating assigned - show subtle "Unrated" indicator
  if (!rating) {
    return (
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          fontStyle: 'italic',
          fontSize: size === 'small' ? '0.7rem' : '0.8rem',
          ...sx,
        }}
      >
        Unrated
      </Typography>
    );
  }

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
    ? `Content Rating: ${rating} (Source: ${ratingSource})`
    : `Content Rating: ${rating}`;

  if (variant === 'text') {
    const color = getRatingColor(rating);
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
            {rating}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const chipColor = getRatingColor(rating);

  return (
    <Tooltip title={tooltipText} placement="top">
      <Chip
        label={rating}
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
