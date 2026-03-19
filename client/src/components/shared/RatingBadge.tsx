import React from 'react';
import { Chip, Tooltip, Box, Typography } from '../ui';
import { EighteenUpRating as EighteenUpRatingIcon } from '../../lib/icons';
import { SHARED_RATING_CHIP_SMALL_STYLE, SHARED_RATING_CHIP_STYLE } from './chipStyles';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
  showNA?: boolean;
  variant?: 'pill' | 'text';
  className?: string;
  style?: React.CSSProperties;
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
  className,
  style,
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
          ...(size === 'small'
            ? SHARED_RATING_CHIP_SMALL_STYLE
            : {
              ...SHARED_RATING_CHIP_STYLE,
              height: 24,
              fontSize: '0.8rem',
            }),
          backgroundColor: 'var(--rating-chip-unrated-background)',
          color: 'var(--rating-chip-unrated-foreground)',
          ...style,
        }}
        className={`text-muted-foreground/50 border-muted-foreground/50 ${className || ''}`.trim()}
      />
    );
  }

  const getRatingColor = (rate: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    const normalized = typeof rate === 'string' ? rate.trim() : '';
    if (!normalized) return 'default';
    const lower = normalized.toLowerCase();

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

    return 'secondary';
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
  const chipStyleByColor: Record<string, React.CSSProperties> = {
    success: {
      backgroundColor: 'var(--success)',
      color: 'var(--success-foreground)',
    },
    warning: {
      backgroundColor: 'var(--warning)',
      color: 'var(--warning-foreground)',
    },
    error: {
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
    },
    secondary: {
      backgroundColor: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
    },
    default: {
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
    },
  };

  return (
    <Tooltip title={tooltipText} placement="top">
      <Chip
        label={rating}
        size={size}
        variant="filled"
        color={chipColor}
        icon={<EighteenUpRatingIcon size={size === 'small' ? 12 : 16} data-testid="EighteenUpRatingIcon" />}
        className={className}
        style={{
          ...(size === 'small' ? SHARED_RATING_CHIP_SMALL_STYLE : SHARED_RATING_CHIP_STYLE),
          ...(chipStyleByColor[chipColor] || chipStyleByColor.default),
          ...style,
        }}
      />
    </Tooltip>
  );
};

export default RatingBadge;
