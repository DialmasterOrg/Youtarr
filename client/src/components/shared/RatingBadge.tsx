import React from 'react';
import { Chip, Tooltip, Box, Typography } from '../ui';
import { EighteenUpRating as EighteenUpRatingIcon } from '../../lib/icons';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
  showNA?: boolean;
  variant?: 'pill' | 'text';
  sx?: Record<string, unknown>;
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

  // No rating assigned - show "Unrated" chip (no color, grey)
  if (!rating) {
    return (
      <Chip
        label="Unrated"
        size={size}
        color="default"
        variant="outlined"
        style={{
          fontSize: size === 'small' ? '0.65rem' : '0.8rem',
          height: size === 'small' ? 20 : 24,
        }}
        className="text-muted-foreground/50 border-muted-foreground/50"
      />
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
        <Box className="inline-flex items-center gap-1">
          <EighteenUpRatingIcon size={size === 'small' ? 16 : 20} style={{ color: resolvedColor }} data-testid="EighteenUpRatingIcon" />
          <Typography
            variant="caption"
            style={{
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
        icon={<EighteenUpRatingIcon size={size === 'small' ? 12 : 16} data-testid="EighteenUpRatingIcon" />}
        style={{ fontSize: size === 'small' ? '0.7rem' : '0.875rem' }}
      />
    </Tooltip>
  );
};

export default RatingBadge;
